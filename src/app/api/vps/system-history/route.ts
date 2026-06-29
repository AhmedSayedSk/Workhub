import { NextRequest, NextResponse } from 'next/server'
import { isOwnerRequest } from '@/lib/server/vps/owner'
import { readSystemHistory } from '@/lib/server/vps/metrics'

// Owner-only per-system time-series. ?system=<id>&range=24h|3d|7d|30d.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!(await isOwnerRequest(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const url = new URL(request.url)
  const system = url.searchParams.get('system') || ''
  const range = url.searchParams.get('range') || '24h'
  if (!system) {
    return NextResponse.json({ error: 'missing system' }, { status: 400 })
  }
  try {
    const points = await readSystemHistory(system, range)
    return NextResponse.json({ system, range, points }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
