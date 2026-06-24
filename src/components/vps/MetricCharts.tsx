'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { MetricPoint } from '@/lib/server/vps/types'

const RANGES = ['1h', '24h', '7d'] as const
type Range = (typeof RANGES)[number]

const CHARTS: {
  key: keyof MetricPoint
  label: string
  color: string
  unit: string
  domain: [number | string, number | string]
}[] = [
  { key: 'cpuPct', label: 'CPU', color: '#00e0bd', unit: '%', domain: [0, 100] },
  { key: 'memPct', label: 'Memory', color: '#6366f1', unit: '%', domain: [0, 100] },
  { key: 'diskPct', label: 'Disk', color: '#f59e0b', unit: '%', domain: [0, 100] },
  { key: 'load1', label: 'Load (1m)', color: '#ec4899', unit: '', domain: [0, 'auto'] },
]

function fmtTick(ts: number, range: Range): string {
  const d = new Date(ts)
  if (range === '7d') return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MetricCharts() {
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          History
        </CardTitle>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={r === range ? 'default' : 'outline'}
              onClick={() => setRange(r)}
              className="h-7 px-2.5 text-xs"
            >
              {r}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {loading ? 'Loading history…' : 'No samples yet — history builds up as the per-minute sampler runs.'}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {CHARTS.map((c) => (
              <div key={c.key}>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {c.label}
                  {c.unit ? ` (${c.unit})` : ''}
                </div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={points} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                      <XAxis
                        dataKey="ts"
                        tickFormatter={(t) => fmtTick(t as number, range)}
                        tick={{ fontSize: 10 }}
                        minTickGap={40}
                      />
                      <YAxis domain={c.domain} tick={{ fontSize: 10 }} width={34} />
                      <Tooltip
                        labelFormatter={(t) => new Date(t as number).toLocaleString()}
                        formatter={(v) => [`${v}${c.unit}`, c.label]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Area
                        type="monotone"
                        dataKey={c.key}
                        stroke={c.color}
                        fill={c.color}
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
