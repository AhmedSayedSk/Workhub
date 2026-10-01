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
// Containers a system spawns at runtime (per-session sandboxes, job workers)
// rather than declares in compose. They carry no compose labels, so without a
// pool they pile into the "(other)" system and crowd the containers table.
// A container joins the FIRST pool whose every given pattern matches it.
export interface RegistryPool {
  name: string
  description?: string
  /** System key (the /opt/<dir> id) that spawns these, shown on the card. */
  app?: string
  match: {
    name?: string // regex source, tested against the container name
    image?: string // regex source, tested against the image reference
  }
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
  pools: Record<string, RegistryPool>
  cron: CronRegistry
}

const EMPTY: VpsRegistry = {
  apps: {},
  parents: {},
  // Sensible generic defaults: edge proxy + the metrics agent are infrastructure
  // behind every row, not systems of their own.
  hidden: ['_edge', 'edge', 'vps-agent'],
  pools: {},
  cron: { meta: [], appOrder: [], inAppJobs: {} },
}

// Short-TTL cache, NOT cache-forever: a failed first read (file mounted late,
// transient fs error) must not pin the dashboard to the empty overlay for the
// life of the process, and an on-box edit of the JSON should show up within a
// minute without restarting the container.
const TTL_MS = 60_000
let cached: { value: VpsRegistry; at: number } | null = null

export function loadRegistry(): VpsRegistry {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  const file = process.env.VPS_REGISTRY_FILE || path.join(process.cwd(), 'vps-registry.json')
  let value: VpsRegistry
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<VpsRegistry>
    value = {
      apps: raw.apps ?? {},
      parents: raw.parents ?? {},
      hidden: raw.hidden ?? EMPTY.hidden,
      pools: raw.pools ?? {},
      cron: {
        meta: raw.cron?.meta ?? [],
        appOrder: raw.cron?.appOrder ?? [],
        inAppJobs: raw.cron?.inAppJobs ?? {},
      },
    }
  } catch {
    value = EMPTY
  }
  cached = { value, at: Date.now() }
  return value
}
