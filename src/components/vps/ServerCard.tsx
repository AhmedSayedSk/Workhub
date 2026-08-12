'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Server, AlertTriangle, Cpu, MemoryStick, HardDrive, Boxes, ChevronRight } from 'lucide-react'
import type { ServerSummary } from '@/lib/server/vps/types'
import { formatBytes } from './format'
import { ServerIps } from './ServerIps'
import { cn } from '@/lib/utils'

// Threshold colouring so a glance reads health: green ok, amber busy, red hot.
function barColor(pct: number | null): string {
  if (pct == null) return 'bg-muted-foreground/30'
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 75) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function Metric({ icon: Icon, label, pct, sub }: { icon: typeof Cpu; label: string; pct: number | null; sub: string }) {
  // A 6% bar is a dot at normal widths. Floor any non-zero value at a visible
  // sliver so "barely used" still reads as used rather than as no data.
  const width = pct == null || pct <= 0 ? 0 : Math.max(2.5, Math.min(100, pct))
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-semibold leading-none tabular-nums">{pct == null ? '—' : `${Math.round(pct)}%`}</div>
      <div className="text-[11px] tabular-nums text-muted-foreground">{sub}</div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all motion-reduce:transition-none', barColor(pct))}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export function ServerCard({ server }: { server: ServerSummary }) {
  const ago = server.updatedAtMs ? `${Math.round((Date.now() - server.updatedAtMs) / 1000)}s ago` : 'never'
  const hasAlerts = server.alertCount > 0

  return (
    <Link href={`/server/${server.id}`} className="group block h-full">
      <Card
        className={cn(
          'flex h-full flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md',
          // A server needing attention is visible from the grid, before you read
          // any number on it.
          hasAlerts && 'border-amber-500/40',
          !server.online && 'border-red-500/40'
        )}
      >
        {/* ---- Identity ------------------------------------------------- */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                server.online ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              <Server className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold leading-tight">{server.name}</div>
              <div className="truncate text-xs text-muted-foreground">{server.subtitle}</div>
            </div>
          </div>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              server.online
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                server.online ? 'bg-emerald-500' : 'bg-red-500',
                server.online && 'animate-pulse motion-reduce:animate-none'
              )}
            />
            {server.online ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* ---- Resources ------------------------------------------------
            Capped to ONE line of addresses above: a wrapping chip row made
            this card taller than its neighbour, which knocked every metric
            out of alignment across the grid. The full list lives on the
            detail page, where there is room for it. */}
        <ServerIps ips={server.ips} max={1} className="-mt-1" />

        {/* Metrics — % usage with the total capacity underneath */}
        <div className="grid grid-cols-3 gap-2.5">
          <Metric icon={Cpu} label="CPU" pct={server.cpuPct} sub={server.cpuCores != null ? `${server.cpuCores} vCPU` : '—'} />
          <Metric icon={MemoryStick} label="Memory" pct={server.memPct} sub={server.memTotalBytes != null ? formatBytes(server.memTotalBytes) : '—'} />
          <Metric icon={HardDrive} label="Disk" pct={server.diskPct} sub={server.diskTotalBytes != null ? formatBytes(server.diskTotalBytes) : '—'} />
        </div>

        {/* ---- Footer ---------------------------------------------------- */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium capitalize">{server.mode}</span>
            {server.containers != null && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Boxes className="h-3.5 w-3.5" /> {server.containers}
              </span>
            )}
            {hasAlerts && (
              <span className="flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {server.alertCount} issue{server.alertCount === 1 ? '' : 's'}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            {ago}
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </div>
      </Card>
    </Link>
  )
}
