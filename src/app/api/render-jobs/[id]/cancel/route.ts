import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth'
import { requireModule } from '@/lib/api-auth'
import { adgen, AdGenError } from '@/lib/adgen'
import { cancelPatch, cancelRoute, mapAdgenCancel, mapAdgenCancelError, type CancelResult } from '@/lib/cancelRender'
import { isTerminalStatus } from '@/lib/renderMirror'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const db = () => admin.firestore()

// Stops a running/queued campaign video render.
//
// Renders now run on AdGen, so the authoritative stop is a DELETE there — but
// the Firestore doc is still what the UI watches, so we mirror the outcome
// immediately rather than waiting for the terminal webhook. Jobs created before
// the migration have no adgenJobId and keep the original Firestore-only
// behaviour, since the legacy worker is still what renders them.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireModule(request, 'accessImageGenerator')
  if (authError) return authError
  const { id } = await ctx.params
  const ref = db().collection('renderJobs').doc(id)

  try {
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    const job = snap.data() as { status?: unknown; adgenJobId?: unknown }

    const route = cancelRoute(job)
    if (route === 'settled') return NextResponse.json({ result: 'settled' })

    // Legacy: the worker only ever claims 'queued', so that transition is safe
    // to make final here; a rendering job aborts at its next checkpoint.
    if (route === 'legacy') {
      const result = await db().runTransaction(async (tx) => {
        const fresh = await tx.get(ref)
        if (!fresh.exists) return 'missing' as const
        const j = fresh.data() as { status?: unknown }
        if (j.status === 'queued') {
          tx.update(ref, cancelPatch('cancelled', Date.now())!)
          return 'cancelled' as const
        }
        if (j.status === 'rendering') {
          tx.update(ref, cancelPatch('requested', Date.now())!)
          return 'requested' as const
        }
        return 'settled' as const
      })
      if (result === 'missing') return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      return NextResponse.json({ result })
    }

    let result: CancelResult
    try {
      result = mapAdgenCancel(await adgen.cancelJob(job.adgenJobId as string))
    } catch (err) {
      const mapped = err instanceof AdGenError ? mapAdgenCancelError(err.status) : null
      // A transport failure or a 5xx is NOT a cancel. Reporting success here
      // would clear the spinner while the render carried on and still billed.
      if (mapped === null) return NextResponse.json({ error: 'Could not cancel' }, { status: 500 })
      result = mapped
    }

    const patch = cancelPatch(result, Date.now())
    if (patch) {
      // Re-read inside the transaction: a terminal webhook may have landed
      // while the DELETE was in flight, and it wins — the mirror already
      // renders a stopped job as 'cancelled', so nothing is lost by deferring.
      await db().runTransaction(async (tx) => {
        const fresh = await tx.get(ref)
        if (!fresh.exists) return
        if (isTerminalStatus((fresh.data() as { status?: unknown }).status)) return
        tx.update(ref, patch)
      })
    }
    return NextResponse.json({ result })
  } catch {
    return NextResponse.json({ error: 'Could not cancel' }, { status: 500 })
  }
}
