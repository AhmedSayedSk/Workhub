'use client'

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

// Tiny inline trend line for a rolling metric history (e.g. CPU %).
export function Sparkline({ data, color = '#00e0bd' }: { data: number[]; color?: string }) {
  if (!data.length) return null
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <YAxis hide domain={[0, 100]} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
