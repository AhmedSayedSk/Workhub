import type { MetricPoint } from './types'

// The servers-list card and the detail Resource Monitor must agree. The detail
// headline is the last point of the once-a-minute rolling series (vpsMetrics);
// the card historically used the LIVE reading from collectHost()/the pushed
// snapshot, whose CPU is a single ~1s /proc/stat window. That window is
// phase-locked to the metrics sampler's own once-a-minute CPU burst, so on an
// otherwise idle box it reads 50-90% while the true duty cycle is a few percent
// (see rollingCpuPct in host.ts, which exists precisely to average this out).
//
// So the card showed e.g. 71% while the detail showed 8%. This makes the card
// use the SAME rolling sample the detail shows, falling back to the live reading
// only for a server's first minute, before any sample exists.

export interface CardPct {
  cpuPct: number | null
  memPct: number | null
  diskPct: number | null
}

const numOr = (v: unknown, fallback: number | null): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

export function cardPct(live: CardPct, latest: MetricPoint | null): CardPct {
  if (!latest) return live
  return {
    cpuPct: numOr(latest.cpuPct, live.cpuPct),
    memPct: numOr(latest.memPct, live.memPct),
    diskPct: numOr(latest.diskPct, live.diskPct),
  }
}
