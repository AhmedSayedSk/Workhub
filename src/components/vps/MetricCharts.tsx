'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type { MetricPoint, HostStats } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'
import { usageColor, pct, formatBytes, formatUptime } from './format'

const RANGES = ['1h', '24h', '7d'] as const
type Range = (typeof RANGES)[number]

const RANGE_MS: Record<Range, number> = { '1h': 3600_000, '24h': 86_400_000, '7d': 604_800_000 }

type MetricKey = 'cpuPct' | 'memPct' | 'diskPct' | 'load1'

interface ChartDef {
  key: MetricKey
  label: string
  color: string
  unit: string
  domain: [number | string, number | string]
  threshold?: number
  isPct: boolean
}

const CHARTS: ChartDef[] = [
  { key: 'cpuPct', label: 'CPU', color: '#00e0bd', unit: '%', domain: [0, 100], isPct: true },
  { key: 'memPct', label: 'Memory', color: '#8b8cf6', unit: '%', domain: [0, 100], threshold: 90, isPct: true },
  { key: 'diskPct', label: 'Disk', color: '#f6b73c', unit: '%', domain: [0, 100], threshold: 85, isPct: true },
  { key: 'load1', label: 'Load', color: '#f472b6', unit: '', domain: [0, 'auto'], isPct: false },
]

// Range-appropriate x labels: minutes for 1h, hours for 24h, dates for 7d.
function fmtTick(ts: number, range: Range): string {
  const d = new Date(ts)
  if (range === '1h') return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (range === '24h') return d.toLocaleTimeString([], { hour: 'numeric' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Evenly spread ~5 ticks across the selected window so the axis spans the
// whole time frame (not just where data points happen to fall).
function buildTicks(range: Range, end: number): number[] {
  const span = RANGE_MS[range]
  const start = end - span
  const n = 4
  return Array.from({ length: n + 1 }, (_, i) => Math.round(start + (span * i) / n))
}

function ChartTooltip(props: any) {
  const { active, payload, label, color, unit, metricLabel } = props
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="text-muted-foreground">{new Date(label as number).toLocaleString()}</div>
      <div className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {payload[0].value}
        {unit} <span className="text-muted-foreground font-normal">{metricLabel}</span>
      </div>
    </div>
  )
}

// The detail that used to live in each host card, now under its chart.
function PanelDetail({ k, host }: { k: MetricKey; host: HostStats }) {
  if (k === 'cpuPct') {
    return (
      <p className="truncate text-xs text-muted-foreground" title={host.cpu.model}>
        {host.cpu.cores} cores · {host.cpu.model}
      </p>
    )
  }
  if (k === 'memPct') {
    return (
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <div>
          {formatBytes(host.memory.usedBytes)} / {formatBytes(host.memory.totalBytes)} ·{' '}
          {formatBytes(host.memory.availableBytes)} free
        </div>
        {host.swap.totalBytes > 0 && (
          <div>
            Swap {formatBytes(host.swap.usedBytes)} / {formatBytes(host.swap.totalBytes)}
          </div>
        )}
      </div>
    )
  }
  if (k === 'diskPct') {
    return (
      <p className="text-xs text-muted-foreground">
        {formatBytes(host.disk.usedBytes)} / {formatBytes(host.disk.totalBytes)} ·{' '}
        {formatBytes(host.disk.availableBytes)} free
      </p>
    )
  }
  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <div>
        1m {host.cpu.load1} · 5m {host.cpu.load5} · 15m {host.cpu.load15}
      </div>
      <div className="truncate" title={host.os}>
        up {formatUptime(host.uptimeSec)} · {host.os}
      </div>
    </div>
  )
}

function MetricPanel({
  def,
  points,
  range,
  current,
  xDomain,
  xTicks,
  host,
}: {
  def: ChartDef
  points: MetricPoint[]
  range: Range
  current?: number
  xDomain: [number, number]
  xTicks: number[]
  host: HostStats | null
}) {
  const latest = current ?? (points.length ? (points[points.length - 1][def.key] as number) : null)
  const gid = `vps-grad-${def.key}`

  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{def.label}</span>
        {latest != null && (
          <span
            className={cn(
              'text-lg font-bold tabular-nums leading-none',
              def.isPct ? usageColor(latest) : 'text-foreground'
            )}
          >
            {latest}
            <span className="ml-0.5 text-xs font-medium text-muted-foreground">{def.unit}</span>
          </span>
        )}
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={def.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={def.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="currentColor" className="text-border" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={xDomain}
              ticks={xTicks}
              allowDataOverflow
              tickFormatter={(t) => fmtTick(t as number, range)}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis
              domain={def.domain as [number, number]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickCount={def.isPct ? 3 : 4}
            />
            {def.threshold != null && (
              <ReferenceLine
                y={def.threshold}
                stroke={def.color}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: `${def.threshold}%`, fontSize: 9, fill: def.color, position: 'insideTopRight' }}
              />
            )}
            <Tooltip
              content={<ChartTooltip color={def.color} unit={def.unit} metricLabel={def.label} />}
              cursor={{ stroke: def.color, strokeOpacity: 0.3, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey={def.key}
              stroke={def.color}
              strokeWidth={2}
              fill={`url(#${gid})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: def.color }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {host && (
        <div className="mt-2 border-t pt-2">
          <PanelDetail k={def.key} host={host} />
        </div>
      )}
    </div>
  )
}

export function MetricCharts({ host }: { host: HostStats | null }) {
  const [range, setRange] = useState<Range>('24h')
  const [points, setPoints] = useState<MetricPoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await authFetch(`/api/vps/history?range=${range}`)
      if (res.ok) {
        const data = await res.json()
        setPoints(data.points || [])
      }
    } catch {
      /* keep prior points */
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    fetchHistory()
    const id = setInterval(fetchHistory, 60_000)
    return () => clearInterval(id)
  }, [fetchHistory])

  const now = Date.now()
  const xDomain: [number, number] = [now - RANGE_MS[range], now]
  const xTicks = buildTicks(range, now)

  const current: Partial<Record<MetricKey, number>> | undefined = host
    ? {
        cpuPct: host.cpu.usagePct,
        memPct: pct(host.memory.usedBytes, host.memory.totalBytes),
        diskPct: pct(host.disk.usedBytes, host.disk.totalBytes),
        load1: host.cpu.load1,
      }
    : undefined

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Resource Monitor
        </CardTitle>
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant="ghost"
              onClick={() => setRange(r)}
              className={cn(
                'h-6 px-2.5 text-xs font-medium',
                r === range ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 && !host ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {loading ? 'Loading…' : 'No data yet.'}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {CHARTS.map((def) => (
              <MetricPanel
                key={def.key}
                def={def}
                points={points}
                range={range}
                current={current?.[def.key]}
                xDomain={xDomain}
                xTicks={xTicks}
                host={host}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
