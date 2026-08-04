import { NextRequest, NextResponse } from 'next/server'
import { isOwnerRequest } from '@/lib/server/vps/owner'
import { collectVpsStats } from '@/lib/server/vps/collect'
import { getServer } from '@/lib/server/vps/servers'
import { readSnapshot } from '@/lib/server/vps/metrics'
import type { VpsStats } from '@/lib/server/vps/types'

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
    // The registry owns the addresses for BOTH modes: a remote snapshot is
    // written by the agent, which knows the box it runs on but not how this
    // deployment is meant to label it — so one .env here stays the only place
    // an IP is configured.
    const withIps = (stats: VpsStats) => ({ ...stats, meta: { ...stats.meta, ips: server.ips } })

    if (server.mode === 'local') {
      const stats = await collectVpsStats()
      return NextResponse.json(withIps(stats), { headers: { 'Cache-Control': 'no-store' } })
    }
    const snap = await readSnapshot(serverId)
    if (!snap) return NextResponse.json({ error: 'no report yet', pending: true }, { status: 404 })
    return NextResponse.json(
      { ...withIps(snap.stats), remote: true, receivedAtMs: snap.receivedAtMs },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    return NextResponse.json({ error: 'Failed to collect VPS stats', detail: String(err) }, { status: 500 })
  }
}
