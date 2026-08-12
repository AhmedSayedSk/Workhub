'use client'

import { useState, useMemo } from 'react'
import {
  Boxes,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MoreVertical,
  Play,
  RotateCw,
  Square,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/useToast'
import { authFetch } from '@/lib/api-client'
import type { ContainerStat } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'
import { formatBytes, pct, usageColor } from './format'
import { CollapsiblePanel } from './CollapsiblePanel'

type Action = 'start' | 'stop' | 'restart'

const ACTION_LABEL: Record<Action, string> = { start: 'Start', stop: 'Stop', restart: 'Restart' }

/** How long to let a container settle before re-reading its usage figures. */
const SETTLE_MS = 2000

/**
 * UI mirror of the server's protection rule (lib/server/vps/control.ts). This
 * only decides whether to offer the buttons — the API enforces it again and is
 * the authority, so the two drifting apart degrades to a 403, never to an
 * action that shouldn't have run.
 */
function isProtected(name: string): boolean {
  const n = name.replace(/^\//, '').toLowerCase()
  if (n.includes('dockerproxy') || n.includes('docker-socket-proxy')) return true
  return n === 'workhub' || n.startsWith('workhub-') || n.startsWith('workhub_')
}

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

export function ContainerTable({
  containers,
  hostMemTotalBytes,
  hostMemUsedBytes,
  serverId,
  canControl = false,
  onChanged,
}: {
  containers: ContainerStat[]
  hostMemTotalBytes?: number
  hostMemUsedBytes?: number
  serverId?: string
  /** Remote servers report one-way, so their rows stay read-only. */
  canControl?: boolean
  onChanged?: () => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'memory', dir: 'desc' })
  const { toast } = useToast()
  const [confirm, setConfirm] = useState<{ container: ContainerStat; action: Action } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const run = async () => {
    if (!confirm) return
    const { container, action } = confirm
    setBusyId(container.id)
    setConfirm(null)
    try {
      const res = await authFetch('/api/vps/containers/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serverId, containerId: container.id, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      toast({
        title: `${ACTION_LABEL[action]}ed ${container.name}`,
        description:
          action === 'stop'
            ? 'It stays listed so you can start it again.'
            : 'Usage figures update as it comes back up.',
      })
      // Docker answers as soon as it has ACCEPTED the change — the container may
      // still be shutting down or booting. Refresh at once so the row reacts,
      // then once more after it has settled, so the CPU and memory shown are the
      // real post-action figures rather than a snapshot taken mid-transition.
      onChanged?.()
      await new Promise((r) => setTimeout(r, SETTLE_MS))
      onChanged?.()
    } catch (e) {
      toast({
        title: `Could not ${action} ${container.name}`,
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }
  // Memory % is measured against the HOST's total RAM (shown once in the header),
  // NOT each container's own cgroup cap — otherwise a capped container (e.g. an
  // AI worker limited to 1.4G) would read ~98% while using only ~35% of the box.
  // Fall back to the largest container limit only if the host total is unknown.
  const memTotal = hostMemTotalBytes || containers.reduce((m, c) => Math.max(m, c.memLimitBytes || 0), 0)

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

  // The list includes stopped containers, so a bare total would read as
  // "28 running". Call the stopped ones out, and keep the count on the header
  // so a collapsed panel still reports anything down.
  const down = containers.filter((c) => c.state !== 'running').length

  return (
    <CollapsiblePanel
      id="containers"
      icon={Boxes}
      title="Containers"
      meta={
        <span className="text-sm font-normal text-muted-foreground">
          ({containers.length - down} running
          {down > 0 && <span className="text-red-500"> · {down} stopped</span>})
        </span>
      }
      contentClassName="p-0"
    >
        {/* Reconciliation: the containers' share + everything outside Docker
            (OS, dockerd, sshd, kernel) = the host figure the Resources chart
            shows — so the two views always visibly add up. */}
        {hostMemTotalBytes && hostMemUsedBytes ? (() => {
          const cSum = containers.reduce((s, c) => s + (c.memUsedBytes || 0), 0)
          const cPct = (cSum / hostMemTotalBytes) * 100
          const hostPct = (hostMemUsedBytes / hostMemTotalBytes) * 100
          const sysPct = Math.max(0, hostPct - cPct)
          return (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2.5 text-xs text-muted-foreground">
              <span>Containers <span className="font-semibold text-foreground tabular-nums">{cPct.toFixed(1)}%</span></span>
              <span>+</span>
              <span>System &amp; OS <span className="font-semibold text-foreground tabular-nums">{sysPct.toFixed(1)}%</span></span>
              <span>=</span>
              <span>Host memory used <span className="font-semibold text-foreground tabular-nums">{hostPct.toFixed(1)}%</span></span>
              <span className="ml-1 opacity-70">(matches the Resources chart)</span>
            </div>
          )
        })() : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-y text-xs uppercase tracking-wide text-muted-foreground">
                <SortHeader label="Name" k="name" />
                <SortHeader label="CPU" k="cpu" align="right" />
                <SortHeader label="Memory" k="memory" align="right" hint={memTotal ? formatBytes(memTotal) : undefined} />
                <SortHeader label="Net I/O" k="net" align="right" />
                {canControl && <th className="w-10 px-2" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const memPct = pct(c.memUsedBytes, memTotal)
                const stopped = c.state !== 'running'
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
                    {/* A stopped container holds nothing, so show an em dash
                        rather than 0.0% / 0 B — zeros read as a live container
                        that is idle, which is a different thing entirely. */}
                    <td className={cn('px-4 py-2.5 text-right tabular-nums', stopped ? 'text-muted-foreground/50' : usageColor(c.cpuPct))}>
                      {stopped ? '—' : `${c.cpuPct.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {stopped ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : (
                        <>
                          <span className={memPct ? usageColor(memPct) : undefined}>{formatBytes(c.memUsedBytes)}</span>
                          {memPct > 0 && (
                            <span className={cn('ml-1.5 text-xs', usageColor(memPct))}>· {memPct}%</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums', stopped ? 'text-muted-foreground/50' : 'text-muted-foreground')}>
                      {stopped ? '—' : <>↓ {formatBytes(c.netRxBytes)} · ↑ {formatBytes(c.netTxBytes)}</>}
                    </td>
                    {canControl && (
                      <td className="px-2 py-2.5 text-right">
                        <ContainerActions
                          container={c}
                          busy={busyId === c.id}
                          onPick={(action) => setConfirm({ container: c, action })}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm ? `${ACTION_LABEL[confirm.action]} ${confirm.container.name}?` : ''}
        description={
          confirm ? (
            <div className="space-y-2">
              <p>
                {confirm.action === 'stop'
                  ? 'This container will stop serving immediately. Anything depending on it goes down until it is started again.'
                  : confirm.action === 'restart'
                    ? 'The container stops and starts again. Expect a short interruption while it comes back up.'
                    : 'The container will be started with its existing configuration.'}
              </p>
              <p className="text-xs text-muted-foreground">
                Image: <span className="font-mono">{confirm.container.image}</span>
              </p>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel={confirm ? ACTION_LABEL[confirm.action] : 'Confirm'}
        variant={confirm?.action === 'stop' ? 'destructive' : 'default'}
        onConfirm={run}
      />
    </CollapsiblePanel>
  )
}

function ContainerActions({
  container,
  busy,
  onPick,
}: {
  container: ContainerStat
  busy: boolean
  onPick: (action: Action) => void
}) {
  if (isProtected(container.name)) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground/40"
        title="Protected — acting on this container would break the dashboard itself."
      >
        <ShieldAlert className="h-3.5 w-3.5" />
      </span>
    )
  }

  if (busy) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    )
  }

  const running = container.state === 'running'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Actions for ${container.name}`}
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {running ? (
          <>
            <DropdownMenuItem onClick={() => onPick('restart')} className="gap-2">
              <RotateCw className="h-3.5 w-3.5" /> Restart
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onPick('stop')}
              className="gap-2 text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => onPick('start')} className="gap-2">
            <Play className="h-3.5 w-3.5" /> Start
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
