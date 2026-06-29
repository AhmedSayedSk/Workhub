'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/api-client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { SystemPoint } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'
import { formatBytes } from './format'

const RANGES = ['24h', '3d', '7d', '30d'] as const
type Range = (typeof RANGES)[number]

const RANGE_MS: Record<Range, number> = {
  '24h': 86_400_000,
  '3d': 3 * 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
}

type TickMode = 'hour' | 'date'

function fmtTick(ts: number, mode: TickMode): string {
  const d = new Date(ts)
  if (mode === 'hour') return d.toLocaleTimeString([], { hour: 'numeric' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function buildTicks(start: number, end: number): number[] {
  const n = 4
  return Array.from({ length: n + 1 }, (_, i) => Math.round(start + ((end - start) * i) / n))
}

// Auto-fit a Y axis to the data with padding, so low/flat series fill the panel.
function fitDomain(values: number[], floor0 = true): [number, number] {
  if (!values.length) return [0, 1]
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 1e-6) {
    const mid = (min + max) / 2 || 1
    min = mid * 0.5
    max = mid * 1.5
  }
  const pad = (max - min) * 0.2
  const lo = floor0 ? Math.max(0, min - pad) : min - pad
  return [lo, max + pad]
}

interface ChartDef {
  key: 'cpu' | 'mem'
  label: string
  color: string
  fmt: (v: number) => string
}

const CHARTS: ChartDef[] = [
  { key: 'cpu', label: 'CPU', color: '#00e0bd', fmt: (v) => `${v}%` },
  { key: 'mem', label: 'Memory', color: '#8b8cf6', fmt: (v) => formatBytes(v) },
]

function ChartTooltip(props: any) {
  const { active, payload, label, color, metricLabel, fmt } = props
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="text-muted-foreground">{new Date(label as number).toLocaleString()}</div>
      <div className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {fmt(payload[0].value as number)} <span className="text-muted-foreground font-normal">{metricLabel}</span>
      </div>
    </div>
  )
}

function MetricPanel({
  def,
  points,
  fmtMode,
  xDomain,
  xTicks,
}: {
  def: ChartDef
  points: SystemPoint[]
  fmtMode: TickMode
  xDomain: [number, number]
  xTicks: number[]
}) {
  const gid = `sys-grad-${def.key}`
  const showDots = points.length > 0 && points.length <= 60
  const latest = points.length ? (points[points.length - 1][def.key] as number) : null
  const yValues = points.map((p) => p[def.key] as number)
  const yDomain = fitDomain(yValues)

  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{def.label}</span>
        {latest != null && (
          <span className="text-lg font-bold tabular-nums leading-none text-foreground">{def.fmt(latest)}</span>
        )}
      </div>
      <div className="h-44">
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
              tickFormatter={(v) => (def.key === 'mem' ? formatBytes(v as number, 0) : String(v))}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={def.key === 'mem' ? 52 : 40}
              tickCount={4}
            />
            <Tooltip
              content={<ChartTooltip color={def.color} metricLabel={def.label} fmt={def.fmt} />}
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
    </div>
  )
}

export function SystemStatsDialog({
  systemId,
  name,
  open,
  onOpenChange,
}: {
  systemId: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [range, setRange] = useState<Range>('24h')
  const [points, setPoints] = useState<SystemPoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await authFetch(`/api/vps/system-history?system=${encodeURIComponent(systemId)}&range=${range}`)
      if (res.ok) {
        const data = await res.json()
        setPoints(data.points || [])
      }
    } catch {
      /* keep prior points */
    } finally {
      setLoading(false)
    }
  }, [systemId, range])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setPoints([])
    fetchHistory()
  }, [open, fetchHistory])

  const now = Date.now()
  const dataStart = points.length ? points[0].ts : now - RANGE_MS[range]
  const spanStart = Math.min(dataStart, now - 60_000)
  const xDomain: [number, number] = [spanStart, now]
  const effSpan = now - spanStart
  const fmtMode: TickMode = effSpan < 36 * 3_600_000 ? 'hour' : 'date'
  const xTicks = buildTicks(spanStart, now)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name} · Resource history</DialogTitle>
        </DialogHeader>

        <div className="inline-flex w-fit rounded-lg border bg-muted/40 p-0.5">
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

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : points.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            History is still building. This system has no samples in this range yet — charts fill in as data
            accumulates.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {CHARTS.map((def) => (
              <MetricPanel
                key={def.key}
                def={def}
                points={points}
                fmtMode={fmtMode}
                xDomain={xDomain}
                xTicks={xTicks}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
