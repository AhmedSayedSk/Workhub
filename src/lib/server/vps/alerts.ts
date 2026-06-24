import type { Alert, HostStats, CertInfo, ContainerStat } from './types'

// Threshold evaluation. Defaults are overridable via env. v1 surfaces alerts
// in-page; wiring them to the notification/email system is a later phase.

function num(envKey: string, fallback: number): number {
  const v = Number(process.env[envKey])
  return Number.isFinite(v) ? v : fallback
}

const T = {
  diskWarn: () => num('VPS_ALERT_DISK_WARN', 85),
  diskCrit: () => num('VPS_ALERT_DISK_CRIT', 95),
  memWarn: () => num('VPS_ALERT_MEM_WARN', 90),
  certWarnDays: () => num('VPS_ALERT_CERT_WARN_DAYS', 14),
  certCritDays: () => num('VPS_ALERT_CERT_CRIT_DAYS', 7),
}

function pct(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0
}

export function evaluateAlerts(input: {
  host: HostStats | null
  certs: CertInfo[] | null
  containers: ContainerStat[] | null
}): Alert[] {
  const alerts: Alert[] = []
  const { host, certs } = input

  if (host) {
    const diskPct = pct(host.disk.usedBytes, host.disk.totalBytes)
    if (diskPct >= T.diskCrit()) {
      alerts.push({ id: 'disk', severity: 'critical', title: 'Disk almost full', detail: `Root disk at ${diskPct}%` })
    } else if (diskPct >= T.diskWarn()) {
      alerts.push({ id: 'disk', severity: 'warning', title: 'Disk filling up', detail: `Root disk at ${diskPct}%` })
    }

    const memPct = pct(host.memory.usedBytes, host.memory.totalBytes)
    if (memPct >= T.memWarn()) {
      alerts.push({ id: 'mem', severity: 'warning', title: 'High memory use', detail: `Memory at ${memPct}%` })
    }
  }

  for (const c of certs || []) {
    if (c.daysRemaining == null) continue
    if (c.daysRemaining <= T.certCritDays()) {
      alerts.push({ id: `cert-${c.domain}`, severity: 'critical', title: 'Cert expiring', detail: `${c.domain} in ${c.daysRemaining}d` })
    } else if (c.daysRemaining <= T.certWarnDays()) {
      alerts.push({ id: `cert-${c.domain}`, severity: 'warning', title: 'Cert expiring soon', detail: `${c.domain} in ${c.daysRemaining}d` })
    }
  }

  // Optional: alert when an expected container isn't running.
  const expected = (process.env.VPS_EXPECTED_CONTAINERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (expected.length && input.containers) {
    const running = new Set(input.containers.filter((c) => c.state === 'running').map((c) => c.name))
    for (const name of expected) {
      if (!running.has(name)) {
        alerts.push({ id: `down-${name}`, severity: 'critical', title: 'Container down', detail: `${name} is not running` })
      }
    }
  }

  return alerts
}
