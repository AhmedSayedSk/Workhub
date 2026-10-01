'use client'

import { useState, type ReactNode } from 'react'
import { Layers } from 'lucide-react'
import type { PoolInfo } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'
import { formatBytes, pct, usageColor } from './format'
import { CollapsiblePanel } from './CollapsiblePanel'

// Rows shown before the "show all" toggle — a warm sandbox pool can run to
// dozens of near-identical containers.
const VISIBLE_ROWS = 8

/**
 * One pool of runtime-spawned containers (see lib/server/vps/pools.ts).
 *
 * Read-only on purpose: the system that spawned these owns their lifecycle, so
 * starting or stopping one from here would put it out of step with that
 * system's own bookkeeping.
 */
export function PoolCard({
  pool,
  appName,
  hostMemTotalBytes,
}: {
  pool: PoolInfo
  /** Display name of the system that spawns this pool, when known. */
  appName?: string
  hostMemTotalBytes?: number
}) {
  const [showAll, setShowAll] = useState(false)
  const stopped = pool.total - pool.running
  const memPct = hostMemTotalBytes ? (pool.memUsedBytes / hostMemTotalBytes) * 100 : null
  const rows = showAll ? pool.containers : pool.containers.slice(0, VISIBLE_ROWS)
  const hidden = pool.containers.length - VISIBLE_ROWS

  return (
    <CollapsiblePanel
      id={`pool:${pool.id}`}
      icon={Layers}
      title={pool.name}
      meta={
        <span className="text-sm font-normal text-muted-foreground">
          ({pool.running} running
          {stopped > 0 && <span className="text-red-500"> · {stopped} stopped</span>})
        </span>
      }
      // The pool's RAM is the figure this card exists for, so it stays on the
      // header when collapsed.
      aside={<span className="text-sm text-muted-foreground tabular-nums">{formatBytes(pool.memUsedBytes)}</span>}
      contentClassName="p-0"
    >
      {(pool.description || appName) && (
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          {pool.description}
          {appName && (
            <>
              {pool.description && ' · '}
              Spawned by <span className="font-medium text-foreground">{appName}</span>
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 px-4 pb-3">
        <Stat label="Memory">
          <span className="tabular-nums">{formatBytes(pool.memUsedBytes)}</span>
          {memPct != null && <span className="ml-1 text-xs font-normal text-muted-foreground">· {memPct.toFixed(1)}% of host</span>}
        </Stat>
        <Stat label="CPU">
          <span className={cn('tabular-nums', usageColor(pool.cpuPct))}>{pool.cpuPct.toFixed(1)}%</span>
        </Stat>
        <Stat label="Containers">
          <span className="tabular-nums">
            {pool.running}/{pool.total}
          </span>
          <span className="ml-1 text-xs font-normal text-muted-foreground">up</span>
        </Stat>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Container</th>
              <th className="px-4 py-2 text-right font-medium">CPU</th>
              <th className="px-4 py-2 text-right font-medium">Memory</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const running = c.state === 'running'
              const share = pct(c.memUsedBytes, hostMemTotalBytes || 0)
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="max-w-0 px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn('h-2 w-2 shrink-0 rounded-full', running ? 'bg-emerald-500' : 'bg-red-500')}
                        title={c.state}
                      />
                      <span className="truncate font-mono text-xs" title={c.name}>
                        {c.name}
                      </span>
                    </div>
                    <div
                      className={cn('mt-0.5 truncate text-xs', running ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}
                      title={c.image}
                    >
                      {c.status}
                    </div>
                  </td>
                  {/* Same convention as the containers table: a stopped
                      container holds nothing, so an em dash, not 0 B. */}
                  <td className={cn('px-4 py-2 text-right tabular-nums', running ? usageColor(c.cpuPct) : 'text-muted-foreground/50')}>
                    {running ? `${c.cpuPct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {running ? (
                      <>
                        {formatBytes(c.memUsedBytes)}
                        {share > 0 && <span className={cn('ml-1.5 text-xs', usageColor(share))}>· {share}%</span>}
                      </>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <div className="border-t px-4 py-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {showAll ? 'Show fewer' : `Show all ${pool.containers.length}`}
          </button>
        </div>
      )}
    </CollapsiblePanel>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{children}</div>
    </div>
  )
}
