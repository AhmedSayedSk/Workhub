'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VpsCrons, CronJob, AppInfo } from '@/lib/server/vps/types'

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

// Schedulers that live INSIDE an app's own process — invisible to the host
// cron inventory, but very much scheduled work running on the box. Curated
// per app id (as discovered in Systems & Apps) and only shown for apps that
// are actually deployed on the server being viewed.
interface InAppJob {
  cadence: string // short pill text ('30s', '13–18h EET', …)
  title: string
  description: string
  disabled?: boolean
}

// Verified 2026-08-07 by sweeping every /opt/<app> source tree on the box for
// setInterval / cron-library / APScheduler usage. Apps with NO internal
// schedulers (bg-api, img-gen-api, tts-api, extensions-api, whisperlock,
// coffeepos, echonote, erp-site) are deliberately absent. SSE heartbeats and
// TTL-cache sweeps are not listed — they're plumbing, not scheduled work.
const IN_APP_JOBS: Record<string, { app: string; jobs: InAppJob[] }> = {
  'fasah-manager': {
    app: 'Fasah Manager',
    jobs: [
      {
        cadence: '30s · 13–18h Cairo',
        title: 'Transit openings watcher',
        description:
          'Inside fasah-api: polls the Fasah transit schedule every 30s during the daily 1–6 PM Cairo window and records each port’s opening/closing time; stops polling a port once its opening is captured.',
      },
    ],
  },
  publish: {
    app: 'Sikasio Publish',
    jobs: [
      {
        cadence: '30s',
        title: 'Post publisher',
        description: 'Inside the publish worker: checks every 30s for due scheduled posts and publishes them to the connected social platforms.',
      },
      {
        cadence: '2m',
        title: 'Comments sync',
        description: 'Pulls new comments/replies from the platforms into the inbox every 2 minutes.',
      },
      {
        cadence: '1h',
        title: 'Metrics sync',
        description: 'Refreshes per-post engagement metrics (views, likes, shares) hourly.',
      },
    ],
  },
  'adgen-api': {
    app: 'AdGen API',
    jobs: [
      {
        cadence: '4s',
        title: 'Image-batch processor',
        description: 'Claims queued campaign image-generation batches from the job table every 4s; overlapping ticks are skipped so a long batch just delays the next claim.',
      },
      {
        cadence: '5s',
        title: 'Webhook delivery worker',
        description: 'Delivers customer webhooks every 5s with exponential backoff retries (1m → 5m → 30m → 2h → 6h) for endpoints that are down.',
      },
      {
        cadence: '2m',
        title: 'Status monitor',
        description: 'Probes the pipeline every 2 minutes and records uptime/latency rollups behind the public /status page.',
      },
      {
        cadence: '24h',
        title: 'Subscription reconciler',
        description: 'Daily pass comparing local plans against Polar billing, downgrading accounts whose subscription lapsed.',
      },
    ],
  },
  'gs-powersign-dashboard': {
    app: 'GS PowerSign Dashboard',
    jobs: [
      {
        cadence: '2s',
        title: 'Metric warmer',
        description: 'Cycles through the device roster a few screens per tick, pre-computing health metrics into Redis so the dashboard reads them instantly instead of timing out.',
      },
    ],
  },
  'whatsapp-api': {
    app: 'WhatsApp API',
    jobs: [
      {
        cadence: '30s',
        title: 'Session keepalive',
        description: 'Sends a presence update + ping to WhatsApp every 30s so the Baileys session never freezes and messages keep flowing.',
      },
    ],
  },
  ask2do: {
    app: 'Ask2Do',
    jobs: [
      {
        cadence: '30s',
        title: 'Cloud-sidecar reconciler',
        description:
          'Inside ask2do-cloud-sidecar: polls cloud’s admin API every 30s for the desired tenant set, diff-applies runner starts/stops and recovers crashed runners with backoff.',
      },
    ],
  },
  ftw: {
    app: 'FTW',
    jobs: [
      {
        cadence: 'disabled',
        title: 'APScheduler jobs (5)',
        disabled: true,
        description:
          'Inside ftw-backend-api: health scores (daily 03:00), monthly reports (day 1), birthday broadcast (hourly :05), smart reminders (:35), automation rules (:50) — currently OFF (SCHEDULER_ENABLED=false).',
      },
    ],
  },
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
export function CronCard({ crons, apps }: { crons?: VpsCrons | null; apps?: AppInfo[] | null }) {
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
    .filter((a) => IN_APP_JOBS[a.id])
    .map((a) => IN_APP_JOBS[a.id])
  if ((!crons || crons.jobs.length === 0) && inApp.length === 0) return null
  const updatedMin = crons ? Math.max(0, Math.round((Date.now() - crons.generatedAtMs) / 60000)) : 0

  const groups = new Map<string, Array<{ job: CronJob; meta: CronMeta }>>()
  for (const job of crons?.jobs || []) {
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
          {(crons?.jobs.length || 0) + inApp.reduce((n, g) => n + g.jobs.length, 0)} scheduled
          {crons ? ` · checked ${updatedMin === 0 ? 'just now' : `${updatedMin}m ago`}` : ''}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
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
      </CardContent>
    </Card>
  )
}
