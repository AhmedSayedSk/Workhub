import { NextRequest, NextResponse } from 'next/server'
import { isOwnerRequest } from '@/lib/server/vps/owner'
import { collectVpsStats } from '@/lib/server/vps/collect'

// Owner-only VPS ops stats. Reads host /proc + statfs, the read-only docker
// socket proxy, and TLS cert expiry. Never cached at the edge.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!(await isOwnerRequest(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const stats = await collectVpsStats()
    return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to collect VPS stats', detail: String(err) }, { status: 500 })
  }
}
