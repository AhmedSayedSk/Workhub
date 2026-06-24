// Shared contract for the VPS ops dashboard. The API returns a `VpsStats`;
// the UI renders it. Each section may be null if its data source failed, so
// the dashboard degrades gracefully instead of erroring as a whole.

export interface HostStats {
  hostname: string
  os: string // e.g. "Linux 6.x"
  uptimeSec: number
  cpu: {
    model: string
    cores: number
    usagePct: number // 0-100, sampled over a short interval
    load1: number
    load5: number
    load15: number
  }
  memory: {
    totalBytes: number
    usedBytes: number
    availableBytes: number
  }
  swap: {
    totalBytes: number
    usedBytes: number
  }
  disk: {
    totalBytes: number
    usedBytes: number
    availableBytes: number
  }
}

export interface ContainerStat {
  id: string
  name: string
  image: string
  state: string // "running", etc.
  status: string // "Up 6 days"
  cpuPct: number // 0-100 (can exceed 100 across multiple cores)
  memUsedBytes: number
  memLimitBytes: number
  netRxBytes: number
  netTxBytes: number
}

export interface StorageStats {
  imagesBytes: number
  containersBytes: number
  volumesBytes: number
  buildCacheBytes: number
}

export interface CertInfo {
  domain: string
  issuer: string | null
  validToMs: number | null // epoch ms of notAfter
  daysRemaining: number | null
  error?: string
}

export type AlertSeverity = 'warning' | 'critical'

export interface Alert {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
}

// A system/app on the box: its /opt path, domains, and its containers' status.
export interface AppService {
  name: string
  state: string
  status: string
}
export interface AppInfo {
  id: string
  name: string
  description: string
  type: string // app | proxy | site | service | database | system
  path: string
  domains: string[]
  services: AppService[]
  running: number
  total: number
}

export interface SectionError {
  section: 'host' | 'containers' | 'storage' | 'certs' | 'apps'
  message: string
}

export interface VpsMeta {
  name: string // display name shown as the page title
  subtitle: string
}

// One persisted time-series sample (written every minute, charted over time).
export interface MetricPoint {
  ts: number // epoch ms
  cpuPct: number
  memPct: number
  diskPct: number
  load1: number
}

export interface HistoryResponse {
  range: string
  points: MetricPoint[]
}

export interface VpsStats {
  generatedAtMs: number
  meta: VpsMeta
  host: HostStats | null
  containers: ContainerStat[] | null
  apps: AppInfo[] | null
  storage: StorageStats | null
  certs: CertInfo[] | null
  network: { rxBytes: number; txBytes: number } | null // aggregate of container NetIO
  alerts: Alert[]
  errors: SectionError[]
}
