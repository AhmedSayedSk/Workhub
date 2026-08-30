import type { ProjectStatus } from '@/types'

const ALL: ProjectStatus[] = ['active', 'paused', 'completed', 'cancelled']

/**
 * Which project statuses the internal projects feed should return, from its
 * `?status=` query: a comma list of statuses, or `all`. Unknown values are
 * ignored; with nothing valid left the feed serves active projects only.
 */
export function parseStatusFilter(raw: string | null): ProjectStatus[] {
  const text = (raw ?? '').trim().toLowerCase()
  if (text === 'all') return [...ALL]
  const out: ProjectStatus[] = []
  for (const part of text.split(',')) {
    const s = part.trim() as ProjectStatus
    if (ALL.includes(s) && !out.includes(s)) out.push(s)
  }
  return out.length ? out : ['active']
}
