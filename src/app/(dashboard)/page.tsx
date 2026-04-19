'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { projects, tasks, timeEntries, milestones, monthlyPayments, members as membersApi } from '@/lib/firestore'
import { Project, Task, TimeEntry, Milestone, MonthlyPayment, TaskType, Member } from '@/types'
import { formatCurrency, formatDuration, formatDate, statusColors, calculateProgress, applyThinkingTime, getEffectiveTotal, getWarrantyState, getWarrantyDaysLeft } from '@/lib/utils'
import { WarrantyBadge } from '@/components/projects/WarrantyBadge'

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
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, format } from 'date-fns'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'
import { ProjectIncomeChart } from '@/components/charts/ProjectIncomeChart'
import { MemberAvatarGroup } from '@/components/members/MemberAvatarGroup'
import { useSettings } from '@/hooks/useSettings'

export default function DashboardPage() {
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [warrantyProjects, setWarrantyProjects] = useState<Project[]>([])
  const [todoTasks, setTodoTasks] = useState<Task[]>([])
  const [inProgressTasks, setInProgressTasks] = useState<Task[]>([])
  const [allTodoTasks, setAllTodoTasks] = useState<Task[]>([])
  const [allInProgressTasks, setAllInProgressTasks] = useState<Task[]>([])
  const [reviewTasks, setReviewTasks] = useState<Task[]>([])
  const [teamTodoTasks, setTeamTodoTasks] = useState<Task[]>([])
  const [teamInProgressTasks, setTeamInProgressTasks] = useState<Task[]>([])
  const [teamReviewTasks, setTeamReviewTasks] = useState<Task[]>([])
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([])
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([])
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({})
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([])
  const [allPayments, setAllPayments] = useState<MonthlyPayment[]>([])
  const [membersMap, setMembersMap] = useState<Record<string, Member>>({})
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [showAllTeamTasks, setShowAllTeamTasks] = useState(false)
  const [showIncomeChart, setShowIncomeChart] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { settings } = useSettings()
  const thinkingPercent = settings?.thinkingTimePercent ?? 0
  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)

  useEffect(() => {
    loadDashboardData()
  }, [user])

  const loadDashboardData = async () => {
    try {
      const [projectsData, todoData, inProgressData, reviewData, allProjects, milestonesData, paymentsData, membersData] = await Promise.all([
        projects.getByStatus('active', user?.uid),
        tasks.getByStatus('todo'),
        tasks.getByStatus('in_progress'),
        tasks.getByStatus('review'),
        projects.getAll(user?.uid),
        milestones.getAll(),
        monthlyPayments.getAll(),
        membersApi.getAll(),
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

      const projMap: Record<string, Project> = {}
      allProjects.forEach((p) => {
        projMap[p.id] = p
      })
      setProjectsMap(projMap)

      const memMap: Record<string, Member> = {}
      membersData.forEach((m) => {
        memMap[m.id] = m
      })
      setMembersMap(memMap)

      const currentMember = user?.email
        ? membersData.find((m) => m.email.toLowerCase() === user.email!.toLowerCase())
        : undefined
      const currentMemberId = currentMember?.id

      // Filter out sub-projects from dashboard display
      const topLevelActive = projectsData.filter((p: Project) => !p.parentProjectId)
      setActiveProjects(topLevelActive.slice(0, 5))

      // Completed projects still in warranty period (top-level only, soonest expiring first)
      const warrantyActive = allProjects
        .filter((p: Project) => !p.parentProjectId && getWarrantyState(p) === 'active')
        .sort((a: Project, b: Project) => getWarrantyDaysLeft(a) - getWarrantyDaysLeft(b))
      setWarrantyProjects(warrantyActive)
      // Show tasks from non-completed projects, plus completed projects still in warranty
      const activeProjectIds = new Set(
        allProjects
          .filter((p: Project) => {
            if (p.status === 'cancelled') return false
            if (p.status !== 'completed') return true
            return getWarrantyState(p) === 'active'
          })
          .map((p: Project) => p.id),
      )
      const filteredTodo = todoData.filter((t: Task) => !t.waiting && !t.archived && activeProjectIds.has(t.projectId))
      const filteredInProgress = inProgressData.filter((t: Task) => !t.waiting && !t.archived && activeProjectIds.has(t.projectId))
      const filteredReview = reviewData.filter((t: Task) => !t.waiting && !t.archived && activeProjectIds.has(t.projectId))

      const isMine = (t: Task) => {
        const ids = t.assigneeIds || []
        if (ids.length === 0) return true
        return currentMemberId ? ids.includes(currentMemberId) : false
      }
      const isTeam = (t: Task) => {
        const ids = t.assigneeIds || []
        if (ids.length === 0) return false
        return currentMemberId ? !ids.includes(currentMemberId) : true
      }

      const mineTodo = sortByPriorityAndDeadline(filteredTodo.filter(isMine), projMap)
      const mineInProgress = sortByPriorityAndDeadline(filteredInProgress.filter(isMine), projMap)
      const mineReview = sortByPriorityAndDeadline(filteredReview.filter(isMine), projMap)
      const teamTodo = sortByPriorityAndDeadline(filteredTodo.filter(isTeam), projMap)
      const teamInProgress = sortByPriorityAndDeadline(filteredInProgress.filter(isTeam), projMap)
      const teamReview = sortByPriorityAndDeadline(filteredReview.filter(isTeam), projMap)

      setAllTodoTasks(mineTodo)
      setAllInProgressTasks(mineInProgress)
      setTodoTasks(mineTodo.slice(0, 5))
      setInProgressTasks(mineInProgress.slice(0, 5))
      setReviewTasks(mineReview)
      setTeamTodoTasks(teamTodo)
      setTeamInProgressTasks(teamInProgress)
      setTeamReviewTasks(teamReview)
      // Filter time entries, milestones, payments by accessible projects
      const accessibleIds = new Set(allProjects.map((p: Project) => p.id))
      setTodayEntries(todayData.filter((e: any) => accessibleIds.has(e.projectId)))
      setWeekEntries(weekData.filter((e: any) => accessibleIds.has(e.projectId)))
      setMonthEntries(monthData.filter((e: any) => accessibleIds.has(e.projectId)))
      setAllMilestones(milestonesData.filter((m: any) => accessibleIds.has(m.projectId)))
      setAllPayments(paymentsData.filter((p: any) => accessibleIds.has(p.projectId)))
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
    .reduce((sum, p) => sum + Math.max(0, getEffectiveTotal(p) - p.paidAmount), 0)

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
                <div className="text-2xl font-bold">{Math.round(todayMinutes / 60 * 10) / 10}h</div>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
              <div className="text-muted-foreground">/</div>
              <div>
                <div className="text-xl font-semibold text-muted-foreground">{Math.round(weekMinutes / 60 * 10) / 10}h</div>
                <p className="text-xs text-muted-foreground">This week</p>
              </div>
              <div className="text-muted-foreground">/</div>
              <div>
                <div className="text-lg font-semibold text-muted-foreground/70">{Math.round(monthMinutes / 60 * 10) / 10}h</div>
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
        {/* Left column: Active Projects + In-Warranty Projects */}
        <div className="space-y-6">
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
                      projects={activeProjects.filter((p) => getEffectiveTotal(p) > 0 || p.paidAmount > 0)}
                      payments={allPayments}
                    />
                    <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-indigo-500" />
                        <span>Received</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-indigo-500/25" />
                        <span>Remaining</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project List — only show projects with payment setup */}
                <div className="space-y-4">
                  {activeProjects.filter((p) => getEffectiveTotal(p) > 0 || p.paidAmount > 0).map((project) => {
                    const isMonthly = project.paymentModel === 'monthly'
                    const isInternal = project.paymentModel === 'internal'
                    const progress = (isMonthly || isInternal) ? 0 : calculateProgress(project.paidAmount, getEffectiveTotal(project))

                    return (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="block"
                      >
                        <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div
                            className="w-2 h-10 rounded-full"
                            style={{ backgroundColor: project.color || '#6366F1' }}
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
                                <span>{formatCurrency(project.paidAmount)} / {formatCurrency(getEffectiveTotal(project))}</span>
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

        {/* In-Warranty Projects */}
        {warrantyProjects.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>In Warranty</CardTitle>
                  <CardDescription>
                    Completed projects still covered
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {warrantyProjects.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {warrantyProjects.map((project) => {
                  const daysLeft = getWarrantyDaysLeft(project)
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block"
                    >
                      <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div
                          className="w-2 h-10 rounded-full"
                          style={{ backgroundColor: project.color || '#6366F1' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-base truncate">{project.name}</p>
                            <WarrantyBadge project={project} className="shrink-0" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {project.clientName || 'Internal'}
                            {project.warrantyStartDate && (
                              <>
                                <span> · </span>
                                <span>
                                  Expires {formatDate(
                                    (() => {
                                      const start = project.warrantyStartDate.toDate()
                                      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate())
                                      end.setDate(end.getDate() + (project.warrantyDays ?? 0))
                                      return end
                                    })(),
                                  )}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className={`text-right text-sm font-medium ${daysLeft <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                          {daysLeft} day{daysLeft === 1 ? '' : 's'}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
        </div>

        {/* Right column: My Tasks + In Review */}
        <div className="space-y-6">
        {/* Tasks Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>My Tasks</CardTitle>
                <CardDescription>
                  {allTodoTasks.length + allInProgressTasks.length + reviewTasks.length} tasks need attention
                </CardDescription>
              </div>
              {(allTodoTasks.length > 5 || allInProgressTasks.length > 5 || reviewTasks.length > 5) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllTasks(!showAllTasks)}
                >
                  {showAllTasks ? 'Show Less' : 'View All'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {todoTasks.length === 0 && inProgressTasks.length === 0 && reviewTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending tasks</p>
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              <>
                {/* In Progress Tasks */}
                {(showAllTasks ? allInProgressTasks : inProgressTasks).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <h4 className="text-sm font-medium text-muted-foreground">
                        In Progress ({allInProgressTasks.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {(showAllTasks ? allInProgressTasks : inProgressTasks).map((task) => {
                        const project = projectsMap[task.projectId]
                        const taskType = task.taskType || 'task'
                        const borderColor = taskTypeBorderColors[taskType]
                        const deadlineInfo = getDeadlineInfo(task, project)
                        const assignees = (task.assigneeIds || []).map((id) => membersMap[id]).filter(Boolean)
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
                              {assignees.length > 0 && (
                                <MemberAvatarGroup members={assignees} max={3} size="sm" />
                              )}
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


                {/* Review Tasks */}
                {(showAllTasks ? reviewTasks : reviewTasks.slice(0, 5)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Waiting for Review ({reviewTasks.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {(showAllTasks ? reviewTasks : reviewTasks.slice(0, 5)).map((task) => {
                        const project = projectsMap[task.projectId]
                        const taskType = task.taskType || 'task'
                        const borderColor = taskTypeBorderColors[taskType]
                        const deadlineInfo = getDeadlineInfo(task, project)
                        const assignees = (task.assigneeIds || []).map((id) => membersMap[id]).filter(Boolean)
                        return (
                          <Link
                            key={task.id}
                            href={`/projects/${task.projectId}`}
                            className="block"
                          >
                            <div
                              className="flex items-center gap-3 p-3 border border-l-[3px] bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10 transition-colors"
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
                              {assignees.length > 0 && (
                                <MemberAvatarGroup members={assignees} max={3} size="sm" />
                              )}
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
                {(showAllTasks ? allTodoTasks : todoTasks).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      <h4 className="text-sm font-medium text-muted-foreground">
                        To Do ({allTodoTasks.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {(showAllTasks ? allTodoTasks : todoTasks).map((task) => {
                        const project = projectsMap[task.projectId]
                        const taskType = task.taskType || 'task'
                        const borderColor = taskTypeBorderColors[taskType]
                        const deadlineInfo = getDeadlineInfo(task, project)
                        const assignees = (task.assigneeIds || []).map((id) => membersMap[id]).filter(Boolean)
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
                              {assignees.length > 0 && (
                                <MemberAvatarGroup members={assignees} max={3} size="sm" />
                              )}
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

        {/* Team Tasks */}
        {isAppOwner && (() => {
          const teamTotal = teamTodoTasks.length + teamInProgressTasks.length + teamReviewTasks.length
          if (teamTotal === 0) return null
          const teamInProgressShown = showAllTeamTasks ? teamInProgressTasks : teamInProgressTasks.slice(0, 5)
          const teamTodoShown = showAllTeamTasks ? teamTodoTasks : teamTodoTasks.slice(0, 5)
          const teamReviewShown = showAllTeamTasks ? teamReviewTasks : teamReviewTasks.slice(0, 5)
          const hasMoreTeam =
            teamInProgressTasks.length > 5 ||
            teamTodoTasks.length > 5 ||
            teamReviewTasks.length > 5
          return (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Team Tasks</CardTitle>
                    <CardDescription>
                      {teamTotal} {teamTotal === 1 ? 'task' : 'tasks'} assigned to other members
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasMoreTeam && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllTeamTasks(!showAllTeamTasks)}
                      >
                        {showAllTeamTasks ? 'Show Less' : 'View All'}
                      </Button>
                    )}
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {teamInProgressShown.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <h4 className="text-sm font-medium text-muted-foreground">
                        In Progress ({teamInProgressTasks.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {teamInProgressShown.map((task) => {
                        const project = projectsMap[task.projectId]
                        const taskType = task.taskType || 'task'
                        const borderColor = taskTypeBorderColors[taskType]
                        const deadlineInfo = getDeadlineInfo(task, project)
                        const assignees = (task.assigneeIds || []).map((id) => membersMap[id]).filter(Boolean)
                        return (
                          <Link key={task.id} href={`/projects/${task.projectId}`} className="block">
                            <div
                              className="flex items-center gap-3 p-3 border border-l-[3px] bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 transition-colors"
                              style={{ borderLeftColor: borderColor }}
                            >
                              {project && (
                                <ProjectIcon src={project.coverImageUrl} name={project.name} size="sm" />
                              )}
                              <p className="flex-1 min-w-0 font-medium truncate">{task.name}</p>
                              {assignees.length > 0 && (
                                <MemberAvatarGroup members={assignees} max={3} size="sm" />
                              )}
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

                {teamReviewShown.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <h4 className="text-sm font-medium text-muted-foreground">
                        In Review ({teamReviewTasks.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {teamReviewShown.map((task) => {
                        const project = projectsMap[task.projectId]
                        const taskType = task.taskType || 'task'
                        const borderColor = taskTypeBorderColors[taskType]
                        const deadlineInfo = getDeadlineInfo(task, project)
                        const assignees = (task.assigneeIds || []).map((id) => membersMap[id]).filter(Boolean)
                        return (
                          <Link key={task.id} href={`/projects/${task.projectId}`} className="block">
                            <div
                              className="flex items-center gap-3 p-3 border border-l-[3px] bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10 transition-colors"
                              style={{ borderLeftColor: borderColor }}
                            >
                              {project && (
                                <ProjectIcon src={project.coverImageUrl} name={project.name} size="sm" />
                              )}
                              <p className="flex-1 min-w-0 font-medium truncate">{task.name}</p>
                              {assignees.length > 0 && (
                                <MemberAvatarGroup members={assignees} max={3} size="sm" />
                              )}
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

                {teamTodoShown.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      <h4 className="text-sm font-medium text-muted-foreground">
                        To Do ({teamTodoTasks.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {teamTodoShown.map((task) => {
                        const project = projectsMap[task.projectId]
                        const taskType = task.taskType || 'task'
                        const borderColor = taskTypeBorderColors[taskType]
                        const deadlineInfo = getDeadlineInfo(task, project)
                        const assignees = (task.assigneeIds || []).map((id) => membersMap[id]).filter(Boolean)
                        return (
                          <Link key={task.id} href={`/projects/${task.projectId}`} className="block">
                            <div
                              className="flex items-center gap-3 p-3 border border-l-[3px] hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors"
                              style={{ borderLeftColor: borderColor }}
                            >
                              {project && (
                                <ProjectIcon src={project.coverImageUrl} name={project.name} size="sm" />
                              )}
                              <p className="flex-1 min-w-0 font-medium truncate">{task.name}</p>
                              {assignees.length > 0 && (
                                <MemberAvatarGroup members={assignees} max={3} size="sm" />
                              )}
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
              </CardContent>
            </Card>
          )
        })()}

        </div>
      </div>

    </div>
  )
}
