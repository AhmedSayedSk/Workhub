// AdGen render webhook — signature verification and the rules that decide what
// gets mirrored onto a `renderJobs` document.
//
// This module is deliberately pure: no Firebase, no network, no framework. The
// only side effect is delegated to a `MirrorStore` the caller supplies, so the
// whole decision surface is testable without Firestore. `renderJobs` is
// server-write-only (`allow write: if false`), so the only real implementation
// is the firebase-admin one in `adgenMirror.ts`.
//
// Two channels feed the same decision function:
//   1. this webhook (terminal transitions only — AdGen does not push progress)
//   2. the poll fallback in /api/render-jobs/[id]/status (progress + missed
//      deliveries)
// Both must agree, which is why `decideMirror` is shared rather than duplicated.

import { createHmac, timingSafeEqual } from 'node:crypto'

const SIGNATURE_HEADER = 'x-adgen-signature'
const DELIVERY_HEADER = 'x-adgen-delivery-id'
const SECRET_VAR = 'ADGEN_WEBHOOK_SECRET'

/** How far a delivery's timestamp may drift before it is treated as a replay. */
const MAX_SKEW_MS = 5 * 60_000

/** Firestore rejects unbounded strings from a third party; errors are display-only. */
const MAX_ERROR_CHARS = 500

/**
 * The stages the campaign progress card can put a label on
 * (`CampaignTab.tsx` → `VIDEO_STAGE`). Anything else degrades to "Rendering…",
 * so unknown values are normalised to `rendering` rather than stored verbatim.
 */
const KNOWN_STAGES = new Set(['preparing', 'hook', 'voiceover', 'rendering', 'encoding', 'uploading', 'done', 'cancelled'])

/** The statuses the UI branches on. Identical vocabulary on both sides today. */
const KNOWN_STATUSES = new Set(['queued', 'rendering', 'done', 'failed', 'cancelled'])
const TERMINAL_STATUSES = new Set(['done', 'failed', 'cancelled'])

const WEBHOOK_EVENTS = new Set(['job.completed', 'job.failed'])

export type RenderStatus = 'queued' | 'rendering' | 'done' | 'failed' | 'cancelled'

/** A job in one of these states is settled and must never be rewritten. */
export function isTerminalStatus(status: unknown): boolean {
  return typeof status === 'string' && TERMINAL_STATUSES.has(status)
}

/** The subset of a `renderJobs` document the mirror reads and writes. */
export interface RenderJobSnapshot {
  status?: string
  progress?: number
  stage?: string
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
  /** Set by the Stop button; the render was cancelled by the user mid-flight. */
  cancelRequested?: boolean
  /** Idempotency key of the last delivery applied to this document. */
  lastDeliveryId?: string
  startedAt?: number
  finishedAt?: number
}

/** A job state as reported by AdGen, from either a webhook or a poll. */
export interface AdGenJobState {
  status?: RenderStatus | string
  progress?: number
  stage?: string
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}

export type MirrorResult = 'missing' | 'noop' | 'written'

export interface MirrorStore {
  /**
   * Read the `renderJobs` document carrying `adgenJobId`, run `decide` against
   * it and apply the returned patch atomically. `missing` when no such document
   * exists; `noop` when `decide` returns null.
   */
  mirror(
    adgenJobId: string,
    decide: (current: RenderJobSnapshot) => Record<string, unknown> | null
  ): Promise<MirrorResult>
}

// ── Signature ───────────────────────────────────────────────────────────────

interface ParsedSignature {
  t: number
  v1: string
}

/** Parse `t=<unix-seconds>,v1=<hex>`. Returns null for anything malformed. */
function parseSignatureHeader(header: string | null | undefined): ParsedSignature | null {
  if (!header) return null
  let t: number | null = null
  let v1: string | null = null
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (k === 't') {
      if (!/^\d+$/.test(v)) return null
      t = Number(v)
    } else if (k === 'v1') {
      if (!/^[0-9a-f]+$/i.test(v)) return null
      v1 = v.toLowerCase()
    }
  }
  if (t === null || v1 === null) return null
  return { t, v1 }
}

/**
 * Verify a delivery. The signed payload is `` `${timestamp}.${rawBody}` `` —
 * the caller MUST pass the raw request body, not a re-serialised object, or a
 * byte-identical-but-differently-spaced payload would be rejected.
 */
export function verifyAdgenSignature(args: {
  header: string | null | undefined
  rawBody: string
  secret: string
  nowMs: number
}): boolean {
  const { header, rawBody, secret, nowMs } = args
  if (!secret) return false
  const parsed = parseSignatureHeader(header)
  if (!parsed) return false

  // Reject stale AND future timestamps: a captured delivery must not stay
  // replayable, and a clock far ahead is not a signal we can trust.
  if (Math.abs(nowMs - parsed.t * 1000) > MAX_SKEW_MS) return false

  const expected = createHmac('sha256', secret).update(`${parsed.t}.${rawBody}`).digest('hex')
  // timingSafeEqual throws on a length mismatch, which is itself observable —
  // compare lengths first, then the bytes in constant time.
  if (expected.length !== parsed.v1.length) return false
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(parsed.v1, 'utf8'))
}

// ── Payload mapping ─────────────────────────────────────────────────────────

/** Normalise a stage to one the progress card can label. */
export function normalizeStage(stage: unknown): string {
  if (typeof stage !== 'string') return 'rendering'
  const s = stage.trim().toLowerCase()
  return KNOWN_STAGES.has(s) ? s : 'rendering'
}

function normalizeStatus(status: unknown): RenderStatus | null {
  if (typeof status !== 'string') return null
  const s = status.trim().toLowerCase()
  return KNOWN_STATUSES.has(s) ? (s as RenderStatus) : null
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

interface Envelope {
  event?: unknown
  jobId?: unknown
  id?: unknown
  data?: Record<string, unknown>
  job?: Record<string, unknown>
  [k: string]: unknown
}

/** Pull the AdGen job id out of whichever envelope shape arrived. */
function jobIdOf(body: Envelope): string | undefined {
  return (
    str(body.jobId) ||
    str(body.data?.jobId) ||
    str(body.data?.id) ||
    str(body.job?.jobId) ||
    str(body.job?.id) ||
    str(body.id)
  )
}

/**
 * Map a webhook envelope onto a job state. AdGen fires on terminal transitions
 * only, so the event name is authoritative when the payload omits a status.
 */
export function eventToJobState(body: Envelope): AdGenJobState | null {
  const event = str(body.event)
  if (!event || !WEBHOOK_EVENTS.has(event)) return null
  const d = (body.data as Record<string, unknown>) || (body.job as Record<string, unknown>) || body
  const reported = normalizeStatus(d.status) ?? normalizeStatus(body.status)
  // A completion always means done. A failure may carry `cancelled` (AdGen
  // reports a cancelled render as a failed job), so trust the payload there.
  const status: RenderStatus =
    event === 'job.completed'
      ? 'done'
      : reported && reported !== 'done'
        ? reported
        : 'failed'
  return {
    status,
    progress: num(d.progress) ?? num(body.progress),
    stage: str(d.stage) ?? str(body.stage),
    videoUrl: str(d.videoUrl) ?? str(body.videoUrl),
    thumbnailUrl: str(d.thumbnailUrl) ?? str(body.thumbnailUrl),
    error: str(d.error) ?? str(body.error),
  }
}

// ── The mirror decision ─────────────────────────────────────────────────────

/**
 * Decide what to write onto a `renderJobs` document, given its current state
 * and a job state from AdGen. Returns null when nothing should be written.
 *
 * The invariants, in order of precedence:
 *  1. A delivery already applied is never applied twice (at-least-once senders).
 *  2. A terminal state is never overwritten — not by another terminal state,
 *     and never by a late delivery that would resurrect a settled job.
 *  3. A render the user asked to stop settles as `cancelled`, even if AdGen
 *     finished it first. The Stop button is the user's decision, not a race.
 *  4. Progress only moves forward, and never regresses `rendering` to `queued`.
 *  5. Only stages the UI can label are stored.
 */
export function decideMirror(
  current: RenderJobSnapshot,
  next: AdGenJobState,
  opts: { nowMs: number; deliveryId?: string }
): Record<string, unknown> | null {
  // (1) idempotency
  if (opts.deliveryId && current.lastDeliveryId === opts.deliveryId) return null

  // (2) a settled job stays settled
  if (current.status && TERMINAL_STATUSES.has(current.status)) return null

  const incoming = normalizeStatus(next.status)
  // (3) the user's Stop wins over a completion that arrived anyway
  const status: RenderStatus | null =
    incoming === 'done' && current.cancelRequested ? 'cancelled' : incoming
  const terminal = status !== null && TERMINAL_STATUSES.has(status)

  const patch: Record<string, unknown> = {}

  // (4) status, never backwards
  if (status && status !== current.status && !(status === 'queued' && current.status === 'rendering')) {
    patch.status = status
  }

  // Progress: monotonic, clamped, and pinned to 100 on a successful finish.
  const rawProgress = status === 'done' ? 100 : num(next.progress)
  if (rawProgress !== undefined) {
    const clamped = Math.min(100, Math.max(0, Math.round(rawProgress)))
    if (clamped > (num(current.progress) ?? 0)) patch.progress = clamped
  }

  // (5) stage — terminal states own their stage; otherwise take AdGen's, mapped.
  const stage =
    status === 'done' ? 'done'
      : status === 'cancelled' ? 'cancelled'
        : next.stage !== undefined ? normalizeStage(next.stage)
          : undefined
  if (stage !== undefined && stage !== current.stage) patch.stage = stage

  if (status !== 'cancelled') {
    // A cancelled render has no deliverable, even if one was produced.
    const videoUrl = str(next.videoUrl)
    if (videoUrl && videoUrl !== current.videoUrl) patch.videoUrl = videoUrl
    const thumbnailUrl = str(next.thumbnailUrl)
    if (thumbnailUrl && thumbnailUrl !== current.thumbnailUrl) patch.thumbnailUrl = thumbnailUrl
  }

  const error = str(next.error)?.slice(0, MAX_ERROR_CHARS)
  if (error && error !== current.error) patch.error = error
  // A failure with no reason must still say something — the card renders
  // `job.error` and an empty one reads as a bug.
  else if (status === 'failed' && !current.error) patch.error = 'The render failed'

  // Timeline stamps the progress card reads.
  if (status === 'rendering' && current.status !== 'rendering' && !current.startedAt) patch.startedAt = opts.nowMs
  if (terminal && !current.finishedAt) patch.finishedAt = opts.nowMs

  if (!Object.keys(patch).length) return null
  if (opts.deliveryId) patch.lastDeliveryId = opts.deliveryId
  return patch
}

// ── The route handler ───────────────────────────────────────────────────────

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Handle one webhook delivery. Framework-free (plain `Request`/`Response`) so
 * the route file stays a two-line adapter and this stays unit-testable.
 *
 * Status codes are chosen for AdGen's retry policy (at-least-once, up to 6
 * attempts over ~8.6h):
 *   401 — not from AdGen. Never retried into a write.
 *   400 — unparseable body. A retry cannot fix it, but it is a sender bug.
 *   200 — accepted, INCLUDING for a job we do not have: telling a retrying
 *         sender to keep trying for eight hours over an id we will never know
 *         is worse than dropping it.
 *   500 — our storage failed. This one SHOULD be retried.
 */
export async function handleAdgenWebhook(
  request: Request,
  deps: { store: MirrorStore; nowMs?: number }
): Promise<Response> {
  const secret = (process.env[SECRET_VAR] || '').trim()
  if (!secret) {
    // Never echo the variable's value — only that it is missing.
    return json({ error: 'Webhook is not configured' }, 500)
  }

  // The signature covers the raw bytes: read the body as text FIRST and parse
  // only what was verified.
  const raw = await request.text().catch(() => '')
  const nowMs = deps.nowMs ?? Date.now()
  if (!verifyAdgenSignature({ header: request.headers.get(SIGNATURE_HEADER), rawBody: raw, secret, nowMs })) {
    return json({ error: 'Invalid signature' }, 401)
  }

  let body: Envelope
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    body = parsed as Envelope
  } catch {
    return json({ error: 'Invalid payload' }, 400)
  }

  const state = eventToJobState(body)
  const adgenJobId = jobIdOf(body)
  // An event we do not model (or an id-less payload) is acknowledged and
  // dropped — retrying it would never produce a different outcome.
  if (!state || !adgenJobId) return json({ ok: true, result: 'ignored' }, 200)

  const deliveryId = str(request.headers.get(DELIVERY_HEADER))

  let result: MirrorResult
  try {
    result = await deps.store.mirror(adgenJobId, (current) =>
      decideMirror(current, state, { nowMs, deliveryId })
    )
  } catch {
    // Deliberately does not quote the underlying error: it can carry
    // infrastructure detail we do not return to a caller.
    return json({ error: 'Could not record the update' }, 500)
  }

  return json({ ok: true, result }, 200)
}
