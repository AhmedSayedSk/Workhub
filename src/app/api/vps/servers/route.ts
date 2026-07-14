import { NextRequest, NextResponse } from 'next/server'
import { isOwnerRequest } from '@/lib/server/vps/owner'
import { SERVERS } from '@/lib/server/vps/servers'
import { collectVpsStats } from '@/lib/server/vps/collect'
import { readSnapshot } from '@/lib/server/vps/metrics'
import type { ServerSummary, VpsStats } from '@/lib/server/vps/types'

export const dynamic = 'force-dynamic'
const STALE_MS = 3 * 60 * 1000 // > 3× the ~60s push interval → offline

function summarize(stats: VpsStats) {
  const h = stats.host
  const pct = (u: number, t: number) => (t > 0 ? Math.round((u / t) * 1000) / 10 : null)
  return {
    cpuPct: h ? h.cpu.usagePct : null,
    memPct: h ? pct(h.memory.usedBytes, h.memory.totalBytes) : null,
    diskPct: h ? pct(h.disk.usedBytes, h.disk.totalBytes) : null,
    alertCount: stats.alerts?.length ?? 0,
  }
}

export async function GET(request: NextRequest) {
  if (!(await isOwnerRequest(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const out: ServerSummary[] = []
  for (const s of SERVERS) {
    const base = { id: s.id, name: s.name, subtitle: s.subtitle, mode: s.mode }
    try {
      if (s.mode === 'local') {
        const stats = await collectVpsStats()
        out.push({ ...base, online: true, updatedAtMs: stats.generatedAtMs, ...summarize(stats) })
      } else {
        const snap = await readSnapshot(s.id)
        if (!snap) {
          out.push({ ...base, online: false, updatedAtMs: null, cpuPct: null, memPct: null, diskPct: null, alertCount: 0 })
        } else {
          const online = Date.now() - snap.receivedAtMs < STALE_MS
          out.push({ ...base, online, updatedAtMs: snap.receivedAtMs, ...summarize(snap.stats) })
        }
      }
    } catch {
      out.push({ ...base, online: false, updatedAtMs: null, cpuPct: null, memPct: null, diskPct: null, alertCount: 0 })
    }
  }
  return NextResponse.json({ servers: out }, { headers: { 'Cache-Control': 'no-store' } })
}
