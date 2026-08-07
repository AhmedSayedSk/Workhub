import fs from 'node:fs'
import path from 'node:path'

// Private curated overlay for the VPS ops dashboard, loaded at runtime from a
// JSON file that is NOT in the repo (this repo is public — client/system names,
// descriptions and domains must never be committed; same rule as public IPs in
// servers.ts). The file lives on the box and is mounted into the container:
//   VPS_REGISTRY_FILE (default ./vps-registry.json)
// Missing/invalid file → empty overlay: the dashboard still auto-discovers
// every system from Docker labels, just without friendly names/descriptions.
// Schema: see vps-registry.example.json at the repo root.

export interface RegistryApp {
  name: string
  description: string
  type: string
  domains: string[]
}
export interface RegistryParent {
  name: string
  description: string
  type: string
}
export interface CronMetaRule {
  match: string // regex source, tested against the cron job's command line
  app: string
  title: string
  description: string
}
export interface InAppJob {
  cadence: string
  title: string
  description: string
  disabled?: boolean
}
export interface CronRegistry {
  meta: CronMetaRule[]
  appOrder: string[]
  inAppJobs: Record<string, { app: string; jobs: InAppJob[] }>
}
export interface VpsRegistry {
  apps: Record<string, RegistryApp>
  parents: Record<string, RegistryParent>
  hidden: string[]
  cron: CronRegistry
}

const EMPTY: VpsRegistry = {
  apps: {},
  parents: {},
  // Sensible generic defaults: edge proxy + the metrics agent are infrastructure
  // behind every row, not systems of their own.
  hidden: ['_edge', 'edge', 'vps-agent'],
  cron: { meta: [], appOrder: [], inAppJobs: {} },
}

let cached: VpsRegistry | null = null

export function loadRegistry(): VpsRegistry {
  if (cached) return cached
  const file = process.env.VPS_REGISTRY_FILE || path.join(process.cwd(), 'vps-registry.json')
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<VpsRegistry>
    cached = {
      apps: raw.apps ?? {},
      parents: raw.parents ?? {},
      hidden: raw.hidden ?? EMPTY.hidden,
      cron: {
        meta: raw.cron?.meta ?? [],
        appOrder: raw.cron?.appOrder ?? [],
        inAppJobs: raw.cron?.inAppJobs ?? {},
      },
    }
  } catch {
    cached = EMPTY
  }
  return cached
}
