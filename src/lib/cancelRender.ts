// Deciding what a Stop press means, kept out of the route so it is testable
// without Firestore or the network.
//
// WorkHub's cancel endpoint has always answered with exactly three words, and
// the UI branches on them, so the vocabulary is frozen:
//   'cancelled' — the job is over now; nothing will render.
//   'requested' — a render is in flight; it stops at its next checkpoint.
//   'settled'   — there was nothing left to stop.
//
// AdGen speaks a near-identical dialect ({status:'cancelled'|'cancelling'}, 409
// once a job has finished), which is unsurprising — its worker was ported from
// this repo's campaign-renderer. The mapping below is the whole translation.
// Deliberately a LEAF: no local runtime imports. renderMirror.ts is built the
// same way, because a value import between two test-loaded modules would hand
// webpack a `.ts` specifier — see task-2-report.md. The terminal set is three
// strings; duplicating it costs less than breaking that containment.
const TERMINAL_STATUSES = new Set(['done', 'failed', 'cancelled'])

export type CancelResult = 'cancelled' | 'requested' | 'settled'

export interface CancelJobSnapshot {
  status?: unknown
  adgenJobId?: unknown
}

/** The write to apply for an outcome, or null to leave the doc alone. */
export function cancelPatch(result: CancelResult, now: number): Record<string, unknown> | null {
  if (result === 'cancelled') {
    return { status: 'cancelled', stage: 'cancelled', cancelRequested: true, finishedAt: now }
  }
  // 'requested': flag it and let the render's own terminal event settle it.
  // Task 2's mirror turns ANY terminal outcome for a flagged job into
  // 'cancelled', so a completion that crosses the Stop in flight cannot
  // resurrect the job or surface a video the user already rejected.
  if (result === 'requested') return { cancelRequested: true }
  // 'settled': the job is already finished. Writing cancelRequested here would
  // relabel a legitimately completed render as cancelled the next time anything
  // mirrored it, so a settled job is left exactly as it is.
  return null
}

/**
 * Maps AdGen's cancel reply onto WorkHub's three words.
 * `status` is AdGen's 2xx body; `httpStatus` is set instead when it errored.
 */
export function mapAdgenCancel(reply: { status?: unknown }): CancelResult {
  // Anything that is not the immediate kill is a request: AdGen returns
  // 'cancelling' when a worker already holds the job. Treating an unrecognised
  // value as 'requested' is the safe default — it keeps the job under the
  // cancelRequested rule rather than declaring an outcome we did not get.
  return reply?.status === 'cancelled' ? 'cancelled' : 'requested'
}

/**
 * A cancel that AdGen refused. 409 means the job finished before the Stop
 * arrived; 404 means AdGen has no such job, which for us is equally over —
 * there is nothing left that could still produce a video.
 */
export function mapAdgenCancelError(httpStatus: number): CancelResult | null {
  if (httpStatus === 409 || httpStatus === 404) return 'settled'
  return null // a real failure — the caller surfaces 500 and writes nothing
}

/**
 * What to do before calling out: a job that is already terminal, or one with no
 * AdGen id (a pre-migration doc rendered by the legacy worker), never reaches
 * the service.
 */
export function cancelRoute(job: CancelJobSnapshot): 'settled' | 'legacy' | 'adgen' {
  if (typeof job.status === 'string' && TERMINAL_STATUSES.has(job.status)) return 'settled'
  return typeof job.adgenJobId === 'string' && job.adgenJobId ? 'adgen' : 'legacy'
}
