'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Server, Circle, AlertTriangle } from 'lucide-react'
import type { ServerSummary } from '@/lib/server/vps/types'

function Bar({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{pct == null ? '—' : `${pct}%`}</span></div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div>
    </div>
  )
}

export function ServerCard({ server }: { server: ServerSummary }) {
  const ago = server.updatedAtMs ? `${Math.round((Date.now() - server.updatedAtMs) / 1000)}s ago` : 'never'
  return (
    <Link href={`/server/${server.id}`} className="block">
      <Card className="transition hover:border-primary/50 hover:shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0"><div className="truncate text-sm font-semibold">{server.name}</div><div className="truncate text-xs text-muted-foreground">{server.subtitle}</div></div>
            </div>
            <div className="flex items-center gap-1 text-xs" title={server.online ? 'online' : 'offline'}>
              <Circle className={`h-2.5 w-2.5 ${server.online ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
              <span className="text-muted-foreground">{server.online ? 'online' : 'offline'}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Bar label="CPU" pct={server.cpuPct} /><Bar label="Mem" pct={server.memPct} /><Bar label="Disk" pct={server.diskPct} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>updated {ago}</span>
            {server.alertCount > 0 && <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" /> {server.alertCount}</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
