import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth'
import { requireModule } from '@/lib/api-auth'
import { adgen } from '@/lib/adgen'
import { decideMirror, isTerminalStatus, type RenderJobSnapshot } from '@/lib/adgenWebhook'
import { mirrorByDocId } from '@/lib/adgenMirror'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const db = () => admin.firestore()

/**
 * How long a render job may sit without an id from the campaign service before
 * we call it a failed start. Only reachable if the process died between
 * creating the document and receiving the service's reply.
 */
const START_GRACE_MS = 90_000

interface JobDoc extends RenderJobSnapshot {
  adgenJobId?: string
  engine?: string
  createdAt?: number
}

/** The fields the campaign UI renders. Internal ids are not part of this. */
function publicView(id: string, j: JobDoc) {
  return {
    id,
    status: j.status ?? 'queued',
    progress: j.progress ?? 0,
    stage: j.stage ?? 'preparing',
    ...(j.videoUrl ? { videoUrl: j.videoUrl } : {}),
    ...(j.thumbnailUrl ? { thumbnailUrl: j.thumbnailUrl } : {}),
    ...(j.error ? { error: j.error } : {}),
  }
}

/**
 * Progress check for a render.
 *
 * The campaign service pushes a webhook on TERMINAL transitions only, so this
 * is what actually moves the progress bar: the browser asks while its render
 * card is open, we ask the service, and the answer is mirrored onto the job
 * document that the client's Firestore listener is already watching. It doubles
 * as the recovery path for a webhook that never arrived — without it a missed
 * delivery would leave the card spinning until the retry schedule caught up
 * hours later.
 *
 * Cheap by construction: no work at all once the job is settled, and the write
 * is skipped whenever nothing actually changed.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireModule(request, 'accessImageGenerator')
  if (authError) return authError
  const { id } = await ctx.params

  const ref = db().collection('renderJobs').doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  const job = snap.data() as JobDoc

  // Settled: nothing to ask, nothing to write.
  if (isTerminalStatus(job.status)) return NextResponse.json(publicView(id, job))

  if (!job.adgenJobId) {
    // A job started on the campaign service always gets an id back within
    // seconds. If one never landed, the start failed somewhere we could not
    // report it — settle it rather than spin forever. Jobs from the previous
    // render worker (no `engine`) are left alone: that worker writes them itself.
    if (job.engine === 'adgen' && Date.now() - (job.createdAt ?? Date.now()) > START_GRACE_MS) {
      const patch = { status: 'failed', error: 'The render never started — try again', finishedAt: Date.now() }
      await mirrorByDocId(id, (cur) => (isTerminalStatus(cur.status) ? null : patch))
      return NextResponse.json(publicView(id, { ...job, ...patch }))
    }
    return NextResponse.json(publicView(id, job))
  }

  let applied: Record<string, unknown> | null = null
  try {
    const remote = await adgen.getJob(job.adgenJobId)
    const nowMs = Date.now()
    await mirrorByDocId(id, (current) => {
      applied = decideMirror(current, remote, { nowMs })
      return applied
    })
  } catch {
    // A hiccup on the service side is not a UI failure — return the last known
    // state and let the next poll (or the webhook) settle it.
  }

  return NextResponse.json(publicView(id, { ...job, ...(applied ?? {}) }))
}
