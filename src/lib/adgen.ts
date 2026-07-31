// AdGen — the campaign-generation service WorkHub calls for planning, opening
// hooks and video rendering. Server-only: it holds a service credential and
// must never be imported into a client component.
//
// Configuration comes from the environment and is read on every call (never at
// module load), so a missing value fails loudly at the call site instead of
// baking an empty credential into the module. The credential is placed into a
// request header and nowhere else — no logging, no error message, no error
// property. `AdGenError` is deliberately narrow for that reason.

const API_BASE_VAR = 'ADGEN_API_BASE'
const API_KEY_VAR = 'ADGEN_API_KEY'

// Planning runs synchronously on the service side and takes ~10-20s; hooks are
// a single generation pass; job polling must stay snappy.
const TIMEOUT_PLAN_MS = 120_000
const TIMEOUT_DEFAULT_MS = 60_000
const TIMEOUT_POLL_MS = 15_000

export class AdGenError extends Error {
  /** HTTP status from AdGen, or the status class of a transport failure. */
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    // Non-enumerable, like the native Error properties: `status` stays the only
    // own enumerable key, so JSON.stringify-ing this error in a log can never
    // surface anything the constructor did not deliberately put on it.
    Object.defineProperty(this, 'name', { value: 'AdGenError', enumerable: false, configurable: true })
    this.status = status
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export type AdGenLanguage = 'en' | 'ar'
export type AdGenAspect = 'portrait' | 'landscape' | 'square'

export interface AdGenBrand {
  name: string
  colors: string[]
  logoUrl?: string
}

/** Optional content emphasis. AdGen infers "include this" from presence. */
export interface AdGenContent {
  link?: string
  includeHowTo?: boolean
  edge?: string
}

export interface AdGenBrief {
  brand: AdGenBrand
  goal: string
  audience: string
  tone: string
  language: AdGenLanguage
  market: string
  style: string
  aspect: AdGenAspect
  /** AdGen caps a campaign at 8 posts. */
  postCount: number
  content?: AdGenContent
  consistentIdentity?: boolean
  imageInstructions?: string
}

export interface AdGenPost {
  headline?: string
  body?: string
  caption: string
  hashtags: string[]
  imagePrompt: string
}

export interface AdGenCampaign {
  id: string
  posts: AdGenPost[]
  /** Present when `consistentIdentity` was requested. */
  artDirection?: string
}

export type AdGenHookStyle = 'question' | 'bold' | 'pain' | 'stat' | 'curiosity'

export interface AdGenHookOption {
  style: AdGenHookStyle
  lang: AdGenLanguage
  headline: string
  underline?: string
  kicker?: string
}

export interface AdGenHooksResult {
  options: AdGenHookOption[]
  /** True when AdGen served its 24h per-market cache. */
  cached?: boolean
}

export interface AdGenHooksParams {
  /** Market code — hooks are written in that market's language. */
  market?: string
  /** Bypass AdGen's 24h per-market cache. */
  force?: boolean
}

export interface AdGenVoiceover {
  enabled: boolean
  language?: AdGenLanguage
  gender?: 'male' | 'female' | 'mixed'
  /** Public voice id — nova · aria · sami · omar. */
  voice?: string
  model?: 'standard' | 'premium'
  rate?: number
  rateAuto?: boolean
  style?: string
}

export interface AdGenVideoOptions {
  aspect?: AdGenAspect
  mode?: 'basic' | 'creative'
  /** Market code — culture-adapts copy and narration. */
  market?: string
  language?: AdGenLanguage
  transition?: 'smooth' | 'simple' | 'none' | 'cinematic' | 'push'
  sfx?: { enabled: boolean }
  captions?: boolean
  subtitles?: boolean
  /** Arabic display font id. */
  arFont?: string
  /** Use a stock-footage clip behind the opening hook. */
  videoHook?: boolean
  /** Per-render brand-name override. */
  brandName?: string
  /** A hook picked from `hooks()`; omit to let AdGen write its own. */
  hook?: { headline: string; underline?: string; kicker?: string }
  voiceover?: AdGenVoiceover
  /** Restrict the showcase compositions AdGen rotates through. */
  sceneStyles?: string[]
}

export type AdGenJobStatus = 'queued' | 'rendering' | 'done' | 'failed' | 'cancelled'

export interface AdGenJob {
  status: AdGenJobStatus
  /** 0-100. */
  progress?: number
  stage?: string
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}

export interface AdGenCancelResult {
  ok?: boolean
  cancelled?: boolean
  status?: AdGenJobStatus
}

// ── Transport ───────────────────────────────────────────────────────────────

interface AdGenConfig {
  base: string
  key: string
}

/**
 * Resolve the service configuration. Throws rather than falling back to a
 * default base URL or an empty key — an unconfigured deployment must fail with
 * a message that says so, not with a downstream 401.
 */
function config(): AdGenConfig {
  const base = (process.env[API_BASE_VAR] || '').trim()
  const key = (process.env[API_KEY_VAR] || '').trim()
  if (!base) throw new AdGenError(`Campaign service is not configured (${API_BASE_VAR} is not set)`, 500)
  if (!key) throw new AdGenError(`Campaign service is not configured (${API_KEY_VAR} is not set)`, 500)
  return { base: base.replace(/\/+$/, ''), key }
}

/** Remove the credential from text that is about to be stored or displayed. */
function redact(text: string, key: string): string {
  return key ? text.split(key).join('[redacted]') : text
}

interface RequestInit_ {
  method: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  timeoutMs?: number
}

async function request<T>(path: string, init: RequestInit_): Promise<T> {
  const { base, key } = config()

  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      method: init.method,
      // The credential lives here and only here. Nothing below reads it back.
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_DEFAULT_MS),
      cache: 'no-store',
    })
  } catch (e) {
    // Deliberately does NOT wrap or quote the underlying error: a fetch failure
    // can carry the request (headers included) in its message or `cause`.
    const name = (e as Error | undefined)?.name
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new AdGenError('Campaign service timed out', 504)
    }
    throw new AdGenError('Campaign service is unreachable', 503)
  }

  const text = await res.text().catch(() => '')
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    const flat = json as { error?: unknown } | null
    const message = typeof flat?.error === 'string' && flat.error.trim()
      ? flat.error.trim()
      : `Campaign service error (HTTP ${res.status})`
    // AdGen's message is passed through to `planError` and on to the browser.
    // An auth error can quote the credential back at us ("key ... is revoked"),
    // so scrub it before it can be stored or displayed.
    throw new AdGenError(redact(message, key), res.status)
  }

  return (json ?? {}) as T
}

// ── Methods ─────────────────────────────────────────────────────────────────

/** Plan a campaign from a brief. Synchronous on AdGen's side (~10-20s). */
export function createCampaign(brief: AdGenBrief): Promise<AdGenCampaign> {
  return request<AdGenCampaign>('/v1/campaigns', { method: 'POST', body: brief, timeoutMs: TIMEOUT_PLAN_MS })
}

/** Opening-hook options for a campaign, in the market's language. */
export function hooks(campaignId: string, params: AdGenHooksParams = {}): Promise<AdGenHooksResult> {
  return request<AdGenHooksResult>(`/v1/campaigns/${encodeURIComponent(campaignId)}/hooks`, {
    method: 'POST',
    body: { ...(params.market ? { market: params.market } : {}), ...(params.force ? { force: true } : {}) },
  })
}

/** Queue a campaign video render. Returns the job to poll with `getJob`. */
export function renderVideo(campaignId: string, options: AdGenVideoOptions = {}): Promise<{ jobId: string }> {
  return request<{ jobId: string }>(`/v1/campaigns/${encodeURIComponent(campaignId)}/video`, {
    method: 'POST',
    body: options,
  })
}

/** Poll a render job. */
export function getJob(jobId: string): Promise<AdGenJob> {
  return request<AdGenJob>(`/v1/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', timeoutMs: TIMEOUT_POLL_MS })
}

/** Cancel a render job. */
export function cancelJob(jobId: string): Promise<AdGenCancelResult> {
  return request<AdGenCancelResult>(`/v1/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
    timeoutMs: TIMEOUT_POLL_MS,
  })
}

/** Fetch a campaign AdGen already planned. */
export function getCampaign(campaignId: string): Promise<AdGenCampaign> {
  return request<AdGenCampaign>(`/v1/campaigns/${encodeURIComponent(campaignId)}`, { method: 'GET' })
}

export const adgen = { createCampaign, hooks, renderVideo, getJob, cancelJob, getCampaign }
