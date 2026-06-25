'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Boxes, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { ContainerStat } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'
import { formatBytes, pct, usageColor } from './format'

type SortKey = 'name' | 'status' | 'cpu' | 'memory' | 'net'
type SortDir = 'asc' | 'desc'

const ACCESSORS: Record<SortKey, (c: ContainerStat) => number | string> = {
  name: (c) => c.name.toLowerCase(),
  status: (c) => c.status.toLowerCase(),
  cpu: (c) => c.cpuPct,
  memory: (c) => c.memUsedBytes,
  net: (c) => c.netRxBytes + c.netTxBytes,
}
const NUMERIC: Record<SortKey, boolean> = { name: false, status: false, cpu: true, memory: true, net: true }

export function ContainerTable({ containers }: { containers: ContainerStat[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'cpu', dir: 'desc' })
  // Containers share the host RAM limit — surface it once in the column header.
  const memTotal = containers.reduce((m, c) => Math.max(m, c.memLimitBytes || 0), 0)

  const sorted = useMemo(() => {
    const acc = ACCESSORS[sort.key]
    const arr = [...containers].sort((a, b) => {
      const av = acc(a)
      const bv = acc(b)
      const cmp =
        typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [containers, sort])

  const toggle = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: NUMERIC[key] ? 'desc' : 'asc' }
    )

  const SortHeader = ({ label, k, align = 'left', hint }: { label: string; k: SortKey; align?: 'left' | 'right'; hint?: string }) => {
    const active = sort.key === k
    return (
      <th className={cn('px-4 py-2 font-medium', align === 'right' ? 'text-right' : 'text-left')}>
        <button
          type="button"
          onClick={() => toggle(k)}
          className={cn(
            'inline-flex items-center gap-1 transition-colors hover:text-foreground',
            align === 'right' && 'flex-row-reverse',
            active && 'text-foreground'
          )}
        >
          {label}
          {active ? (
            sort.dir === 'asc' ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
        {hint && <span className="ml-1.5 normal-case font-normal text-muted-foreground/60">{hint}</span>}
      </th>
    )
  }

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
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-y text-xs uppercase tracking-wide text-muted-foreground">
                <SortHeader label="Name" k="name" />
                <SortHeader label="CPU" k="cpu" align="right" />
                <SortHeader label="Memory" k="memory" align="right" hint={memTotal ? formatBytes(memTotal) : undefined} />
                <SortHeader label="Net I/O" k="net" align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const memPct = pct(c.memUsedBytes, c.memLimitBytes)
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn('h-2 w-2 shrink-0 rounded-full', c.state === 'running' ? 'bg-emerald-500' : 'bg-red-500')}
                          title={c.state}
                        />
                        <span className="font-medium">{c.name}</span>
                      </div>
                      <div className={cn('mt-0.5 text-xs', c.state === 'running' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                        {c.status}
                      </div>
                      <div className="text-xs text-muted-foreground/70 truncate max-w-[220px]" title={c.image}>
                        {c.image}
                      </div>
                    </td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums', usageColor(c.cpuPct))}>
                      {c.cpuPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={memPct ? usageColor(memPct) : undefined}>{formatBytes(c.memUsedBytes)}</span>
                      {memPct > 0 && (
                        <span className={cn('ml-1.5 text-xs', usageColor(memPct))}>· {memPct}%</span>
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
