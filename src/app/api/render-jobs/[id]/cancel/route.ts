import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth'
import { requireModule } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
const db = () => admin.firestore()

// Stops a running/queued campaign video render. Queued jobs are cancelled
// immediately (the worker only claims 'queued'); rendering jobs get
// cancelRequested — the worker aborts at its next progress checkpoint.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireModule(request, 'accessImageGenerator')
  if (authError) return authError
  const { id } = await ctx.params
  const ref = db().collection('renderJobs').doc(id)
  try {
    const result = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return 'missing'
      const j = snap.data() as any
      if (j.status === 'queued') {
        tx.update(ref, { status: 'cancelled', stage: 'cancelled', cancelRequested: true, finishedAt: Date.now() })
        return 'cancelled'
      }
      if (j.status === 'rendering') {
        tx.update(ref, { cancelRequested: true })
        return 'requested'
      }
      return 'settled'
    })
    if (result === 'missing') return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    return NextResponse.json({ result })
  } catch {
    return NextResponse.json({ error: 'Could not cancel' }, { status: 500 })
  }
}
