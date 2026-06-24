import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LayoutGrid, ExternalLink } from 'lucide-react'
import type { AppInfo } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'

export function AppsTable({ apps }: { apps: AppInfo[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          Systems &amp; Apps
          <span className="text-sm font-normal text-muted-foreground">({apps.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">System</th>
                <th className="px-4 py-2 text-left font-medium">Path</th>
                <th className="px-4 py-2 text-left font-medium">Domains</th>
                <th className="px-4 py-2 text-left font-medium">Containers</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const allUp = a.total > 0 && a.running === a.total
                const someDown = a.total > 0 && a.running < a.total
                return (
                  <tr key={a.id} className="border-b last:border-0 align-top hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.name}</span>
                        <Badge variant="outline" className="font-normal text-[10px] uppercase">
                          {a.type}
                        </Badge>
                      </div>
                      {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{a.path || '—'}</code>
                    </td>
                    <td className="px-4 py-3">
                      {a.domains.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {a.domains.map((d) => (
                            <a
                              key={d}
                              href={`https://${d.split('/')[0]}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              {d}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.total === 0 ? (
                        <span className="text-xs text-muted-foreground">non-container</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              allUp ? 'bg-emerald-500' : someDown ? 'bg-amber-500' : 'bg-red-500'
                            )}
                          />
                          <span className="text-xs tabular-nums">
                            {a.running}/{a.total} up
                          </span>
                        </div>
                      )}
                      {a.services.length > 0 && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground truncate max-w-[220px]">
                          {a.services.map((s) => s.name).join(', ')}
                        </div>
                      )}
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
