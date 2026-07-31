// How often a browser asks for render progress, and when it stops asking.
//
// The campaign service pushes a webhook only when a render finishes, so the
// progress bar is driven by the browser polling `/api/render-jobs/[id]/status`.
// A fixed interval is fine for a healthy render and terrible for a stuck one:
// at four seconds it is ~21,600 requests per viewer per day, forever.
//
// So the schedule decays and then stops. Stopping is safe because the sweep
// (`/api/render-jobs/sweep`) settles abandoned jobs server-side without any
// browser involved — the poll is there to make progress *visible*, not to be
// the thing that terminates a render.

/** Frequent enough that the bar moves smoothly for a normal render. */
const FAST_MS = 4_000
const FAST_UNTIL = 45 // 45 × 4s = 3 minutes

/** A render running past three minutes is long, not broken. */
const STEADY_MS = 10_000
const STEADY_UNTIL = 105 // + 60 × 10s = 13 minutes

/** Past thirteen minutes something is wrong; keep a heartbeat, cheaply. */
const SLOW_MS = 30_000
const SLOW_UNTIL = 165 // + 60 × 30s = 43 minutes

/** Total requests one viewer can make about one render. */
export const MAX_POLL_ATTEMPTS = SLOW_UNTIL

/**
 * Delay before poll number `attempt` (1-based), or `null` to stop polling.
 * Roughly 165 requests over 43 minutes, against 21,600/day for a flat 4s.
 */
export function pollDelayMs(attempt: number): number | null {
  if (!Number.isFinite(attempt) || attempt < 1) return FAST_MS
  if (attempt < FAST_UNTIL) return FAST_MS
  if (attempt < STEADY_UNTIL) return STEADY_MS
  if (attempt < SLOW_UNTIL) return SLOW_MS
  return null
}
