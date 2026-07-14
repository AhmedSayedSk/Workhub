'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Server, AlertTriangle, Cpu, MemoryStick, HardDrive } from 'lucide-react'
import type { ServerSummary } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'

// Threshold colouring so a glance reads health: green ok, amber busy, red hot.
function barColor(pct: number | null): string {
  if (pct == null) return 'bg-muted-foreground/30'
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 75) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function Metric({ icon: Icon, label, pct }: { icon: typeof Cpu; label: string; pct: number | null }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-semibold leading-none tabular-nums">{pct == null ? '—' : `${Math.round(pct)}%`}</div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', barColor(pct))} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
      </div>
    </div>
  )
}

export function ServerCard({ server }: { server: ServerSummary }) {
  const ago = server.updatedAtMs ? `${Math.round((Date.now() - server.updatedAtMs) / 1000)}s ago` : 'never'
  return (
    <Link href={`/server/${server.id}`} className="block h-full">
      <Card className="flex h-full min-h-[248px] flex-col justify-between gap-5 p-5 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
            <span className={cn('h-1.5 w-1.5 rounded-full', server.online ? 'bg-emerald-500' : 'bg-red-500', server.online && 'animate-pulse')} />
            {server.online ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2.5">
          <Metric icon={Cpu} label="CPU" pct={server.cpuPct} />
          <Metric icon={MemoryStick} label="Memory" pct={server.memPct} />
          <Metric icon={HardDrive} label="Disk" pct={server.diskPct} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium capitalize">{server.mode}</span>
            <span>updated {ago}</span>
          </span>
          {server.alertCount > 0 && (
            <span className="flex items-center gap-1 font-medium text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" /> {server.alertCount} alert{server.alertCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </Card>
    </Link>
  )
}
