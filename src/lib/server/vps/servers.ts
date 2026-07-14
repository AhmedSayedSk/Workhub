import type { ServerDef } from './types'
export type { ServerDef } from './types'

export const DEFAULT_SERVER_ID = 'primary'

// Static registry (YAGNI — no management UI). Add a server = one entry + an agent.
export const SERVERS: ServerDef[] = [
  {
    id: 'primary',
    name: process.env.VPS_DISPLAY_NAME || 'Primary',
    subtitle: process.env.VPS_SUBTITLE || 'Primary server',
    mode: 'local',
  },
  {
    id: 'secondary',
    name: process.env.VPS2_DISPLAY_NAME || 'Secondary',
    subtitle: process.env.VPS2_SUBTITLE || 'Secondary server',
    mode: 'remote',
  },
]

export function getServer(id: string): ServerDef | undefined {
  return SERVERS.find((s) => s.id === id)
}
