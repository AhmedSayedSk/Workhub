'use client'

import { useState, useEffect } from 'react'
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
  // For non-monthly projects: total value and owed from totalAmount - paidAmount
  // For monthly projects: don't include in "owed" from project, use pending payments instead
  const nonMonthlyProjects = allProjects.filter((p) => p.paymentModel !== 'monthly')
  const totalPaid = allProjects.reduce((sum, p) => sum + p.paidAmount, 0)

  // Owed from non-monthly projects (milestone/fixed)
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

  // Monthly earnings data (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i)
    const month = format(date, 'yyyy-MM')
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)

    // Sum paid milestones in this month
    const milestoneEarnings = allMilestones
      .filter((m) => {
        if (m.status !== 'paid' || !m.paidAt) return false
        const paidDate = m.paidAt.toDate()
        return paidDate >= monthStart && paidDate <= monthEnd
      })
      .reduce((sum, m) => sum + m.amount, 0)

    // Sum paid monthly payments
    const monthlyEarnings = allPayments
      .filter((p) => p.status === 'paid' && p.month === month)
      .reduce((sum, p) => sum + p.amount, 0)

    return {
      month: format(date, 'MMM'),
      fullMonth: format(date, 'MMMM yyyy'),
      earnings: milestoneEarnings + monthlyEarnings,
    }
  })

  // Project distribution by system
  const systemDistribution = Object.entries(
    allProjects.reduce((acc, project) => {
      const systemId = project.systemId
      const systemName = systemsMap[systemId]?.name || 'Unknown'
      if (!acc[systemName]) {
        acc[systemName] = { value: 0, paid: 0 }
      }
      acc[systemName].value += project.totalAmount
      acc[systemName].paid += project.paidAmount
      return acc
    }, {} as Record<string, { value: number; paid: number }>)
  )
    .map(([name, data]) => ({
      name,
      value: data.value,
      paid: data.paid,
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
                      return (
                        <div className="bg-popover text-popover-foreground rounded-lg border p-2 shadow-md">
                          <p className="font-medium">{payload[0].payload.fullMonth}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="earnings"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By System</CardTitle>
            <CardDescription>Revenue distribution across systems</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {systemDistribution.length === 0 ? (
                <p className="text-muted-foreground">No data available</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={systemDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {systemDistribution.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-popover text-popover-foreground rounded-lg border p-2 shadow-md">
                            <p className="font-medium">{payload[0].name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(payload[0].value as number)}
                            </p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
              allProjects.map((project) => {
                const system = systemsMap[project.systemId]
                const isMonthly = project.paymentModel === 'monthly'
                const progress = isMonthly ? 0 : calculateProgress(
                  project.paidAmount,
                  project.totalAmount
                )
                // For monthly: show pending payments as owed
                // For others: show totalAmount - paidAmount
                const projectPendingPayments = allPayments
                  .filter((p) => p.projectId === project.id && p.status === 'pending')
                  .reduce((sum, p) => sum + p.amount, 0)
                const owed = isMonthly
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
                        style={{ backgroundColor: system?.color || '#6366F1' }}
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
                        </div>
                        {isMonthly ? (
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
                        {isMonthly ? (
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
    </div>
  )
}
