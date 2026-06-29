import { promises as fs } from 'fs'
import type { VpsSecurity } from './types'

// The host writes a security-posture summary (cron, every 15 min) to this file,
// which is mounted read-only into this container. See /opt/_security/security-status.sh.
const STATUS_PATH = process.env.SECURITY_STATUS_PATH || '/opt/_security/status.json'

export async function collectSecurity(): Promise<VpsSecurity | null> {
  const raw = await fs.readFile(STATUS_PATH, 'utf8')
  const data = JSON.parse(raw) as VpsSecurity
  if (!data || !Array.isArray(data.checks)) throw new Error('invalid security status file')
  return data
}
