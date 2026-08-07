'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { VpsCrons, CronJob } from '@/lib/server/vps/types'

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

const CRON_META: Array<[RegExp, CronMeta]> = [
  [/cron-scheduler\.sh/, {
    app: 'WorkHub',
    title: 'Social post scheduler',
    description: 'Publishes due scheduled social & campaign posts (Meta/LinkedIn). Idle runs are silent; activity is logged to scheduler.log.',
  }],
  [/cron-sampler\.sh/, {
    app: 'WorkHub',
    title: 'Metrics sampler',
    description: 'Records a CPU / RAM / disk / per-system snapshot to Firestore — the data behind the resource-monitor charts on this page.',
  }],
  [/cron-rollup\.sh/, {
    app: 'WorkHub',
    title: 'Metrics hourly rollup',
    description: 'Compacts per-minute samples into hourly host & per-system history (powers the 30-day chart ranges, 35-day retention).',
  }],
  [/cron-render-sweep\.sh/, {
    app: 'WorkHub',
    title: 'Render-job sweep',
    description: 'Settles AdGen image/video render jobs whose completion webhook was missed, so campaigns finish without a browser tab open.',
  }],
  [/security-status\.sh/, {
    app: 'Server dashboard',
    title: 'Security audit',
    description: 'Re-runs the security posture checks (SSH, firewall, updates…) that feed the Security panel in the page header.',
  }],
  [/cron-status\.sh/, {
    app: 'Server dashboard',
    title: 'Cron inventory',
    description: 'Refreshes the list you are reading now — inventories user crontabs and /etc/cron.d into cron.json for this card.',
  }],
  [/docker builder prune/, {
    app: 'Docker',
    title: 'Build-cache prune',
    description: 'Trims Docker build cache nightly so on-box image builds cannot slowly fill the disk.',
  }],
  [/e2scrub/, {
    app: 'System',
    title: 'Filesystem scrub (e2scrub)',
    description: 'Ubuntu stock job: periodic ext4 metadata check of LVM volumes; no-op on this layout (guarded by a systemd test).',
  }],
  [/debian-sa1/, {
    app: 'System',
    title: 'sysstat activity logging',
    description: 'Ubuntu stock job: collects kernel activity counters for the sar/sysstat toolbox.',
  }],
]

function metaFor(job: CronJob): CronMeta {
  for (const [re, m] of CRON_META) if (re.test(job.command)) return m
  const base = (job.command.split(/\s+/)[0] || job.command).split('/').pop() || job.command
  return {
    app: job.source.startsWith('cron.d/') ? 'System' : `Host (${job.user})`,
    title: base,
    description: `Scheduled host task from ${job.source}.`,
  }
}

// Apps in the order they matter on an ops page: our product first, then the
// dashboard's own plumbing, then infra. Anything unrecognised lands after.
const APP_ORDER = ['WorkHub', 'Server dashboard', 'Docker', 'System']

/**
 * Host cron-job inventory — sits under Public IPs on a single server's page.
 * Data comes from the box itself (cron-status.sh -> cron.json), so the list is
 * what crond is actually running, not what we believe we installed. Jobs are
 * grouped per app/system with a curated title + what-it-does description.
 */
export function CronCard({ crons }: { crons?: VpsCrons | null }) {
  if (!crons || crons.jobs.length === 0) return null
  const updatedMin = Math.max(0, Math.round((Date.now() - crons.generatedAtMs) / 60000))

  const groups = new Map<string, Array<{ job: CronJob; meta: CronMeta }>>()
  for (const job of crons.jobs) {
    const meta = metaFor(job)
    const list = groups.get(meta.app) || []
    list.push({ job, meta })
    groups.set(meta.app, list)
  }
  const orderedApps = [
    ...APP_ORDER.filter((a) => groups.has(a)),
    ...[...groups.keys()].filter((a) => !APP_ORDER.includes(a)).sort(),
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Cron Jobs
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {crons.jobs.length} scheduled · checked {updatedMin === 0 ? 'just now' : `${updatedMin}m ago`}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {orderedApps.map((app) => {
          const list = groups.get(app)!
          return (
            <div key={app}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{app}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground/70">{list.length}</span>
              </div>
              <div className="space-y-1.5">
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
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
