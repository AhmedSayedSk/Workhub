import { NextRequest, NextResponse } from 'next/server'
import '@/lib/api-auth'
import { adgen } from '@/lib/adgen'
import { settleRenderJob } from '@/lib/renderMirror'
import { renderJobMirror } from '@/lib/server/renderJobMirror'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Settle renders nobody is watching.
 *
 * Every other path to a terminal state needs something to happen: a webhook to
 * be delivered, or a browser tab to stay open and poll. Neither is guaranteed —
 * a delivery can be lost in the window before the job's service id is stored,
 * and a user can close the tab. This is the one that always runs.
 *
 * Cheap and idempotent: one query, then at most one service call per unsettled
 * job, and a write only when something actually changed. Safe to run every few
 * minutes from the same scheduler that drives the social cron.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!process.env.META_CRON_SECRET || secret !== process.env.META_CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const jobs = await renderJobMirror.unsettled()
  const nowMs = Date.now()
  let settled = 0
  let updated = 0

  for (const job of jobs) {
    try {
      const { patch } = await settleRenderJob(job, {
        getJob: (adgenJobId) => adgen.getJob(adgenJobId),
        mirror: (docId, decide) => renderJobMirror.byDocId(docId, decide),
        nowMs,
      })
      if (!patch) continue
      if (patch.finishedAt) settled++
      else updated++
    } catch {
      // One bad job must not stop the pass.
    }
  }

  return NextResponse.json({ checked: jobs.length, settled, updated })
}
