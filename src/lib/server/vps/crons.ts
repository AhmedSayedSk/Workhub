import { promises as fs } from 'fs'
import type { VpsCrons } from './types'

// The host writes a cron-job inventory (root cron, every 5 min) to this file,
// which is mounted read-only into this container — same pattern as the
// security panel's status.json. See /opt/_security/cron-status.sh on the box.
const STATUS_PATH = process.env.CRON_STATUS_PATH || '/opt/_security/cron.json'

export async function collectCrons(): Promise<VpsCrons | null> {
  const raw = await fs.readFile(STATUS_PATH, 'utf8')
  const data = JSON.parse(raw) as VpsCrons
  if (!data || !Array.isArray(data.jobs)) throw new Error('invalid cron status file')
  return data
}
