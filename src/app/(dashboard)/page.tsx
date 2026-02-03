'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { projects, tasks, timeEntries, systems, milestones } from '@/lib/firestore'
import { Project, Task, TimeEntry, System, Milestone } from '@/types'
import { formatCurrency, formatDuration, formatDate, statusColors, calculateProgress } from '@/lib/utils'
import {
  FolderKanban,
  Clock,
  Wallet,
  CheckCircle2,
  ArrowRight,
  Plus,
  CircleDollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'

export default function DashboardPage() {
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [todoTasks, setTodoTasks] = useState<Task[]>([])
  const [inProgressTasks, setInProgressTasks] = useState<Task[]>([])
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([])
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [systemsMap, setSystemsMap] = useState<Record<string, System>>({})
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({})
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [projectsData, todoData, inProgressData, systemsData, allProjects, milestonesData] = await Promise.all([
        projects.getByStatus('active'),
        tasks.getByStatus('todo'),
        tasks.getByStatus('in_progress'),
        systems.getAll(),
        projects.getAll(),
        milestones.getAll(),
      ])

      const now = new Date()
      const todayStart = startOfDay(now)
      const todayEnd = endOfDay(now)
      const weekStart = startOfWeek(now)
      const weekEnd = endOfWeek(now)

      const [todayData, weekData] = await Promise.all([
        timeEntries.getByDateRange(todayStart, todayEnd),
        timeEntries.getByDateRange(weekStart, weekEnd),
      ])

      setActiveProjects(projectsData.slice(0, 5))
      setTodoTasks(todoData.slice(0, 5))
      setInProgressTasks(inProgressData.slice(0, 5))
      setTodayEntries(todayData)
      setWeekEntries(weekData)

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
      setAllMilestones(milestonesData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalOwed = activeProjects.reduce(
    (sum, p) => sum + (p.totalAmount - p.paidAmount),
    0
  )

  const totalReceived = activeProjects.reduce(
    (sum, p) => sum + p.paidAmount,
    0
  )

  // Find nearest payment deadline from unpaid milestones of active projects
  const activeProjectIds = new Set(activeProjects.map(p => p.id))
  const unpaidMilestones = allMilestones
    .filter(m =>
      activeProjectIds.has(m.projectId) &&
      m.status !== 'paid' &&
      m.dueDate
    )
    .map(m => m.dueDate.toDate())
    .sort((a, b) => a.getTime() - b.getTime())

  const nearestPaymentDeadline = unpaidMilestones[0] || null

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

  const todayMinutes = todayEntries.reduce((sum, e) => sum + e.duration, 0)
  const weekMinutes = weekEntries.reduce((sum, e) => sum + e.duration, 0)

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Owed</CardTitle>
            <Wallet className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalOwed)}</div>
            <p className="text-xs text-muted-foreground">
              {daysUntilDeadline !== null ? (
                daysUntilDeadline < 0 ? (
                  <span className="text-red-500">{Math.abs(daysUntilDeadline)} days overdue</span>
                ) : daysUntilDeadline === 0 ? (
                  <span className="text-orange-500">Due today</span>
                ) : (
                  <span>{daysUntilDeadline} days until next payment</span>
                )
              ) : (
                'Pending from active projects'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
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
      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Projects</CardTitle>
                <CardDescription>Your current work in progress</CardDescription>
              </div>
              <Link href="/projects">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
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
              <div className="space-y-4">
                {activeProjects.map((project) => {
                  const system = systemsMap[project.systemId]
                  const progress = calculateProgress(project.paidAmount, project.totalAmount)

                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block"
                    >
                      <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div
                          className="w-2 h-10 rounded-full"
                          style={{ backgroundColor: system?.color || '#6366F1' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">{project.name}</p>
                            <Badge
                              variant="outline"
                              className={statusColors.project[project.status]}
                            >
                              {project.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <Progress value={progress} className="flex-1 h-2" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatCurrency(project.paidAmount)} / {formatCurrency(project.totalAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
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
                        return (
                          <Link
                            key={task.id}
                            href={`/projects/${task.projectId}`}
                            className="block"
                          >
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{task.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {project && (
                                    <span className="text-xs text-muted-foreground truncate">
                                      {project.name}
                                    </span>
                                  )}
                                  {task.estimatedHours > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      • {task.estimatedHours}h
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={statusColors.priority[task.priority]}
                              >
                                {task.priority}
                              </Badge>
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
                        return (
                          <Link
                            key={task.id}
                            href={`/projects/${task.projectId}`}
                            className="block"
                          >
                            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{task.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {project && (
                                    <span className="text-xs text-muted-foreground truncate">
                                      {project.name}
                                    </span>
                                  )}
                                  {task.estimatedHours > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      • {task.estimatedHours}h
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={statusColors.priority[task.priority]}
                              >
                                {task.priority}
                              </Badge>
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
