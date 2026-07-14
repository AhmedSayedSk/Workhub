import { NextRequest, NextResponse } from 'next/server'
import { rollupSystemHourly } from '@/lib/server/vps/metrics'
import { SERVERS } from '@/lib/server/vps/servers'

// Secret-gated hourly rollup hit by a host cron. Averages the last ~60 per-minute
// per-system samples into one vpsSystemHourly doc (and prunes >35d old).
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.INTERNAL_API_TOKEN || secret !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const results = []
    for (const s of SERVERS) {
      const doc = await rollupSystemHourly(s.id)
      results.push({ serverId: s.id, systems: Object.keys(doc.systems).length })
    }
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
