import type { AppInfo, AppService } from './types'
import { loadRegistry } from './registry'

// "Systems & Apps" inventory. FULLY auto-discovered from Docker compose labels:
// grouping + path from working_dir, a derived display name from the project key,
// and domains sniffed from the containers' own env (PUBLIC_BASE_URL etc.) — a
// NEW app appears here automatically with no code/registry edit.
//
// The curated overlay (friendly names/descriptions/domains, umbrella folding,
// hidden infra) is PRIVATE data — this repo is public — so it is loaded at
// runtime from a gitignored JSON file (vps-registry.json, mounted on the box).
// See registry.ts + vps-registry.example.json. Missing file → generic display.

const BASE = process.env.DOCKER_PROXY_URL || 'http://workhub-dockerproxy:2375'

// The private overlay is read per call (loadRegistry has its own short TTL) —
// snapshotting it into module constants would pin whatever the FIRST evaluation
// saw (e.g. an empty overlay if the file mounted late) for the process's life.

// Non-container systems (not visible via Docker), declared per-server via the
// VPS_EXTRA_APPS env: pipe-delimited "id|Name|Description|type|/opt/path",
// multiple separated by ";". Unset/empty => none. Each server only lists its own.
function extraApps(): AppInfo[] {
  const raw = process.env.VPS_EXTRA_APPS
  if (!raw) return []
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, name, description, type, path] = entry.split('|').map((x) => (x || '').trim())
      return {
        id: id || 'extra',
        name: name || id || 'System',
        description: description || '',
        type: type || 'system',
        path: path || '',
        domains: [],
        services: [],
        running: 0,
        total: 0,
      } as AppInfo
    })
    .filter((a) => a.id)
}

// Sibling app keys that belong to one umbrella system get folded together so
// they show as a single row with all their containers/domains. Keyed by a shared
// key PREFIX (longest match wins), so 'foo-bar' folds foo-bar-web + foo-bar-db
// without swallowing every future 'foo-*' key.
function parentKeyOf(key: string): string | null {
  // Longest matching prefix: 'foo-bar-db' → 'foo-bar'. Exact key matches fold
  // too, so /opt/foo-bar (if it ever exists) joins the family.
  let best: string | null = null
  for (const p of Object.keys(loadRegistry().parents)) {
    if ((key === p || key.startsWith(`${p}-`)) && (!best || p.length > best.length)) best = p
  }
  return best
}

interface ContainerSummary {
  Id: string
  Names: string[]
  State: string
  Status: string
  Labels?: Record<string, string>
}

// Extract the /opt/<dir> app key + path from a compose working_dir label.
function appKeyFromWorkdir(wd: string): { key: string; path: string } | null {
  const m = wd.match(/^\/opt\/([^/]+)/)
  if (!m) return null
  return { key: m[1], path: `/opt/${m[1]}` }
}

// Map a container's compose labels to the FOLDED system id the UI renders — the
// single source of truth shared with per-system metrics so ids never diverge.
// Mirrors collectApps(): raw key from working_dir (or project label), then fold
// umbrella siblings via PARENTS (e.g. foo-web / foo-db → foo).
export function systemIdForLabels(labels: Record<string, string>): string {
  const wd = labels['com.docker.compose.project.working_dir'] || ''
  const keyed = appKeyFromWorkdir(wd)
  const key = keyed?.key || labels['com.docker.compose.project'] || '(other)'
  return parentKeyOf(key) || key
}

// 'my-api' → 'My API', 'campaign-renderer' → 'Campaign Renderer' — short
// tokens read as acronyms, longer ones as words. Good enough that new apps
// need no registry entry to look presentable.
function prettyName(key: string): string {
  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((t) => (t.length <= 3 ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1)))
    .join(' ')
}

// Domains straight from the app's own configuration: scan a running
// container's env for URL-ish variables. No registry needed.
const URL_ENV = /^(PUBLIC_BASE_URL|PORTAL_BASE_URL|BASE_URL|APP_URL|SITE_URL|PUBLIC_URL|NEXT_PUBLIC_SITE_URL|NEXT_PUBLIC_APP_URL|DOMAIN)=(.+)$/
async function domainsFromEnv(containerId: string): Promise<string[]> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(`${BASE}/containers/${containerId}/json`, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) return []
    const info = (await res.json()) as { Config?: { Env?: string[] } }
    const out = new Set<string>()
    for (const e of info.Config?.Env || []) {
      const m = e.match(URL_ENV)
      if (!m) continue
      const v = m[2].trim()
      const host = v.includes('://') ? v.split('://')[1].split('/')[0] : v.split('/')[0]
      if (host && host.includes('.') && !host.includes(' ')) out.add(host)
    }
    return [...out]
  } catch {
    return []
  }
}

export async function collectApps(): Promise<AppInfo[]> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  let list: ContainerSummary[]
  try {
    const res = await fetch(`${BASE}/containers/json?all=1`, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`docker /containers/json?all=1 -> ${res.status}`)
    list = (await res.json()) as ContainerSummary[]
  } finally {
    clearTimeout(t)
  }

  const registry = loadRegistry()
  const hidden = new Set(registry.hidden)

  const groups = new Map<string, { path: string; services: AppService[]; runningId?: string }>()
  for (const c of list) {
    const labels = c.Labels || {}
    const wd = labels['com.docker.compose.project.working_dir'] || ''
    const keyed = appKeyFromWorkdir(wd)
    const key = keyed?.key || labels['com.docker.compose.project'] || '(other)'
    if (hidden.has(key)) continue
    const path = keyed?.path || ''
    const svc: AppService = {
      name: (c.Names?.[0] || c.Id).replace(/^\//, ''),
      state: c.State,
      status: c.Status,
    }
    const g = groups.get(key)
    if (g) {
      g.services.push(svc)
      if (!g.runningId && c.State === 'running') g.runningId = c.Id
    } else groups.set(key, { path, services: [svc], runningId: c.State === 'running' ? c.Id : undefined })
  }

  const discovered: AppInfo[] = await Promise.all(
    [...groups.entries()].map(async ([key, g]) => {
      const reg = registry.apps[key]
      const services = g.services.sort((a, b) => a.name.localeCompare(b.name))
      // Registry domains win when curated; otherwise read them from the app's
      // own env so new apps self-describe.
      const domains = reg?.domains?.length ? reg.domains : g.runningId ? await domainsFromEnv(g.runningId) : []
      return {
        id: key,
        name: reg?.name || prettyName(key),
        description: reg?.description || '',
        type: reg?.type || 'app',
        path: g.path,
        domains,
        services,
        running: services.filter((s) => s.state === 'running').length,
        total: services.length,
      }
    })
  )

  // Fold umbrella siblings into a single parent system.
  const merged = new Map<string, AppInfo>()
  for (const app of discovered) {
    const pkey = parentKeyOf(app.id)
    if (!pkey) {
      merged.set(app.id, app)
      continue
    }
    const meta = registry.parents[pkey]
    const existing = merged.get(pkey)
    if (existing) {
      existing.services.push(...app.services)
      existing.domains = Array.from(new Set([...existing.domains, ...app.domains]))
      existing.running += app.running
      existing.total += app.total
    } else {
      merged.set(pkey, {
        id: pkey,
        name: meta.name,
        description: meta.description,
        type: meta.type,
        path: `/opt/${pkey}-*`,
        domains: [...app.domains],
        services: [...app.services],
        running: app.running,
        total: app.total,
      })
    }
  }

  const result = [...merged.values()].map((a) => ({
    ...a,
    services: a.services.sort((x, y) => x.name.localeCompare(y.name)),
  }))

  return [...result, ...extraApps()].sort((a, b) => a.name.localeCompare(b.name))
}
