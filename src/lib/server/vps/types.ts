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
  // Public IPs this server answers on — what its domains' DNS records point at.
  // Injected from the registry by the stats route, so one .env is the source of
  // truth for both the local box and every agent-reported one. Empty = unset.
  ips?: string[]
}

// One persisted time-series sample (written every minute, charted over time).
export interface MetricPoint {
  ts: number // epoch ms
  serverId?: string // absent on legacy docs → treated as 'primary'
  cpuPct: number
  memPct: number
  diskPct: number
  load1: number
  // Per-system rollup at this sample: summed cpuPct + summed memUsedBytes of each
  // system's running containers, keyed by the same system id collectApps() uses.
  systems?: Record<string, { cpu: number; mem: number }>
}

export interface HistoryResponse {
  range: string
  points: MetricPoint[]
}

// One per-system time-series point (cpu = summed %, mem = summed bytes).
export interface SystemPoint {
  ts: number // epoch ms
  cpu: number
  mem: number
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
  security: VpsSecurity | null
  crons: VpsCrons | null
  alerts: Alert[]
  errors: SectionError[]
}

// One scheduled job on the host (user crontabs + /etc/cron.d), as inventoried
// by /opt/_security/cron-status.sh into cron.json.
export interface CronJob {
  schedule: string // raw cron expression ('*/5 * * * *' or '@daily')
  command: string
  user: string
  source: string // 'crontab:sikasio' | 'cron.d/security-status'
}

export interface VpsCrons {
  generatedAtMs: number
  jobs: CronJob[]
}

export interface SecurityCheck {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail?: string
}

export interface VpsSecurity {
  generatedAtMs: number
  passed: number
  total: number
  checks: SecurityCheck[]
}

export interface ServerDef {
  id: string
  name: string
  subtitle: string
  mode: 'local' | 'remote'
  /** Public IPs the server answers on. Empty when none is configured. */
  ips: string[]
}

// One server the ops dashboard can show. 'local' = the WorkHub host (collected
// in-process, on demand); 'remote' = reports snapshots via the agent.
export interface ServerSummary {
  id: string
  name: string
  subtitle: string
  mode: 'local' | 'remote'
  ips: string[] // public IPs, from the registry; empty when unconfigured
  online: boolean
  updatedAtMs: number | null // last snapshot/sample time; null if never
  cpuPct: number | null
  memPct: number | null
  diskPct: number | null
  alertCount: number
  cpuCores: number | null // total vCPU
  memTotalBytes: number | null // total RAM
  diskTotalBytes: number | null // total disk
  containers: number | null // running/total docker container count
}

// Latest pushed snapshot for a remote server.
export interface SnapshotEnvelope {
  stats: VpsStats
  receivedAtMs: number
}
