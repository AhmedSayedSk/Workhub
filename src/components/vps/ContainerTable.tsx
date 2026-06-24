import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Boxes } from 'lucide-react'
import type { ContainerStat } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'
import { formatBytes, pct, usageColor } from './format'

export function ContainerTable({ containers }: { containers: ContainerStat[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="h-4 w-4 text-muted-foreground" />
          Containers
          <span className="text-sm font-normal text-muted-foreground">({containers.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">CPU</th>
                <th className="px-4 py-2 text-right font-medium">Memory</th>
                <th className="px-4 py-2 text-right font-medium">Net I/O</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => {
                const memPct = pct(c.memUsedBytes, c.memLimitBytes)
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[220px]" title={c.image}>
                        {c.image}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={c.state === 'running' ? 'secondary' : 'destructive'} className="font-normal">
                        {c.status}
                      </Badge>
                    </td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums', usageColor(c.cpuPct))}>
                      {c.cpuPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={memPct ? usageColor(memPct) : undefined}>{formatBytes(c.memUsedBytes)}</span>
                      {c.memLimitBytes > 0 && (
                        <span className="text-muted-foreground"> / {formatBytes(c.memLimitBytes)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      ↓ {formatBytes(c.netRxBytes)} · ↑ {formatBytes(c.netTxBytes)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
