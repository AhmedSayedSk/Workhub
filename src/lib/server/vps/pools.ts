import type { AppInfo, ContainerStat, PoolInfo } from './types'
import type { RegistryPool } from './registry'

// Split runtime-spawned containers out of the containers table and the
// Systems & Apps rows into pools of their own (one card each).
//
// Applied by the stats route, not the collectors: the registry lives with THIS
// deployment, so a remote server's pushed snapshot is pooled by the same rules
// without the agent needing a copy. Pure and type-only-importing, so it can be
// unit-tested with `node --test`.

type Matcher = (c: Pick<ContainerStat, 'name' | 'image'>) => boolean

/**
 * Compile one pool rule. Every pattern given must match; a rule with no
 * patterns, or with a regex that does not compile, matches nothing — a typo in
 * the private registry must never sweep every container off the page.
 */
export function poolMatcher(rule: RegistryPool): Matcher | null {
  const tests: Array<[keyof Pick<ContainerStat, 'name' | 'image'>, RegExp]> = []
  for (const field of ['name', 'image'] as const) {
    const src = rule.match?.[field]
    if (!src) continue
    try {
      tests.push([field, new RegExp(src)])
    } catch {
      return null
    }
  }
  if (!tests.length) return null
  return (c) => tests.every(([field, re]) => re.test(c[field] || ''))
}

export function applyPools<T extends { containers: ContainerStat[] | null; apps: AppInfo[] | null }>(
  stats: T,
  rules: Record<string, RegistryPool>
): T & { pools: PoolInfo[] } {
  const compiled = Object.entries(rules)
    .map(([id, rule]) => ({ id, rule, match: poolMatcher(rule) }))
    .filter((p): p is { id: string; rule: RegistryPool; match: Matcher } => p.match !== null)
  if (!stats.containers || !compiled.length) return { ...stats, pools: [] }

  const claimed = new Map<string, ContainerStat[]>()
  const rest: ContainerStat[] = []
  for (const c of stats.containers) {
    const pool = compiled.find((p) => p.match(c))
    if (!pool) {
      rest.push(c)
      continue
    }
    const list = claimed.get(pool.id)
    if (list) list.push(c)
    else claimed.set(pool.id, [c])
  }

  // Only pools that have containers on THIS server get a card — the same
  // registry is applied to every server, and most do not run every system.
  const pools: PoolInfo[] = compiled
    .filter((p) => claimed.has(p.id))
    .map(({ id, rule }) => {
      const containers = claimed.get(id)!.sort((a, b) => {
        const run = Number(b.state === 'running') - Number(a.state === 'running')
        return run !== 0 ? run : b.memUsedBytes - a.memUsedBytes
      })
      const live = containers.filter((c) => c.state === 'running')
      return {
        id,
        name: rule.name || id,
        description: rule.description || '',
        app: rule.app || null,
        containers,
        running: live.length,
        total: containers.length,
        cpuPct: Math.round(live.reduce((s, c) => s + c.cpuPct, 0) * 10) / 10,
        memUsedBytes: live.reduce((s, c) => s + c.memUsedBytes, 0),
      }
    })

  // Apps list services by name only, so drop the names the pools claimed. A
  // system left with no services existed only because of them (the "(other)"
  // catch-all) and goes; a non-container system had none to begin with and stays.
  const pooledNames = new Set(pools.flatMap((p) => p.containers.map((c) => c.name)))
  const apps = stats.apps
    ? stats.apps.flatMap((a) => {
        if (!a.services.some((s) => pooledNames.has(s.name))) return [a]
        const services = a.services.filter((s) => !pooledNames.has(s.name))
        if (!services.length) return []
        return [{ ...a, services, running: services.filter((s) => s.state === 'running').length, total: services.length }]
      })
    : null

  return { ...stats, containers: rest, apps, pools }
}
