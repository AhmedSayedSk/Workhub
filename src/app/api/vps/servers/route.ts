import { NextRequest, NextResponse } from 'next/server'
import { isOwnerRequest } from '@/lib/server/vps/owner'
import { SERVERS } from '@/lib/server/vps/servers'
import { collectHost } from '@/lib/server/vps/host'
import { listContainersLite } from '@/lib/server/vps/docker'
import { evaluateAlerts } from '@/lib/server/vps/alerts'
import { readSnapshot, readLatestSamples } from '@/lib/server/vps/metrics'
import { cardPct } from '@/lib/server/vps/cardMetrics'
import { collectPublicIps } from '@/lib/server/vps/ips'
import type { ServerSummary, VpsStats } from '@/lib/server/vps/types'

export const dynamic = 'force-dynamic'
const STALE_MS = 3 * 60 * 1000 // > 3× the ~60s push interval → offline

const pctOf = (u: number, t: number) => (t > 0 ? Math.round((u / t) * 1000) / 10 : null)

// Null metrics for a server that's offline / never reported / errored.
const EMPTY = {
  cpuPct: null, memPct: null, diskPct: null, alertCount: 0,
  cpuCores: null, memTotalBytes: null, diskTotalBytes: null, containers: null,
}

// Remote server: summarise from the last pushed snapshot (a full VpsStats).
function summarizeSnapshot(stats: VpsStats) {
  const h = stats.host
  return {
    cpuPct: h ? h.cpu.usagePct : null,
    memPct: h ? pctOf(h.memory.usedBytes, h.memory.totalBytes) : null,
    diskPct: h ? pctOf(h.disk.usedBytes, h.disk.totalBytes) : null,
    alertCount: stats.alerts?.length ?? 0,
    cpuCores: h ? h.cpu.cores : null,
    memTotalBytes: h ? h.memory.totalBytes : null,
    diskTotalBytes: h ? h.disk.totalBytes : null,
    containers: stats.containers ? stats.containers.length : null,
  }
}

// Local server: a LIGHTWEIGHT live summary computed the same way the detail view
// samples CPU/mem/disk (collectHost → a real ~1s CPU sample) plus a cheap
// container count. Deliberately skips the heavy certs/apps/security collection so
// the list can poll in real time. (Cert-expiry alerts therefore only surface on
// the detail page, not on the card badge — disk/mem/container-down still do.)
async function summarizeLocal() {
  const [host, containers] = await Promise.all([collectHost(), listContainersLite().catch(() => [])])
  const alerts = evaluateAlerts({ host, certs: null, containers })
  return {
    cpuPct: host.cpu.usagePct,
    memPct: pctOf(host.memory.usedBytes, host.memory.totalBytes),
    diskPct: pctOf(host.disk.usedBytes, host.disk.totalBytes),
    alertCount: alerts.length,
    cpuCores: host.cpu.cores,
    memTotalBytes: host.memory.totalBytes,
    diskTotalBytes: host.disk.totalBytes,
    containers: containers.length,
  }
}

export async function GET(request: NextRequest) {
  if (!(await isOwnerRequest(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // The rolling once-a-minute sample per server (what the detail view shows).
  // The card's own live/snapshot CPU is a 1s window phase-locked to the sampler
  // burst and reads far too high; cardPct() prefers this rolling value.
  const samples = await readLatestSamples().catch(() => ({}) as Awaited<ReturnType<typeof readLatestSamples>>)

  const out: ServerSummary[] = []
  for (const s of SERVERS) {
    const base = { id: s.id, name: s.name, subtitle: s.subtitle, mode: s.mode, ips: s.ips }
    try {
      if (s.mode === 'local') {
        const sum = await summarizeLocal()
        // Same precedence as the detail route: addresses read off the host beat
        // the configured VPS*_PUBLIC_IP, so the card and the page it links to
        // never disagree about how many addresses this box has.
        const detected = await collectPublicIps().catch(() => null)
        out.push({
          ...base,
          ips: detected?.ips.length ? detected.ips : s.ips,
          online: true,
          updatedAtMs: Date.now(),
          ...sum,
          ...cardPct(sum, samples[s.id] ?? null),
        })
      } else {
        const snap = await readSnapshot(s.id)
        if (!snap) {
          out.push({ ...base, online: false, updatedAtMs: null, ...EMPTY })
        } else {
          const online = Date.now() - snap.receivedAtMs < STALE_MS
          const sum = summarizeSnapshot(snap.stats)
          const reported = snap.stats.meta?.ips
          out.push({
            ...base,
            ips: reported?.length ? reported : s.ips,
            online,
            updatedAtMs: snap.receivedAtMs,
            ...sum,
            ...cardPct(sum, samples[s.id] ?? null),
          })
        }
      }
    } catch {
      out.push({ ...base, online: false, updatedAtMs: null, ...EMPTY })
    }
  }
  return NextResponse.json({ servers: out }, { headers: { 'Cache-Control': 'no-store' } })
}
