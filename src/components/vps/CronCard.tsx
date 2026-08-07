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

// 'crontab:sikasio' -> 'crontab · sikasio', 'cron.d/security-status' -> 'cron.d · security-status'
function sourceLabel(job: CronJob): string {
  const src = job.source.replace(/[:/]/, ' · ')
  return job.user && !job.source.includes(job.user) ? `${src} · ${job.user}` : src
}

/**
 * Host cron-job inventory — sits under Public IPs on a single server's page.
 * Data comes from the box itself (cron-status.sh -> cron.json), so the list is
 * what crond is actually running, not what we believe we installed.
 */
export function CronCard({ crons }: { crons?: VpsCrons | null }) {
  if (!crons || crons.jobs.length === 0) return null
  const updatedMin = Math.max(0, Math.round((Date.now() - crons.generatedAtMs) / 60000))

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
      <CardContent className="space-y-1.5">
        {crons.jobs.map((job, i) => {
          const human = humanSchedule(job.schedule)
          return (
            <div
              key={`${job.source}-${i}`}
              className="flex w-full items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="shrink-0 rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-inset ring-border"
                  title={human || job.schedule}
                >
                  {job.schedule}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs" title={job.command}>
                    {job.command}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {human ? `${human} · ` : ''}
                    {sourceLabel(job)}
                  </span>
                </span>
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
