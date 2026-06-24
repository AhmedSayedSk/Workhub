import { NextRequest, NextResponse } from 'next/server'
import { sampleAndStore } from '@/lib/server/vps/metrics'

// Secret-gated sampler hit once a minute by a host cron. Writes one metric
// snapshot to Firestore so the dashboard charts have persistent history.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.INTERNAL_API_TOKEN || secret !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const point = await sampleAndStore()
    return NextResponse.json({ ok: true, ts: point.ts })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
