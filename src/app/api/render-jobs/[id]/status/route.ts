import { NextRequest, NextResponse } from 'next/server'
import '@/lib/api-auth'
import { requireModule } from '@/lib/api-auth'
import { adgen } from '@/lib/adgen'
import { getRenderStatus } from '@/lib/renderMirror'
import { renderJobMirror } from '@/lib/server/renderJobMirror'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Progress check for a render.
 *
 * The campaign service pushes a webhook on TERMINAL transitions only, so this
 * is what moves the progress bar: the browser asks while its render card is
 * open, we ask the service, and the answer is mirrored onto the job document
 * the client's Firestore listener is already watching. It also settles a job
 * the service has lost track of.
 *
 * The browser's polling is bounded (`lib/renderPoll.ts`) and termination does
 * not depend on it — the sweep settles jobs nobody is watching.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireModule(request, 'accessImageGenerator')
  if (authError) return authError
  const { id } = await ctx.params

  const outcome = await getRenderStatus(id, {
    read: (docId) => renderJobMirror.read(docId),
    getJob: (adgenJobId) => adgen.getJob(adgenJobId),
    mirror: (docId, decide) => renderJobMirror.byDocId(docId, decide),
    nowMs: Date.now(),
  })

  if (!outcome.found) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  return NextResponse.json(outcome.job)
}
