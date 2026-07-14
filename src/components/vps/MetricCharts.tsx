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

const RANGES = ['1h', '8h', '24h', '7d'] as const
type Range = (typeof RANGES)[number]

const RANGE_MS: Record<Range, number> = {
  '1h': 3600_000,
  '8h': 28_800_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
}

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

type TickMode = 'min' | 'hour' | 'date'

// Labels match the ACTUAL visible span: minutes for short spans, hours for a
// day-ish, dates for multi-day.
function fmtTick(ts: number, mode: TickMode): string {
  const d = new Date(ts)
  if (mode === 'min') return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (mode === 'hour') return d.toLocaleTimeString([], { hour: 'numeric' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Evenly spread ~5 ticks across [start, end].
function buildTicks(start: number, end: number): number[] {
  const n = 4
  return Array.from({ length: n + 1 }, (_, i) => Math.round(start + ((end - start) * i) / n))
}

// Auto-fit the Y axis to the data range (with padding) so low or flat series
// fill the panel instead of hugging the baseline. Percentages stay clamped to
// 0-100; a near-flat series gets breathing room around its value.
function fitDomain(values: number[], isPct: boolean): [number, number] {
  if (!values.length) return isPct ? [0, 100] : [0, 1]
  let min = Math.min(...values)
  let max = Math.max(...values)
  const flat = isPct ? 2 : 0.2
  if (max - min < flat) {
    const mid = (min + max) / 2
    min = mid - flat
    max = mid + flat
  }
  const pad = (max - min) * 0.2
  let lo = Math.max(0, min - pad)
  let hi = max + pad
  if (isPct) hi = Math.min(100, hi)
  if (isPct) return [Math.floor(lo), Math.ceil(hi)]
  return [Math.floor(lo * 10) / 10, Math.ceil(hi * 10) / 10]
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
  fmtMode,
  current,
  xDomain,
  xTicks,
  host,
}: {
  def: ChartDef
  points: MetricPoint[]
  fmtMode: TickMode
  current?: number
  xDomain: [number, number]
  xTicks: number[]
  host: HostStats | null
}) {
  // Prefer the latest recorded point so the headline number matches the chart's
  // right edge. The live host snapshot computes CPU over a ~1s window that is
  // phase-locked to the once-a-minute cron spike (reads ~80% on an idle box),
  // while the recorded series is a rolling 60s average (the true value). Falls
  // back to the live value only before any history has loaded.
  const lastPoint = points.length ? (points[points.length - 1][def.key] as number) : null
  const latest = (typeof lastPoint === 'number' ? lastPoint : null) ?? current ?? null
  const gid = `vps-grad-${def.key}`
  // Show sample dots when the series is sparse (reads better than a thin line);
  // hide them once the line is dense enough to be smooth on its own.
  const showDots = points.length > 0 && points.length <= 60
  // Auto-scale the Y axis to the visible data so low/flat series are readable.
  const yValues = points
    .map((p) => p[def.key])
    .filter((v): v is number => typeof v === 'number')
  const yDomain = fitDomain(yValues, def.isPct)

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
      <div className="h-40">
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
              tickFormatter={(t) => fmtTick(t as number, fmtMode)}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis
              domain={yDomain}
              allowDecimals={!def.isPct}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickCount={4}
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
              dot={showDots ? { r: 2, fill: def.color, stroke: 'none' } : false}
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

export function MetricCharts({ host, serverId = 'primary' }: { host: HostStats | null; serverId?: string }) {
  const [range, setRange] = useState<Range>('24h')
  const [points, setPoints] = useState<MetricPoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await authFetch(`/api/vps/history?serverId=${encodeURIComponent(serverId)}&range=${range}`)
      if (res.ok) {
        const data = await res.json()
        setPoints(data.points || [])
      }
    } catch {
      /* keep prior points */
    } finally {
      setLoading(false)
    }
  }, [serverId, range])

  useEffect(() => {
    setLoading(true)
    fetchHistory()
    const id = setInterval(fetchHistory, 60_000)
    return () => clearInterval(id)
  }, [fetchHistory])

  // Fit the x-axis to the data actually present within the selected window, so
  // a partly-filled 24h/7d view spreads its data across the width instead of
  // squashing it into the right edge. Expands to the full window as data fills.
  const now = Date.now()
  const dataStart = points.length ? points[0].ts : now - RANGE_MS[range]
  const spanStart = Math.min(dataStart, now - 60_000)
  const xDomain: [number, number] = [spanStart, now]
  const effSpan = now - spanStart
  const fmtMode: TickMode = effSpan < 2 * 3_600_000 ? 'min' : effSpan < 36 * 3_600_000 ? 'hour' : 'date'
  const xTicks = buildTicks(spanStart, now)

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
                fmtMode={fmtMode}
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
