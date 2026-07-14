import { NextRequest, NextResponse } from 'next/server'
import { isOwnerRequest } from '@/lib/server/vps/owner'
import { collectVpsStats } from '@/lib/server/vps/collect'
import { getServer } from '@/lib/server/vps/servers'
import { readSnapshot } from '@/lib/server/vps/metrics'

// Owner-only VPS ops stats. Reads host /proc + statfs, the read-only docker
// socket proxy, and TLS cert expiry. Never cached at the edge.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!(await isOwnerRequest(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const serverId = new URL(request.url).searchParams.get('serverId') || 'primary'
  const server = getServer(serverId)
  if (!server) return NextResponse.json({ error: 'unknown server' }, { status: 404 })
  try {
    if (server.mode === 'local') {
      const stats = await collectVpsStats()
      return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } })
    }
    const snap = await readSnapshot(serverId)
    if (!snap) return NextResponse.json({ error: 'no report yet', pending: true }, { status: 404 })
    return NextResponse.json(
      { ...snap.stats, remote: true, receivedAtMs: snap.receivedAtMs },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    return NextResponse.json({ error: 'Failed to collect VPS stats', detail: String(err) }, { status: 500 })
  }
}
