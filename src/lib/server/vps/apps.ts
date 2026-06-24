import type { AppInfo, AppService } from './types'

// "Systems & Apps" inventory. Auto-discovered from Docker compose labels — every
// container reports its compose working_dir, which gives the real /opt/<app>
// path and lets us group a project's containers together. A small curated
// REGISTRY overlays friendly names, descriptions, and domains, and EXTRA lists
// systems that aren't containers (e.g. Yarwy). Edit those two to taste.

const BASE = process.env.DOCKER_PROXY_URL || 'http://workhub-dockerproxy:2375'

// Friendly overlay keyed by the /opt/<dir> name.
const REGISTRY: Record<string, { name: string; description: string; type: string; domains: string[] }> = {
  ask2do: {
    name: 'Ask2Do',
    description: 'AI admin-panel assistant — portal + cloud orchestrator + Postgres/Redis',
    type: 'app',
    domains: ['app.ask2do.com', 'cloud.ask2do.com', 'ask2do.com'],
  },
  workhub: {
    name: 'WorkHub',
    description: 'Project management & time tracking (this app)',
    type: 'app',
    domains: ['workhub.sikasio.com'],
  },
  'coffeepos-landing': {
    name: 'CoffeePOS — Landing',
    description: 'Marketing landing site',
    type: 'site',
    domains: ['coffeepos.sikasio.com'],
  },
  'coffeepos-leads': {
    name: 'CoffeePOS — Leads',
    description: 'Leads / API server',
    type: 'app',
    domains: ['coffeepos.sikasio.com/api'],
  },
  'coffeepos-license': {
    name: 'CoffeePOS — License',
    description: 'License activation server',
    type: 'service',
    domains: ['license.sikasio.com'],
  },
  _edge: {
    name: 'Edge Proxy',
    description: 'Caddy reverse proxy — single ingress, auto-TLS',
    type: 'proxy',
    domains: [],
  },
}

// Non-container systems (not visible via Docker).
const EXTRA: AppInfo[] = [
  {
    id: 'yarwy',
    name: 'Yarwy',
    description: 'Brand content auto-generation system',
    type: 'system',
    path: '/opt/yarwy/yarwy-auto-generation',
    domains: [],
    services: [],
    running: 0,
    total: 0,
  },
]

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

  const groups = new Map<string, { path: string; services: AppService[] }>()
  for (const c of list) {
    const labels = c.Labels || {}
    const wd = labels['com.docker.compose.project.working_dir'] || ''
    const keyed = appKeyFromWorkdir(wd)
    const key = keyed?.key || labels['com.docker.compose.project'] || '(other)'
    const path = keyed?.path || ''
    const svc: AppService = {
      name: (c.Names?.[0] || c.Id).replace(/^\//, ''),
      state: c.State,
      status: c.Status,
    }
    const g = groups.get(key)
    if (g) g.services.push(svc)
    else groups.set(key, { path, services: [svc] })
  }

  const discovered: AppInfo[] = [...groups.entries()].map(([key, g]) => {
    const reg = REGISTRY[key]
    const services = g.services.sort((a, b) => a.name.localeCompare(b.name))
    return {
      id: key,
      name: reg?.name || key,
      description: reg?.description || '',
      type: reg?.type || 'app',
      path: g.path,
      domains: reg?.domains || [],
      services,
      running: services.filter((s) => s.state === 'running').length,
      total: services.length,
    }
  })

  return [...discovered, ...EXTRA].sort((a, b) => a.name.localeCompare(b.name))
}
