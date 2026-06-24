import type { ContainerStat, StorageStats } from './types'

// Client for the read-only docker-socket-proxy sidecar (workhub-dockerproxy).
// The proxy exposes the Docker Engine API over HTTP with a GET-only allowlist,
// so WorkHub never touches the raw socket.

const BASE = process.env.DOCKER_PROXY_URL || 'http://workhub-dockerproxy:2375'

async function dockerGet<T>(path: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`docker ${path} -> ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

// --- /system/df → storage breakdown ---------------------------------------
interface DfResponse {
  Images?: Array<{ Size?: number; SharedSize?: number }>
  Containers?: Array<{ SizeRw?: number }>
  Volumes?: Array<{ UsageData?: { Size?: number } }>
  BuildCache?: Array<{ Size?: number }>
}

export function parseStorage(df: DfResponse): StorageStats {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + (b || 0), 0)
  return {
    imagesBytes: sum((df.Images || []).map((i) => i.Size || 0)),
    containersBytes: sum((df.Containers || []).map((c) => c.SizeRw || 0)),
    volumesBytes: sum((df.Volumes || []).map((v) => v.UsageData?.Size || 0)),
    buildCacheBytes: sum((df.BuildCache || []).map((b) => b.Size || 0)),
  }
}

// --- per-container live stats ---------------------------------------------
interface DockerStats {
  cpu_stats?: CpuBlock
  precpu_stats?: CpuBlock
  memory_stats?: {
    usage?: number
    limit?: number
    stats?: { cache?: number; inactive_file?: number }
  }
  networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }>
}
interface CpuBlock {
  cpu_usage?: { total_usage?: number; percpu_usage?: number[] }
  system_cpu_usage?: number
  online_cpus?: number
}

// Docker's documented CPU% formula across two samples embedded in one response.
export function computeCpuPct(s: DockerStats): number {
  const cpu = s.cpu_stats
  const pre = s.precpu_stats
  if (!cpu?.cpu_usage || !pre?.cpu_usage) return 0
  const cpuDelta = (cpu.cpu_usage.total_usage || 0) - (pre.cpu_usage.total_usage || 0)
  const sysDelta = (cpu.system_cpu_usage || 0) - (pre.system_cpu_usage || 0)
  const onlineCpus = cpu.online_cpus || cpu.cpu_usage.percpu_usage?.length || 1
  if (sysDelta <= 0 || cpuDelta < 0) return 0
  const pct = (cpuDelta / sysDelta) * onlineCpus * 100
  return Math.round(pct * 10) / 10
}

export function computeMem(s: DockerStats): { used: number; limit: number } {
  const m = s.memory_stats
  if (!m?.usage) return { used: 0, limit: m?.limit || 0 }
  // Subtract page cache to match `docker stats`.
  const cache = m.stats?.inactive_file ?? m.stats?.cache ?? 0
  return { used: Math.max(0, m.usage - cache), limit: m.limit || 0 }
}

export function sumNet(s: DockerStats): { rx: number; tx: number } {
  let rx = 0
  let tx = 0
  for (const n of Object.values(s.networks || {})) {
    rx += n.rx_bytes || 0
    tx += n.tx_bytes || 0
  }
  return { rx, tx }
}

interface ContainerSummary {
  Id: string
  Names: string[]
  Image: string
  State: string
  Status: string
}

export async function collectContainers(): Promise<ContainerStat[]> {
  const list = await dockerGet<ContainerSummary[]>('/containers/json')
  // Fetch each container's single-shot stats in parallel.
  const stats = await Promise.all(
    list.map(async (c) => {
      try {
        const s = await dockerGet<DockerStats>(`/containers/${c.Id}/stats?stream=false`, 6000)
        const mem = computeMem(s)
        const net = sumNet(s)
        return {
          id: c.Id.slice(0, 12),
          name: (c.Names?.[0] || c.Id).replace(/^\//, ''),
          image: c.Image,
          state: c.State,
          status: c.Status,
          cpuPct: computeCpuPct(s),
          memUsedBytes: mem.used,
          memLimitBytes: mem.limit,
          netRxBytes: net.rx,
          netTxBytes: net.tx,
        } as ContainerStat
      } catch {
        return {
          id: c.Id.slice(0, 12),
          name: (c.Names?.[0] || c.Id).replace(/^\//, ''),
          image: c.Image,
          state: c.State,
          status: c.Status,
          cpuPct: 0,
          memUsedBytes: 0,
          memLimitBytes: 0,
          netRxBytes: 0,
          netTxBytes: 0,
        } as ContainerStat
      }
    })
  )
  return stats.sort((a, b) => b.cpuPct - a.cpuPct)
}

export async function collectStorage(): Promise<StorageStats> {
  return parseStorage(await dockerGet<DfResponse>('/system/df'))
}
