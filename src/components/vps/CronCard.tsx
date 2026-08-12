'use client'

import { useState } from 'react'
import { ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VpsCrons, CronJob, AppInfo } from '@/lib/server/vps/types'
import type { CronRegistry, CronMetaRule } from '@/lib/server/vps/registry'
import { CollapsiblePanel } from './CollapsiblePanel'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Best-effort English for the common five-field shapes; anything exotic
// (ranges, lists, step-of-range) just shows its raw expression, which the
// schedule pill displays anyway.
function humanSchedule(expr: string): string | null {
  if (expr.startsWith('@')) {
    const named: Record<string, string> = {
      '@reboot': 'At boot',
      '@hourly': 'Hourly',
      '@daily': 'Daily at 00:00',
      '@midnight': 'Daily at 00:00',
      '@weekly': 'Weekly (Sun 00:00)',
      '@monthly': 'Monthly (1st, 00:00)',
      '@yearly': 'Yearly (Jan 1)',
      '@annually': 'Yearly (Jan 1)',
    }
    return named[expr] || null
  }
  const f = expr.split(/\s+/)
  if (f.length !== 5) return null
  const [min, hour, dom, mon, dow] = f
  const pad = (v: string) => v.padStart(2, '0')
  const everyN = (v: string) => /^\*\/\d+$/.test(v) && v.slice(2)
  if (min === '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every minute'
  const stepMin = everyN(min)
  if (stepMin && hour === '*' && dom === '*' && mon === '*' && dow === '*') return `Every ${stepMin} min`
  // '5-55/10 * * * *' (sysstat style) — step over a minute range, still hourly cadence
  const rangeStep = min.match(/^(\d+)-(\d+)\/(\d+)$/)
  if (rangeStep && hour === '*' && dom === '*' && mon === '*' && dow === '*') return `Every ${rangeStep[3]} min (:${pad(rangeStep[1])}–:${pad(rangeStep[2])})`
  if (/^\d+$/.test(min)) {
    const stepHour = everyN(hour)
    if (stepHour && dom === '*' && mon === '*' && dow === '*') return `Every ${stepHour} h at :${pad(min)}`
    if (hour === '*' && dom === '*' && mon === '*' && dow === '*') return `Hourly at :${pad(min)}`
    if (/^\d+$/.test(hour)) {
      const time = `${pad(hour)}:${pad(min)}`
      if (dom === '*' && mon === '*' && dow === '*') return `Daily at ${time}`
      if (dom === '*' && mon === '*' && /^\d+$/.test(dow)) return `${DAYS[Number(dow) % 7]} at ${time}`
      if (/^\d+$/.test(dom) && mon === '*' && dow === '*') return `Monthly (day ${dom}) at ${time}`
    }
  }
  return null
}

// Curated metadata for known jobs: which app/system a cron belongs to, a human
// title, and what the job actually does. Matched against the command, so the
// same registry serves every server. Unknown jobs fall through to a generic
// entry derived from their source file — they still show, just untitled.
interface CronMeta {
  app: string
  title: string
  description: string
}

// Curated cron metadata (app grouping, titles, descriptions, in-app scheduler
// inventory) is PRIVATE data — this repo is public — so it arrives as a prop
// from the server, which reads it from the gitignored vps-registry.json (see
// lib/server/vps/registry.ts). Without it, jobs still render with generic
// names derived from the command line.
function buildMatchers(meta: CronMetaRule[]): Array<[RegExp, CronMeta]> {
  const out: Array<[RegExp, CronMeta]> = []
  for (const m of meta) {
    try {
      out.push([new RegExp(m.match), { app: m.app, title: m.title, description: m.description }])
    } catch {
      /* skip an invalid pattern rather than break the card */
    }
  }
  return out
}

function metaFor(job: CronJob, matchers: Array<[RegExp, CronMeta]>): CronMeta {
  for (const [re, m] of matchers) if (re.test(job.command)) return m
  const base = (job.command.split(/\s+/)[0] || job.command).split('/').pop() || job.command
  return {
    app: job.source.startsWith('cron.d/') ? 'System' : `Host (${job.user})`,
    title: base,
    description: `Scheduled host task from ${job.source}.`,
  }
}

/** Collapsible group shell shared by the host-cron and in-app sections. */
function CronGroup({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-muted/40"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <span className="text-xs font-bold uppercase tracking-wide">{title}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground/70">{count}</span>
      </button>
      {open && <div className="mt-1.5 space-y-1.5 pl-2">{children}</div>}
    </div>
  )
}

/**
 * Host cron-job inventory — sits under Public IPs on a single server's page.
 * Data comes from the box itself (cron-status.sh -> cron.json), so the list is
 * what crond is actually running, not what we believe we installed. Jobs are
 * grouped per app/system (collapsed by default) with a curated title +
 * what-it-does description.
 */
export function CronCard({ crons, apps, cronMeta }: { crons?: VpsCrons | null; apps?: AppInfo[] | null; cronMeta?: CronRegistry | null }) {
  const matchers = buildMatchers(cronMeta?.meta || [])
  const inAppJobs = cronMeta?.inAppJobs || {}
  const appOrder = cronMeta?.appOrder || []
  // Collapsed by default; a click expands just that group.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  // In-app schedulers for apps deployed on THIS server (matched by app id).
  const inApp = (apps || [])
    .filter((a) => inAppJobs[a.id])
    .map((a) => inAppJobs[a.id])
  if ((!crons || crons.jobs.length === 0) && inApp.length === 0) return null
  const updatedMin = crons ? Math.max(0, Math.round((Date.now() - crons.generatedAtMs) / 60000)) : 0

  const groups = new Map<string, Array<{ job: CronJob; meta: CronMeta }>>()
  for (const job of crons?.jobs || []) {
    const meta = metaFor(job, matchers)
    const list = groups.get(meta.app) || []
    list.push({ job, meta })
    groups.set(meta.app, list)
  }
  const orderedApps = [
    ...appOrder.filter((a) => groups.has(a)),
    ...[...groups.keys()].filter((a) => !appOrder.includes(a)).sort(),
  ]

  const total = (crons?.jobs.length || 0) + inApp.reduce((n, g) => n + g.jobs.length, 0)

  return (
    <CollapsiblePanel
      id="crons"
      icon={Clock}
      title="Cron Jobs"
      meta={<span className="text-sm font-normal text-muted-foreground">({total})</span>}
      aside={
        <span className="text-xs text-muted-foreground">
          {crons ? `checked ${updatedMin === 0 ? 'just now' : `${updatedMin}m ago`}` : ''}
        </span>
      }
      contentClassName="space-y-2"
    >
        {orderedApps.map((app) => {
          const list = groups.get(app)!
          return (
            <CronGroup key={app} title={app} count={list.length} open={openGroups.has(app)} onToggle={() => toggle(app)}>
              {list.map(({ job, meta }, i) => {
                const human = humanSchedule(job.schedule)
                return (
                  <div
                    key={`${job.source}-${i}`}
                    title={`${job.command}\n(${job.source} · ${job.user})`}
                    className="rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-inset ring-border">
                          {job.schedule}
                        </span>
                        <span className="truncate text-sm font-medium">{meta.title}</span>
                      </span>
                      {human && <span className="shrink-0 text-xs text-muted-foreground">{human}</span>}
                    </div>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{meta.description}</p>
                  </div>
                )
              })}
            </CronGroup>
          )
        })}

        {inApp.length > 0 && (
          <div className="border-t pt-2">
            <div className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              In-app schedulers
              <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/70">
                run inside the app’s own process, not host cron
              </span>
            </div>
            <div className="space-y-2">
              {inApp.map((g) => (
                <CronGroup
                  key={g.app}
                  title={g.app}
                  count={g.jobs.length}
                  open={openGroups.has(`inapp:${g.app}`)}
                  onToggle={() => toggle(`inapp:${g.app}`)}
                >
                  {g.jobs.map((job) => (
                    <div key={job.title} className="rounded-lg border bg-muted/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-inset ring-border">
                            {job.cadence}
                          </span>
                          <span className="truncate text-sm font-medium">{job.title}</span>
                        </span>
                        {job.disabled && (
                          <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                            disabled
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground">{job.description}</p>
                    </div>
                  ))}
                </CronGroup>
              ))}
            </div>
          </div>
        )}
    </CollapsiblePanel>
  )
}
