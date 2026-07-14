import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server/vps/servers'
import { storeSnapshot, storePushedSample } from '@/lib/server/vps/metrics'
import type { VpsStats, MetricPoint } from '@/lib/server/vps/types'

// Secret-gated ingest for remote server agents. Body: { stats, sample }.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.INTERNAL_API_TOKEN || secret !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const serverId = new URL(req.url).searchParams.get('serverId') || ''
  const server = getServer(serverId)
  if (!server || server.mode !== 'remote') {
    return NextResponse.json({ error: 'unknown or non-remote serverId' }, { status: 400 })
  }
  let body: { stats?: VpsStats; sample?: MetricPoint }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.stats || typeof body.stats !== 'object') {
    return NextResponse.json({ error: 'missing stats' }, { status: 400 })
  }
  try {
    await storeSnapshot(serverId, body.stats)
    if (body.sample) await storePushedSample(serverId, body.sample)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
