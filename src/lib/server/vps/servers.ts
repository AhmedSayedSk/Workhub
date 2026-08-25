import type { ServerDef } from './types'
export type { ServerDef } from './types'

export const DEFAULT_SERVER_ID = 'primary'

// A server's public IPs come from the environment and NEVER from this file:
// the repo is public, so an address committed here is published forever.
// Unset simply means the dashboard shows no address for that server.
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
// Deliberately loose: hex groups and `::`, enough to reject prose and IPv4
// typos without reimplementing RFC 4291. Anything shaped like an address is
// shown as configured — this is a display field, nothing routes on it.
const IPV6 = /^[0-9a-fA-F:]{2,45}$/

export function isIpAddress(value: string): boolean {
  if (IPV4.test(value)) return true
  return value.includes(':') && IPV6.test(value)
}

/**
 * Parse a `VPS*_PUBLIC_IP` value: one or more addresses separated by commas,
 * whitespace or both (`"1.2.3.4, 2a01:4f8::1"`).
 *
 * Malformed entries are DROPPED rather than rendered. A half-typed address on
 * an ops dashboard is worse than a blank one, because it reads as fact — and
 * the value it would be checked against (a DNS record) is exactly the kind of
 * thing someone would then "fix" to match. Order is preserved and duplicates
 * removed.
 */
export function parseIps(raw: string | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\s,]+/)) {
    const v = part.trim()
    if (!v || seen.has(v) || !isIpAddress(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

// Static registry (YAGNI — no management UI). Add a server = one entry + an agent.
export const SERVERS: ServerDef[] = [
  {
    id: 'primary',
    name: process.env.VPS_DISPLAY_NAME || 'Primary',
    subtitle: process.env.VPS_SUBTITLE || 'Primary server',
    mode: 'local',
    ips: parseIps(process.env.VPS_PUBLIC_IP),
  },
  // 'secondary' was decommissioned 2026-08-07 and 'tertiary' on 2026-08-22 —
  // their workloads moved elsewhere and both boxes were retired. Their ids are
  // deliberately NOT reused: snapshots are stored per serverId, so a reused id
  // inherits the retired box's history and charts it as if it were the new one.
  {
    id: 'quaternary',
    name: process.env.VPS4_DISPLAY_NAME || 'Quaternary',
    subtitle: process.env.VPS4_SUBTITLE || 'Quaternary server',
    mode: 'remote',
    ips: parseIps(process.env.VPS4_PUBLIC_IP),
  },
]

export function getServer(id: string): ServerDef | undefined {
  return SERVERS.find((s) => s.id === id)
}
