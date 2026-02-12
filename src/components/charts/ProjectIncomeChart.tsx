'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { Project, MonthlyPayment } from '@/types'
import { isWeekend, eachDayOfInterval } from 'date-fns'

interface ProjectIncomeChartProps {
  projects: Project[]
  payments: MonthlyPayment[]
}

// Average working days per month (approximately 22 days)
const WORKING_DAYS_PER_MONTH = 22
const WORKING_HOURS_PER_DAY = 8
const WORKING_HOURS_PER_MONTH = WORKING_DAYS_PER_MONTH * WORKING_HOURS_PER_DAY // 176 hours
const ONE_MONTH_IN_DAYS = 31

// Calculate days between two dates
// For projects <= 1 month: count all calendar days
// For projects > 1 month: exclude weekends
function getProjectDays(startDate: Date, endDate: Date): { days: number; isShortProject: boolean } {
  if (startDate > endDate) return { days: 0, isShortProject: true }

  const allDays = eachDayOfInterval({ start: startDate, end: endDate })
  const totalCalendarDays = allDays.length

  // If project is 1 month or less, count all calendar days
  if (totalCalendarDays <= ONE_MONTH_IN_DAYS) {
    return { days: totalCalendarDays, isShortProject: true }
  }

  // For longer projects, exclude weekends
  const workingDays = allDays.filter(day => !isWeekend(day)).length
  return { days: workingDays, isShortProject: false }
}

// Custom Y-axis tick to render full project names
interface CustomTickProps {
  x?: number
  y?: number
  payload?: { value: string }
}

function CustomYAxisTick({ x, y, payload }: CustomTickProps) {
  if (!payload) return null

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-8}
        y={0}
        dy={4}
        textAnchor="end"
        fill="hsl(var(--muted-foreground))"
        fontSize={11}
        fontWeight={500}
      >
        {payload.value}
      </text>
    </g>
  )
}

export function ProjectIncomeChart({ projects, payments }: ProjectIncomeChartProps) {
  const chartData = useMemo(() => {
    const now = new Date()

    return projects.map((project) => {
      let workingHours = 0
      let paidMonths = 0
      let projectDays = 0
      let isShortProject = false
      const isInternal = project.paymentModel === 'internal'

      if (project.paymentModel === 'monthly') {
        // For monthly (salary) projects: count paid monthly payments
        const projectPayments = payments.filter(
          p => p.projectId === project.id && p.status === 'paid'
        )
        paidMonths = projectPayments.length
        workingHours = paidMonths * WORKING_HOURS_PER_MONTH
      } else {
        // For fixed/milestone/internal projects: calculate from start to end date
        const startDate = project.startDate.toDate()
        const endDate = project.deadline?.toDate() || now
        const actualEndDate = endDate > now ? now : endDate
        const result = getProjectDays(startDate, actualEndDate)
        projectDays = result.days
        isShortProject = result.isShortProject
        workingHours = projectDays * WORKING_HOURS_PER_DAY
      }

      // Calculate hourly rate
      // For internal projects: use estimatedValue instead of paidAmount
      const valueForRate = isInternal
        ? (project.estimatedValue || 0)
        : project.paidAmount
      const hourlyRate = workingHours > 0
        ? valueForRate / workingHours
        : 0

      return {
        name: project.name,
        fullName: project.name,
        paid: project.paidAmount,
        remaining: Math.max(0, project.totalAmount - project.paidAmount),
        total: project.totalAmount,
        isMonthly: project.paymentModel === 'monthly',
        isInternal,
        estimatedValue: project.estimatedValue || 0,
        color: project.color || '#6366F1',
        paidMonths,
        projectDays,
        isShortProject,
        workingHours,
        hourlyRate: Math.round(hourlyRate),
        hourlyRateLabel: workingHours > 0 ? `${formatCurrency(Math.round(hourlyRate))}/h` : '',
      }
    })
  }, [projects, payments])

  // Calculate the max name length to determine Y-axis width
  const maxNameLength = useMemo(() => {
    if (projects.length === 0) return 100
    const maxLen = Math.max(...projects.map(p => p.name.length))
    // Approximate 7px per character, min 100, max 200
    return Math.min(200, Math.max(100, maxLen * 7))
  }, [projects])

  // Calculate optimal domain for hourly rate scale
  const ratesDomain = useMemo(() => {
    const rates = chartData.map(d => d.hourlyRate).filter(r => r > 0)
    if (rates.length === 0) return [1, 1000]

    const minRate = Math.min(...rates)
    const maxRate = Math.max(...rates)

    // Round down min to nearest nice number, round up max
    const minDomain = Math.max(1, Math.floor(minRate * 0.8 / 10) * 10) // 80% of min, rounded down
    const maxDomain = Math.ceil(maxRate * 1.1 / 10) * 10 // 110% of max, rounded up

    return [minDomain, maxDomain]
  }, [chartData])

  if (projects.length === 0) {
    return null
  }

  return (
    <div className="h-56 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
          barGap={2}
        >
          <XAxis
            type="number"
            domain={[0, ratesDomain[1]]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickFormatter={(value) => `${value}`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={<CustomYAxisTick />}
            width={maxNameLength}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const data = payload[0].payload
              return (
                <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-lg min-w-[180px]">
                  <p className="font-semibold mb-2">{data.fullName}</p>

                  {data.isInternal ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Internal Project</span>
                      </div>
                      {data.estimatedValue > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-purple-600 dark:text-purple-400">Estimated Value:</span>
                          <span className="text-purple-600 dark:text-purple-400">{formatCurrency(data.estimatedValue)}</span>
                        </div>
                      )}
                    </>
                  ) : data.isMonthly ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Monthly:</span>
                        <span>{formatCurrency(data.total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 dark:text-green-400">Received:</span>
                        <span className="text-green-600 dark:text-green-400">{formatCurrency(data.paid)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 dark:text-green-400">Paid:</span>
                        <span className="text-green-600 dark:text-green-400">{formatCurrency(data.paid)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-600 dark:text-amber-400">Remaining:</span>
                        <span className="text-amber-600 dark:text-amber-400">{formatCurrency(data.remaining)}</span>
                      </div>
                    </>
                  )}

                  {data.workingHours > 0 && (
                    <>
                      <div className="flex justify-between text-sm mt-2 pt-2 border-t text-muted-foreground">
                        {data.isMonthly ? (
                          <>
                            <span>Paid Months:</span>
                            <span>{data.paidMonths} {data.paidMonths === 1 ? 'month' : 'months'}</span>
                          </>
                        ) : (
                          <>
                            <span>{data.isShortProject ? 'Days:' : 'Working Days:'}</span>
                            <span>{data.projectDays} days</span>
                          </>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600 dark:text-blue-400">
                          {data.isInternal ? 'Est. Rate:' : 'Hour Rate:'}
                        </span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {formatCurrency(data.hourlyRate)}/h
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )
            }}
          />
          <Bar
            dataKey="hourlyRate"
            radius={[0, 4, 4, 0]}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => (
              <Cell key={`rate-${index}`} fill={entry.color} fillOpacity={0.9} />
            ))}
            <LabelList
              dataKey="hourlyRateLabel"
              position="right"
              fill="hsl(var(--muted-foreground))"
              fontSize={11}
              fontWeight={500}
              offset={8}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
