import { NextRequest, NextResponse } from 'next/server'
import { isOwnerRequest } from '@/lib/server/vps/owner'
import { readHistory } from '@/lib/server/vps/metrics'

// Owner-only time-series history for the charts. ?range=1h|24h|7d.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!(await isOwnerRequest(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const url = new URL(request.url)
  const range = url.searchParams.get('range') || '24h'
  const serverId = url.searchParams.get('serverId') || 'primary'
  try {
    const points = await readHistory(range, serverId)
    return NextResponse.json({ range, serverId, points }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
