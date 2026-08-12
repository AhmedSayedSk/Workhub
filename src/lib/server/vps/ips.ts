import { promises as fs } from 'fs'

// The host writes its own public addresses (cron, every 15 min + at boot) to
// this file, which is mounted read-only into this container.
// See /opt/_security/ip-status.sh.
//
// Why the host has to do it: this process runs in a container and can see only
// its own bridge addresses, so the box's real addressing is invisible from
// here. Reading it off the host is also why the list is complete — a manually
// maintained VPS_PUBLIC_IP drifts the moment a floating IP is added and nobody
// remembers to update the env.
const STATUS_PATH = process.env.IP_STATUS_PATH || '/opt/_security/ips.json'

interface IpEntry {
  addr: string
  iface: string
  family: 'ipv4' | 'ipv6'
}

export interface DetectedIps {
  generatedAtMs: number
  ips: string[]
}

export async function collectPublicIps(): Promise<DetectedIps | null> {
  const raw = await fs.readFile(STATUS_PATH, 'utf8')
  const data = JSON.parse(raw) as { generatedAtMs?: number; ips?: IpEntry[] }
  if (!data || !Array.isArray(data.ips)) throw new Error('invalid ip status file')
  const ips = data.ips.map((e) => e?.addr).filter((a): a is string => typeof a === 'string' && a.length > 0)
  return { generatedAtMs: data.generatedAtMs || 0, ips }
}
