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
  'extension-manager-api': {
    name: 'Extensions API',
    description: 'Centralized API for Sikasio browser extensions (Gemini SEO proxy)',
    type: 'app',
    domains: ['extensions-api.sikasio.com'],
  },
  'whatsapp-server': {
    name: 'WhatsApp Server',
    description: 'UpSmart WhatsApp messaging backend (Baileys) — send API + AI customer service',
    type: 'app',
    domains: ['whatsapp-api.sikasio.com'],
  },
  whisperlock: {
    name: 'Whisperlock',
    description: 'AI escape-room game (Gandalf-style) — Gemini gatekeepers, Next.js + Prisma/SQLite',
    type: 'app',
    domains: ['whisperlock.sikasio.com'],
  },
  echonote: {
    name: 'EchoNote',
    description: 'Voice notes with AI transcription, summaries & smart keywords (Gemini + Firebase).',
    type: 'app',
    domains: ['echonote.sikasio.com'],
  },
  'ftw-admin': {
    name: 'FTW Admin',
    description: 'FTW Fitness admin console (Vite SPA + Supabase) — users, content, marketing & analytics',
    type: 'app',
    domains: ['admin.ftwsport.com'],
  },
  'img-gen-api': {
    name: 'Image Gen API',
    description: 'Public image-generation REST API (useapi.net) — async jobs, API keys, rate limits; /docs + /status',
    type: 'app',
    domains: ['img-gen-api.sikasio.com'],
  },
  'bg-api': {
    name: 'BG-API',
    description: 'Background-removal SaaS — self-serve signup, Polar billing, plan quotas; gateway + AI worker',
    type: 'app',
    domains: ['bg-api.sikasio.com'],
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

// Sibling app keys that belong to one umbrella system get folded together so
// they show as a single row with all their containers/domains. Keyed by the
// shared prefix (e.g. coffeepos-landing / -leads / -license -> coffeepos).
const PARENTS: Record<string, { name: string; description: string; type: string }> = {
  coffeepos: {
    name: 'CoffeePOS',
    description: 'Coffee-shop POS — landing site, leads API & license server',
    type: 'system',
  },
}

function parentKeyOf(key: string): string | null {
  const base = key.split('-')[0]
  return PARENTS[base] ? base : null
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
// umbrella siblings (e.g. coffeepos-* → coffeepos) via PARENTS.
export function systemIdForLabels(labels: Record<string, string>): string {
  const wd = labels['com.docker.compose.project.working_dir'] || ''
  const keyed = appKeyFromWorkdir(wd)
  const key = keyed?.key || labels['com.docker.compose.project'] || '(other)'
  return parentKeyOf(key) || key
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

  // Fold umbrella siblings (e.g. coffeepos-*) into a single parent system.
  const merged = new Map<string, AppInfo>()
  for (const app of discovered) {
    const pkey = parentKeyOf(app.id)
    if (!pkey) {
      merged.set(app.id, app)
      continue
    }
    const meta = PARENTS[pkey]
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

  return [...result, ...EXTRA].sort((a, b) => a.name.localeCompare(b.name))
}
