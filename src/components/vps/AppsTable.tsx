'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LayoutGrid, ExternalLink, BarChart3 } from 'lucide-react'
import type { AppInfo } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'
import { SystemStatsDialog } from './SystemStatsDialog'

// Operational severity for a system: 0 = some/all containers down (show first),
// 1 = degraded, 2 = healthy or non-container.
function severity(a: AppInfo): number {
  if (a.total === 0) return 2
  if (a.running === 0) return 0
  return a.running < a.total ? 1 : 2
}

export function AppsTable({ apps, serverId = 'primary' }: { apps: AppInfo[]; serverId?: string }) {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  // Problems surface first (down, then degraded), healthy stay alphabetical.
  const ordered = [...apps].sort((a, b) => severity(a) - severity(b) || a.name.localeCompare(b.name))
  const containerized = apps.filter((a) => a.total > 0)
  const unhealthy = containerized.filter((a) => a.running < a.total).length
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          Systems &amp; Apps
          <span className="text-sm font-normal text-muted-foreground">({apps.length})</span>
        </CardTitle>
        {/* One-glance fleet health: green when every containerized system is fully up. */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
            unhealthy === 0
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', unhealthy === 0 ? 'bg-emerald-500' : 'bg-amber-500')} />
          {unhealthy === 0 ? 'all healthy' : `${unhealthy} need${unhealthy === 1 ? 's' : ''} attention`}
        </span>
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
              {ordered.map((a) => {
                const allUp = a.total > 0 && a.running === a.total
                const someDown = a.total > 0 && a.running < a.total
                return (
                  <tr key={a.id} className="border-b last:border-0 align-top hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.name}</span>
                        {a.type && (
                          <span className="rounded border px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                            {a.type}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 rounded-md border border-transparent px-1.5 text-xs text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                          onClick={() => setSelected({ id: a.id, name: a.name })}
                          title="View CPU & memory history"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          Stats
                        </Button>
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
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          non-container
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                            allUp
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : someDown
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              allUp ? 'bg-emerald-500' : someDown ? 'bg-amber-500' : 'bg-red-500'
                            )}
                          />
                          {a.running}/{a.total} up
                        </span>
                      )}
                      {a.services.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {a.services.map((s) => (
                            <span
                              key={s.name}
                              title={s.status}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full',
                                  s.state === 'running'
                                    ? 'bg-emerald-500'
                                    : s.state === 'restarting' || s.state === 'paused'
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                )}
                              />
                              {s.name}
                            </span>
                          ))}
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
      {selected && (
        <SystemStatsDialog
          systemId={selected.id}
          name={selected.name}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          serverId={serverId}
        />
      )}
    </Card>
  )
}
