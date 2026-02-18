'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { projects, milestones, monthlyPayments, systems } from '@/lib/firestore'
import { Project, Milestone, MonthlyPayment, System } from '@/types'
import {
  formatCurrency,
  formatDate,
  statusColors,
  calculateProgress,
  chartColors,
} from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import {
  Building2,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  DollarSign,
  ArrowRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// Using soft chart colors from utils for dark mode comfort

export default function FinancesPage() {
  const [allProjects, setProjects] = useState<Project[]>([])
  const [allMilestones, setMilestones] = useState<Milestone[]>([])
  const [allPayments, setPayments] = useState<MonthlyPayment[]>([])
  const [systemsMap, setSystemsMap] = useState<Record<string, System>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFinanceData()
  }, [])

  const loadFinanceData = async () => {
    try {
      const [projectsData, milestonesData, paymentsData, systemsData] =
        await Promise.all([
          projects.getAll(),
          milestones.getAll(),
          monthlyPayments.getAll(),
          systems.getAll(),
        ])

      setProjects(projectsData)
      setMilestones(milestonesData)
      setPayments(paymentsData)

      const sMap: Record<string, System> = {}
      systemsData.forEach((s) => (sMap[s.id] = s))
      setSystemsMap(sMap)
    } catch (error) {
      console.error('Error loading finance data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals
  // Exclude internal projects and sub-projects with shared finances from all financial calculations
  // For non-monthly projects: total value and owed from totalAmount - paidAmount
  // For monthly projects: don't include in "owed" from project, use pending payments instead
  const projectsWithPayments = allProjects.filter((p) => p.paymentModel !== 'internal' && p.hasOwnFinances !== false)
  const nonMonthlyProjects = projectsWithPayments.filter((p) => p.paymentModel !== 'monthly')
  const totalPaid = projectsWithPayments.reduce((sum, p) => sum + p.paidAmount, 0)

  // Owed from non-monthly projects (milestone/fixed) - excludes internal
  const nonMonthlyOwed = nonMonthlyProjects.reduce(
    (sum, p) => sum + Math.max(0, p.totalAmount - p.paidAmount),
    0
  )

  // Owed from monthly projects = sum of pending monthly payments
  const monthlyOwed = allPayments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0)

  const totalOwed = nonMonthlyOwed + monthlyOwed

  const activeProjects = allProjects.filter((p) => p.status === 'active')
  const internalProjects = allProjects.filter((p) => p.paymentModel === 'internal')

  // Pending milestones
  const pendingMilestones = allMilestones.filter(
    (m) => m.status !== 'paid'
  )
  const pendingMilestoneValue = pendingMilestones.reduce(
    (sum, m) => sum + m.amount,
    0
  )

  // Pending monthly payments
  const pendingPayments = allPayments.filter((p) => p.status === 'pending')
  const pendingPaymentValue = pendingPayments.reduce(
    (sum, p) => sum + p.amount,
    0
  )

  // Build a map of projectId -> project for quick lookups
  const projectsMap = useMemo(() => {
    const map: Record<string, Project> = {}
    allProjects.forEach((p) => (map[p.id] = p))
    return map
  }, [allProjects])

  // Collect unique project IDs that have earnings (milestones or monthly payments)
  const earningProjectIds = useMemo(() => {
    const ids = new Set<string>()
    allMilestones.filter((m) => m.status === 'paid').forEach((m) => ids.add(m.projectId))
    allPayments.filter((p) => p.status === 'paid').forEach((p) => ids.add(p.projectId))
    // Exclude internal projects and shared-finance sub-projects
    return Array.from(ids).filter((id) => {
      const p = projectsMap[id]
      return p && p.paymentModel !== 'internal' && p.hasOwnFinances !== false
    })
  }, [allMilestones, allPayments, projectsMap])

  // Monthly earnings data (last 6 months) — per-project breakdown
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i)
    const month = format(date, 'yyyy-MM')
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)

    const row: Record<string, string | number> = {
      month: format(date, 'MMM'),
      fullMonth: format(date, 'MMMM yyyy'),
    }

    earningProjectIds.forEach((pid) => {
      // Milestones paid this month for this project
      const milestoneEarnings = allMilestones
        .filter((m) => {
          if (m.projectId !== pid || m.status !== 'paid' || !m.paidAt) return false
          const paidDate = m.paidAt.toDate()
          return paidDate >= monthStart && paidDate <= monthEnd
        })
        .reduce((sum, m) => sum + m.amount, 0)

      // Monthly payments for this project
      const monthlyEarnings = allPayments
        .filter((p) => p.projectId === pid && p.status === 'paid' && p.month === month)
        .reduce((sum, p) => sum + p.amount, 0)

      row[pid] = milestoneEarnings + monthlyEarnings
    })

    return row
  })

  // Revenue distribution by project (excludes internal projects and shared-finance sub-projects)
  const projectDistribution = projectsWithPayments
    .filter((p) => p.totalAmount > 0 || p.paidAmount > 0)
    .map((p) => ({
      name: p.name,
      value: p.totalAmount || p.paidAmount,
      paid: p.paidAmount,
      color: p.color,
    }))
    .sort((a, b) => b.value - a.value)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
        <p className="text-muted-foreground">
          Track payments and financial overview
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Owed</CardTitle>
            <Wallet className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {formatCurrency(totalOwed)}
            </div>
            <p className="text-xs text-muted-foreground">
              From all projects
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              All time earnings
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Milestones</CardTitle>
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {formatCurrency(pendingMilestoneValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingMilestones.length} milestones
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Monthly</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {formatCurrency(pendingPaymentValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingPayments.length} payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Earnings</CardTitle>
            <CardDescription>Payments received over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const items = payload.filter((p) => (p.value as number) > 0)
                      const total = items.reduce((sum, p) => sum + (p.value as number), 0)
                      return (
                        <div className="bg-popover text-popover-foreground rounded-lg border p-2.5 shadow-md min-w-[160px]">
                          <p className="font-medium mb-1.5">{payload[0].payload.fullMonth}</p>
                          {items.map((p) => (
                            <div key={p.dataKey as string} className="flex items-center justify-between gap-4 text-sm">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0"
                                  style={{ backgroundColor: p.color }}
                                />
                                <span className="text-muted-foreground truncate max-w-[120px]">{p.name}</span>
                              </div>
                              <span className="font-medium">{formatCurrency(p.value as number)}</span>
                            </div>
                          ))}
                          {items.length > 1 && (
                            <div className="flex justify-between text-sm font-medium border-t mt-1.5 pt-1.5">
                              <span>Total</span>
                              <span>{formatCurrency(total)}</span>
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="square"
                    iconSize={10}
                  />
                  {earningProjectIds.map((pid, i) => (
                    <Bar
                      key={pid}
                      dataKey={pid}
                      name={projectsMap[pid]?.name || 'Unknown'}
                      stackId="projects"
                      fill={projectsMap[pid]?.color || chartColors[i % chartColors.length]}
                      radius={i === earningProjectIds.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Project</CardTitle>
            <CardDescription>Revenue distribution across projects</CardDescription>
          </CardHeader>
          <CardContent>
            {projectDistribution.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-muted-foreground">No data available</p>
              </div>
            ) : (
              <div className="flex items-center gap-4 h-64">
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                        label={false}
                      >
                        {projectDistribution.map((item, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={item.color || chartColors[index % chartColors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const total = projectDistribution.reduce((s, d) => s + d.value, 0)
                          const percent = total > 0 ? ((payload[0].value as number) / total * 100).toFixed(0) : '0'
                          return (
                            <div className="bg-popover text-popover-foreground rounded-lg border p-2 shadow-md">
                              <p className="font-medium">{payload[0].name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(payload[0].value as number)} ({percent}%)
                              </p>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2 overflow-y-auto max-h-64 pr-1">
                  {(() => {
                    const total = projectDistribution.reduce((s, d) => s + d.value, 0)
                    return projectDistribution.map((item, index) => {
                      const percent = total > 0 ? (item.value / total * 100).toFixed(0) : '0'
                      return (
                        <div key={item.name} className="flex items-center gap-2 text-sm">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.color || chartColors[index % chartColors.length] }}
                          />
                          <span className="truncate flex-1 text-foreground">{item.name}</span>
                          <span className="text-muted-foreground whitespace-nowrap">{percent}%</span>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Milestones */}
      {pendingMilestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Milestones</CardTitle>
            <CardDescription>Milestones awaiting payment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingMilestones.slice(0, 5).map((milestone) => {
                const project = allProjects.find(
                  (p) => p.id === milestone.projectId
                )

                return (
                  <div
                    key={milestone.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{milestone.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {project?.name} - Due {formatDate(milestone.dueDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(milestone.amount)}</p>
                      <Badge
                        variant="outline"
                        className={statusColors.milestone[milestone.status]}
                      >
                        {milestone.status}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Projects Financial Status</CardTitle>
          <CardDescription>Payment progress for all projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allProjects.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No projects yet
              </p>
            ) : (
              allProjects.filter((p) => p.hasOwnFinances !== false).map((project) => {
                const system = systemsMap[project.systemId]
                const isMonthly = project.paymentModel === 'monthly'
                const isInternal = project.paymentModel === 'internal'
                const progress = (isMonthly || isInternal) ? 0 : calculateProgress(
                  project.paidAmount,
                  project.totalAmount
                )
                // For monthly: show pending payments as owed
                // For internal: no owed
                // For others: show totalAmount - paidAmount
                const projectPendingPayments = allPayments
                  .filter((p) => p.projectId === project.id && p.status === 'pending')
                  .reduce((sum, p) => sum + p.amount, 0)
                const owed = isInternal
                  ? 0
                  : isMonthly
                  ? projectPendingPayments
                  : Math.max(0, project.totalAmount - project.paidAmount)

                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors">
                      <div
                        className="w-2 h-12 rounded-full"
                        style={{ backgroundColor: project.color || system?.color || '#6366F1' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium truncate">{project.name}</p>
                          <Badge
                            variant="outline"
                            className={statusColors.project[project.status]}
                          >
                            {project.status}
                          </Badge>
                          {isMonthly && (
                            <Badge variant="secondary" className="text-xs">
                              Monthly
                            </Badge>
                          )}
                          {isInternal && (
                            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400">
                              Internal
                            </Badge>
                          )}
                        </div>
                        {isInternal ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span>Internal Project</span>
                            {project.estimatedValue && project.estimatedValue > 0 && (
                              <>
                                <span>•</span>
                                <span>Est. {formatCurrency(project.estimatedValue)}</span>
                              </>
                            )}
                          </div>
                        ) : isMonthly ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatCurrency(project.totalAmount)}/mo</span>
                            <span>•</span>
                            <span>Received: {formatCurrency(project.paidAmount)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4">
                            <Progress value={progress} className="flex-1 h-2" />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {progress}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {isInternal ? (
                          <p className="text-sm text-purple-600 dark:text-purple-400">
                            No payment tracking
                          </p>
                        ) : isMonthly ? (
                          <>
                            <p className="font-medium">
                              {formatCurrency(project.paidAmount)}
                            </p>
                            <p className="text-xs text-muted-foreground">total received</p>
                          </>
                        ) : (
                          <p className="font-medium">
                            {formatCurrency(project.paidAmount)} /{' '}
                            {formatCurrency(project.totalAmount)}
                          </p>
                        )}
                        {owed > 0 && (
                          <p className="text-sm text-orange-700 dark:text-orange-400">
                            {isMonthly ? 'Pending' : 'Owed'}: {formatCurrency(owed)}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
