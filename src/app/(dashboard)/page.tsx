'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { projects, tasks, timeEntries, systems, milestones, monthlyPayments } from '@/lib/firestore'
import { Project, Task, TimeEntry, System, Milestone, MonthlyPayment, TaskType } from '@/types'
import { formatCurrency, formatDuration, formatDate, statusColors, calculateProgress, applyThinkingTime } from '@/lib/utils'

const taskTypeBorderColors: Record<TaskType, string> = {
  task: '#64748b',       // slate-500
  bug: '#ef4444',        // red-500
  feature: '#a855f7',    // purple-500
  improvement: '#06b6d4', // cyan-500
  documentation: '#f59e0b', // amber-500
  research: '#6366f1',   // indigo-500
}

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const sortByPriorityAndDeadline = (tasks: Task[], projectsMap: Record<string, Project>) => {
  return [...tasks].sort((a, b) => {
    // First sort by priority
    const priorityA = priorityOrder[a.priority] ?? 99
    const priorityB = priorityOrder[b.priority] ?? 99
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    // Then sort by deadline (task deadline takes priority over project deadline)
    const deadlineA = a.deadline?.toDate()?.getTime() ?? projectsMap[a.projectId]?.deadline?.toDate()?.getTime() ?? Infinity
    const deadlineB = b.deadline?.toDate()?.getTime() ?? projectsMap[b.projectId]?.deadline?.toDate()?.getTime() ?? Infinity
    return deadlineA - deadlineB
  })
}

function getDeadlineInfo(task: Task, project?: Project) {
  const deadline = task.deadline?.toDate() ?? project?.deadline?.toDate()
  if (!deadline) return null
  const now = new Date()
  const days = differenceInDays(deadline, now)
  const label = format(deadline, 'MMM d')
  if (days < 0) return { label, color: 'text-red-500', bg: 'bg-red-500/10' }
  if (days <= 3) return { label, color: 'text-amber-500', bg: 'bg-amber-500/10' }
  return { label, color: 'text-muted-foreground', bg: '' }
}

import {
  FolderKanban,
  Clock,
  Wallet,
  CheckCircle2,
  ArrowRight,
  Plus,
  CircleDollarSign,
  BarChart3,
  CalendarDays,
} from 'lucide-react'
import Link from 'next/link'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, format } from 'date-fns'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'
import { ProjectIncomeChart } from '@/components/charts/ProjectIncomeChart'
import { useSettings } from '@/hooks/useSettings'

export default function DashboardPage() {
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [todoTasks, setTodoTasks] = useState<Task[]>([])
  const [inProgressTasks, setInProgressTasks] = useState<Task[]>([])
  const [allTodoTasks, setAllTodoTasks] = useState<Task[]>([])
  const [allInProgressTasks, setAllInProgressTasks] = useState<Task[]>([])
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([])
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([])
  const [systemsMap, setSystemsMap] = useState<Record<string, System>>({})
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({})
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([])
  const [allPayments, setAllPayments] = useState<MonthlyPayment[]>([])
  const [showIncomeChart, setShowIncomeChart] = useState(false)
  const [loading, setLoading] = useState(true)
  const { settings } = useSettings()
  const thinkingPercent = settings?.thinkingTimePercent ?? 0

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [projectsData, todoData, inProgressData, systemsData, allProjects, milestonesData, paymentsData] = await Promise.all([
        projects.getByStatus('active'),
        tasks.getByStatus('todo'),
        tasks.getByStatus('in_progress'),
        systems.getAll(),
        projects.getAll(),
        milestones.getAll(),
        monthlyPayments.getAll(),
      ])

      const now = new Date()
      const todayStart = startOfDay(now)
      const todayEnd = endOfDay(now)
      const weekStart = startOfWeek(now)
      const weekEnd = endOfWeek(now)
      const monthStart = startOfMonth(now)
      const monthEnd = endOfMonth(now)

      const [todayData, weekData, monthData] = await Promise.all([
        timeEntries.getByDateRange(todayStart, todayEnd),
        timeEntries.getByDateRange(weekStart, weekEnd),
        timeEntries.getByDateRange(monthStart, monthEnd),
      ])

      const sysMap: Record<string, System> = {}
      systemsData.forEach((s) => {
        sysMap[s.id] = s
      })
      setSystemsMap(sysMap)

      const projMap: Record<string, Project> = {}
      allProjects.forEach((p) => {
        projMap[p.id] = p
      })
      setProjectsMap(projMap)

      // Filter out sub-projects from dashboard display
      const topLevelActive = projectsData.filter((p: Project) => !p.parentProjectId)
      setActiveProjects(topLevelActive.slice(0, 5))
      const activeProjectIdSet = new Set(projectsData.map((p: Project) => p.id))
      // Include tasks from both active and completed projects
      const completedProjects = allProjects.filter((p: Project) => p.status === 'completed')
      const relevantProjectIdSet = new Set([
        ...activeProjectIdSet,
        ...completedProjects.map((p: Project) => p.id),
      ])
      const filteredTodo = todoData.filter((t: Task) => !t.waiting && !t.archived && relevantProjectIdSet.has(t.projectId))
      const filteredInProgress = inProgressData.filter((t: Task) => !t.waiting && !t.archived && relevantProjectIdSet.has(t.projectId))
      setAllTodoTasks(filteredTodo)
      setAllInProgressTasks(filteredInProgress)
      setTodoTasks(sortByPriorityAndDeadline(filteredTodo, projMap).slice(0, 5))
      setInProgressTasks(sortByPriorityAndDeadline(filteredInProgress, projMap).slice(0, 5))
      setTodayEntries(todayData)
      setWeekEntries(weekData)
      setMonthEntries(monthData)
      setAllMilestones(milestonesData)
      setAllPayments(paymentsData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // For non-monthly/non-internal: owed = totalAmount - paidAmount
  // For monthly: owed = pending monthly payments
  // For internal: no owed (excluded from calculations)
  const activeProjectIds = new Set(activeProjects.map(p => p.id))

  // Non-monthly, non-internal active projects owed
  const nonMonthlyOwed = activeProjects
    .filter(p => p.paymentModel !== 'monthly' && p.paymentModel !== 'internal')
    .reduce((sum, p) => sum + Math.max(0, p.totalAmount - p.paidAmount), 0)

  // Monthly projects owed = pending payments (exclude internal projects)
  const monthlyOwed = allPayments
    .filter(p => activeProjectIds.has(p.projectId) && p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0)

  const totalOwed = nonMonthlyOwed + monthlyOwed

  // Total received excludes internal projects
  const totalReceived = activeProjects
    .filter(p => p.paymentModel !== 'internal')
    .reduce((sum, p) => sum + p.paidAmount, 0)

  // Find nearest payment deadline from unpaid milestones of active projects
  const unpaidMilestones = allMilestones
    .filter(m =>
      activeProjectIds.has(m.projectId) &&
      m.status !== 'paid' &&
      m.dueDate
    )
    .map(m => ({ date: m.dueDate.toDate(), projectId: m.projectId }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const nearestMilestone = unpaidMilestones[0] || null
  const nearestPaymentDeadline = nearestMilestone?.date || null
  const nearestPaymentProject = nearestMilestone ? projectsMap[nearestMilestone.projectId]?.name : null

  // Calculate days until payment deadline using UTC date comparison to avoid timezone issues
  const daysUntilDeadline = nearestPaymentDeadline
    ? (() => {
        // Extract date parts and create UTC dates to avoid timezone issues
        const deadlineUTC = Date.UTC(
          nearestPaymentDeadline.getFullYear(),
          nearestPaymentDeadline.getMonth(),
          nearestPaymentDeadline.getDate()
        )
        const today = new Date()
        const todayUTC = Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        )
        // Calculate difference in days
        return Math.round((deadlineUTC - todayUTC) / (1000 * 60 * 60 * 24))
      })()
    : null

  const todayMinutes = applyThinkingTime(todayEntries.reduce((sum, e) => sum + e.duration, 0), thinkingPercent)
  const weekMinutes = applyThinkingTime(weekEntries.reduce((sum, e) => sum + e.duration, 0), thinkingPercent)
  const monthMinutes = applyThinkingTime(monthEntries.reduce((sum, e) => sum + e.duration, 0), thinkingPercent)

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s your work overview.
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <div>
                <div className="text-2xl font-bold">{allInProgressTasks.length}</div>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-muted-foreground">/</div>
              <div>
                <div className="text-xl font-semibold text-muted-foreground">{allTodoTasks.length}</div>
                <p className="text-xs text-muted-foreground">To Do</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Tracked</CardTitle>
            <Clock className="h-5 w-5 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <div>
                <div className="text-2xl font-bold">{formatDuration(todayMinutes)}</div>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
              <div className="text-muted-foreground">/</div>
              <div>
                <div className="text-xl font-semibold text-muted-foreground">{formatDuration(weekMinutes)}</div>
                <p className="text-xs text-muted-foreground">This week</p>
              </div>
              <div className="text-muted-foreground">/</div>
              <div>
                <div className="text-lg font-semibold text-muted-foreground/70">{formatDuration(monthMinutes)}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Owed</CardTitle>
            <Wallet className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalOwed)}</div>
            <p className="text-xs text-muted-foreground">
              {daysUntilDeadline !== null ? (
                daysUntilDeadline < 0 ? (
                  <span className="text-red-500">{Math.abs(daysUntilDeadline)} days overdue {nearestPaymentProject && <span className="text-muted-foreground">— {nearestPaymentProject}</span>}</span>
                ) : daysUntilDeadline === 0 ? (
                  <span className="text-orange-500">Due today {nearestPaymentProject && <span className="text-muted-foreground">— {nearestPaymentProject}</span>}</span>
                ) : (
                  <span>{daysUntilDeadline} days until next payment {nearestPaymentProject && <span className="text-muted-foreground">— {nearestPaymentProject}</span>}</span>
                )
              ) : (
                'Pending from active projects'
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            <CircleDollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalReceived)}</div>
            <p className="text-xs text-muted-foreground">
              Paid from active projects
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 items-start">
        {/* Active Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Projects</CardTitle>
                <CardDescription>Your current work in progress</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showIncomeChart ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowIncomeChart(!showIncomeChart)}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Income
                </Button>
                <Link href="/projects">
                  <Button variant="ghost" size="sm">
                    View all <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active projects</p>
                <Link href="/projects/new">
                  <Button variant="link">Create your first project</Button>
                </Link>
              </div>
            ) : (
              <>
                {/* Income Chart */}
                {showIncomeChart && (
                  <div className="mb-4 pb-4 border-b">
                    <ProjectIncomeChart
                      projects={activeProjects}
                      payments={allPayments}
                    />
                    <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-primary" />
                        <span>Received</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-primary/25" />
                        <span>Remaining</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project List */}
                <div className="space-y-4">
                  {activeProjects.map((project) => {
                    const system = systemsMap[project.systemId]
                    const isMonthly = project.paymentModel === 'monthly'
                    const isInternal = project.paymentModel === 'internal'
                    const progress = (isMonthly || isInternal) ? 0 : calculateProgress(project.paidAmount, project.totalAmount)

                    return (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="block"
                      >
                        <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div
                            className="w-2 h-10 rounded-full"
                            style={{ backgroundColor: project.color || system?.color || '#6366F1' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-base truncate">{project.name}</p>
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
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{formatCurrency(project.paidAmount)} / {formatCurrency(project.totalAmount)}</span>
                                <span>•</span>
                                <span className="font-medium">{progress}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tasks Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>My Tasks</CardTitle>
                <CardDescription>
                  {todoTasks.length + inProgressTasks.length} tasks need attention
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {todoTasks.length === 0 && inProgressTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending tasks</p>
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              <>
                {/* In Progress Tasks */}
                {inProgressTasks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <h4 className="text-sm font-medium text-muted-foreground">
                        In Progress ({inProgressTasks.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {inProgressTasks.map((task) => {
                        const project = projectsMap[task.projectId]
                        const taskType = task.taskType || 'task'
                        const borderColor = taskTypeBorderColors[taskType]
                        const deadlineInfo = getDeadlineInfo(task, project)
                        return (
                          <Link
                            key={task.id}
                            href={`/projects/${task.projectId}`}
                            className="block"
                          >
                            <div
                              className="flex items-center gap-3 p-3 border border-l-[3px] bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 transition-colors"
                              style={{ borderLeftColor: borderColor }}
                            >
                              {project && (
                                <ProjectIcon
                                  src={project.coverImageUrl}
                                  name={project.name}
                                  size="sm"
                                />
                              )}
                              <p className="flex-1 min-w-0 font-medium truncate">{task.name}</p>
                              {deadlineInfo && (
                                <span className={`text-xs flex items-center gap-1 flex-shrink-0 rounded-full px-2 py-0.5 ${deadlineInfo.color} ${deadlineInfo.bg}`}>
                                  <CalendarDays className="h-3 w-3" />
                                  {deadlineInfo.label}
                                </span>
                              )}
                              {task.estimatedHours > 0 && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {task.estimatedHours}h
                                </span>
                              )}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Todo Tasks */}
                {todoTasks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      <h4 className="text-sm font-medium text-muted-foreground">
                        To Do ({todoTasks.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {todoTasks.map((task) => {
                        const project = projectsMap[task.projectId]
                        const taskType = task.taskType || 'task'
                        const borderColor = taskTypeBorderColors[taskType]
                        const deadlineInfo = getDeadlineInfo(task, project)
                        return (
                          <Link
                            key={task.id}
                            href={`/projects/${task.projectId}`}
                            className="block"
                          >
                            <div
                              className="flex items-center gap-3 p-3 border border-l-[3px] hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors"
                              style={{ borderLeftColor: borderColor }}
                            >
                              {project && (
                                <ProjectIcon
                                  src={project.coverImageUrl}
                                  name={project.name}
                                  size="sm"
                                />
                              )}
                              <p className="flex-1 min-w-0 font-medium truncate">{task.name}</p>
                              {deadlineInfo && (
                                <span className={`text-xs flex items-center gap-1 flex-shrink-0 rounded-full px-2 py-0.5 ${deadlineInfo.color} ${deadlineInfo.bg}`}>
                                  <CalendarDays className="h-3 w-3" />
                                  {deadlineInfo.label}
                                </span>
                              )}
                              {task.estimatedHours > 0 && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {task.estimatedHours}h
                                </span>
                              )}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
