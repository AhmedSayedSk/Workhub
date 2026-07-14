import type { ServerDef } from './types'
export type { ServerDef } from './types'

export const DEFAULT_SERVER_ID = 'primary'

// Static registry (YAGNI — no management UI). Add a server = one entry + an agent.
export const SERVERS: ServerDef[] = [
  {
    id: 'primary',
    name: process.env.VPS_DISPLAY_NAME || 'Primary',
    subtitle: process.env.VPS_SUBTITLE || 'ask2do · Hetzner fsn1',
    mode: 'local',
  },
  {
    id: 'falkenstein',
    name: process.env.VPS2_DISPLAY_NAME || 'Falkenstein',
    subtitle: process.env.VPS2_SUBTITLE || 'sikasio · Hetzner fsn1',
    mode: 'remote',
  },
]

export function getServer(id: string): ServerDef | undefined {
  return SERVERS.find((s) => s.id === id)
}
