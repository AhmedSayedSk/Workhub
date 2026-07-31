// Image generation — the service the playground and the campaign builder call
// to turn a prompt into hosted image URLs.
//
// Server-only. It holds a service credential and must never be imported into a
// client component. Configuration is read from the environment on every call
// (never at module load), so a missing value fails loudly at the call site
// instead of baking an empty credential into the module.
//
// Two rules shape everything below:
//
//  1. The credential goes into a request header and nowhere else. It is never
//     put in a URL, never logged, never returned in a body and never placed in
//     a thrown error's message.
//  2. Nothing the browser can see may name a backing vendor or an account.
//     Upstream error text is therefore *never* relayed — a status maps to one
//     of a small set of fixed, neutral strings.
//
// This module deliberately has no local imports: it is loaded directly by the
// test runner, which cannot resolve the `@/` alias or a Next.js request.

const API_BASE_VAR = 'IMG_GEN_API_BASE'
const API_KEY_VAR = 'IMG_GEN_API_KEY'

/** Public model names. There is no other vocabulary on any surface. */
export const IMAGE_MODELS = ['flash', 'studio', 'vivid'] as const
export type ImageModel = (typeof IMAGE_MODELS)[number]

/** The service accepts exactly these five. */
const ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16'] as const

/** The app's own three-value vocabulary, mapped onto the service's. */
const ASPECT_ALIASES: Record<string, string> = {
  landscape: '16:9',
  portrait: '9:16',
  square: '1:1',
  auto: '1:1',
}

// Model ids that predate this migration. They are still sitting in user
// settings and on historical rows, so they are translated rather than
// forwarded (the service would reject them) and never rendered.
const LEGACY_MODELS: Record<string, ImageModel> = {
  'nano-banana': 'flash',
  'nano-banana-2': 'studio',
  'nano-banana-pro': 'studio',
  'imagen-4': 'vivid',
}

const DEFAULT_MODEL: ImageModel = 'studio'
const MAX_PROMPT_CHARS = 4000
const MAX_COUNT = 4
const MAX_REFERENCES = 10

// Polling. The route's own budget is 120s, so the loop must give up well before
// that or the client sees an empty-body 502 instead of a readable message.
const POLL_INTERVAL_MS = 2_500
const POLL_DEADLINE_MS = 95_000
const REQUEST_TIMEOUT_MS = 30_000

// ── Neutral, flat messages ──────────────────────────────────────────────────
// Every string a browser can receive from this module is in this block. None of
// them names a vendor, a model provider, an account or a credential.

const MSG = {
  credential:
    'This request carried an API credential. Credentials are held on the server — update the client and retry.',
  unconfigured: 'Image generation is not configured on this server.',
  noPrompt: 'A prompt is required.',
  longPrompt: `The prompt is too long — keep it under ${MAX_PROMPT_CHARS} characters.`,
  badRequest: 'The image request was rejected. Adjust the prompt or settings and try again.',
  rateLimited: 'The image service is busy or out of quota. Wait a moment and try again.',
  generationFailed: 'The image could not be generated. Try a different prompt.',
  noImages: 'No images were generated. Try a different prompt.',
  unavailable: 'The image service is unreachable. Please retry.',
  timedOut: 'Image generation took too long. Please retry.',
  failed: 'Image generation failed. Please retry.',
  upscaleUnsupported: 'Upscaling is not available for these images.',
  referenceUnsupported: 'Reference image uploads are not available.',
} as const

export interface ActionResult {
  status: number
  body: Record<string, unknown>
}

export interface ImageGenDeps {
  fetchImpl?: typeof fetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  pollIntervalMs?: number
  deadlineMs?: number
}

export interface GeneratedImage {
  url: string
  seed?: number
  /** Service-side id — usable as a `references` entry on a later generation. */
  id?: string
}

/** A failure whose message is always one of the neutral strings above. */
class ImageGenError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    Object.defineProperty(this, 'name', { value: 'ImageGenError', enumerable: false, configurable: true })
    this.status = status
  }
}

function fail(message: string, status: number): ActionResult {
  return { status, body: { success: false, error: message } }
}

// ── Credential rejection ────────────────────────────────────────────────────

const CREDENTIAL_FIELDS = ['apiToken', 'token', 'apiKey']

/**
 * A request that supplies a credential is REJECTED, not quietly ignored.
 *
 * Ignoring it would leave an un-migrated client working while its credential
 * keeps landing in access logs and `Referer` headers; rejecting it makes any
 * missed call site fail loudly in testing instead of quietly in production.
 * Presence of the field is the signal — an empty or null value still means the
 * caller has not been migrated.
 */
export function credentialRejection(input: {
  body?: unknown
  query?: URLSearchParams | null
}): ActionResult | null {
  const body = input.body
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const field of CREDENTIAL_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) return fail(MSG.credential, 400)
    }
  }
  const query = input.query
  if (query) {
    for (const field of CREDENTIAL_FIELDS) {
      if (query.has(field)) return fail(MSG.credential, 400)
    }
  }
  return null
}

// ── Request shaping ─────────────────────────────────────────────────────────

export function normalizeModel(value: unknown): ImageModel {
  if (typeof value !== 'string') return DEFAULT_MODEL
  const v = value.trim().toLowerCase()
  if ((IMAGE_MODELS as readonly string[]).includes(v)) return v as ImageModel
  return LEGACY_MODELS[v] || DEFAULT_MODEL
}

export function normalizeAspectRatio(value: unknown): string {
  if (typeof value !== 'string') return '1:1'
  const v = value.trim().toLowerCase()
  if ((ASPECT_RATIOS as readonly string[]).includes(v)) return v
  return ASPECT_ALIASES[v] || '1:1'
}

export function clampCount(value: unknown): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return 1
  return Math.min(Math.max(Math.trunc(n), 1), MAX_COUNT)
}

function config(): { base: string; key: string } {
  const base = (process.env[API_BASE_VAR] || '').trim().replace(/\/+$/, '')
  const key = (process.env[API_KEY_VAR] || '').trim()
  if (!base || !key) throw new ImageGenError(MSG.unconfigured, 500)
  return { base, key }
}

/**
 * Upstream status → our status + a fixed message. The upstream body is never
 * read for this: a service that echoes our key (or an account) into its own
 * error text must not be able to relay it to a browser.
 */
function mapStatus(status: number): ImageGenError {
  if (status === 400 || status === 422) return new ImageGenError(MSG.badRequest, 400)
  // A rejected or missing credential is an operator problem, not a user one.
  if (status === 401 || status === 403) return new ImageGenError(MSG.unconfigured, 500)
  if (status === 429) return new ImageGenError(MSG.rateLimited, 429)
  return new ImageGenError(MSG.failed, 502)
}

// ── Transport ───────────────────────────────────────────────────────────────

async function call(
  deps: ImageGenDeps,
  url: string,
  init: RequestInit & { headers: Record<string, string> }
): Promise<Record<string, unknown>> {
  const doFetch = deps.fetchImpl || fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await doFetch(url, { ...init, signal: controller.signal })
  } catch {
    // Deliberately swallowed: a fetch failure can carry the whole request —
    // headers included — in its message or cause.
    throw new ImageGenError(MSG.unavailable, 503)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw mapStatus(res.status)
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    throw new ImageGenError(MSG.failed, 502)
  }
}

function readImages(job: Record<string, unknown>): GeneratedImage[] {
  const raw = Array.isArray(job.images) ? (job.images as Record<string, unknown>[]) : []
  return raw
    .filter((i) => i && typeof i.url === 'string' && i.url)
    .map((i) => ({
      url: i.url as string,
      ...(typeof i.seed === 'number' ? { seed: i.seed } : {}),
      ...(typeof i.id === 'string' ? { id: i.id } : {}),
    }))
}

async function generate(body: Record<string, unknown>, deps: ImageGenDeps): Promise<ActionResult> {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) return fail(MSG.noPrompt, 400)
  if (prompt.length > MAX_PROMPT_CHARS) return fail(MSG.longPrompt, 400)

  const model = normalizeModel(body.model)
  const { base, key } = config()
  const headers = { 'Content-Type': 'application/json', 'X-API-Key': key }

  const payload: Record<string, unknown> = {
    model,
    aspectRatio: normalizeAspectRatio(body.aspectRatio),
    count: clampCount(body.count),
    prompt,
  }
  if (typeof body.seed === 'number' && Number.isFinite(body.seed)) payload.seed = body.seed
  if (Array.isArray(body.references)) {
    const refs = body.references.filter((r): r is string => typeof r === 'string' && !!r).slice(0, MAX_REFERENCES)
    if (refs.length) payload.references = refs
  }

  let job = await call(deps, `${base}/v1/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const jobId = typeof job.id === 'string' ? job.id : ''
  if (job.status !== 'done') {
    if (!jobId) throw new ImageGenError(MSG.failed, 502)
    job = await pollJob(jobId, base, key, deps)
  }

  const images = readImages(job)
  if (images.length === 0) return fail(MSG.noImages, 422)
  return { status: 200, body: { success: true, data: { images, model } } }
}

async function pollJob(
  jobId: string,
  base: string,
  key: string,
  deps: ImageGenDeps
): Promise<Record<string, unknown>> {
  const now = deps.now || Date.now
  const sleep = deps.sleep || ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const interval = deps.pollIntervalMs ?? POLL_INTERVAL_MS
  const deadline = now() + (deps.deadlineMs ?? POLL_DEADLINE_MS)

  while (now() < deadline) {
    await sleep(interval)
    const job = await call(deps, `${base}/v1/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: { 'X-API-Key': key },
    })
    if (job.status === 'done') return job
    // The job's own `error` string can name the underlying provider — it is read
    // for the decision and discarded, never relayed.
    if (job.status === 'failed' || job.status === 'error') throw new ImageGenError(MSG.generationFailed, 422)
  }
  throw new ImageGenError(MSG.timedOut, 504)
}

// ── Entry point ─────────────────────────────────────────────────────────────

/** The actions this module owns. Everything else belongs to the legacy path. */
const MIGRATED_ACTIONS = new Set(['generate', 'upscale', 'upload_asset'])

/**
 * Handles the three playground actions, or returns `null` for an action this
 * module does not own (the accounts tab, which still runs on the legacy path).
 *
 * `upscale` and `upload_asset` have no equivalent on this service: it exposes
 * no upscale endpoint, and `references` accepts ids of images it generated
 * itself rather than uploaded bytes. Both therefore answer with a neutral 501
 * instead of quietly calling somewhere else.
 */
export async function handleImageAction(
  action: unknown,
  body: Record<string, unknown>,
  deps: ImageGenDeps = {}
): Promise<ActionResult | null> {
  if (typeof action !== 'string' || !MIGRATED_ACTIONS.has(action)) return null
  // Defence in depth: the route rejects a credential-bearing request before it
  // gets here (that check also covers the query string and the legacy actions),
  // but a caller that reached this function with one is still refused rather
  // than served — the whole point of the migration is that no browser sends one.
  const rejected = credentialRejection({ body })
  if (rejected) return rejected
  if (action === 'upscale') return fail(MSG.upscaleUnsupported, 501)
  if (action === 'upload_asset') return fail(MSG.referenceUnsupported, 501)

  try {
    return await generate(body, deps)
  } catch (err) {
    if (err instanceof ImageGenError) return fail(err.message, err.status)
    // Anything else is ours, not the service's — still never relayed verbatim.
    return fail(MSG.failed, 500)
  }
}

/** True when the server can generate images at all (no credential revealed). */
export function imageGenConfigured(): boolean {
  return !!(process.env[API_BASE_VAR] || '').trim() && !!(process.env[API_KEY_VAR] || '').trim()
}
