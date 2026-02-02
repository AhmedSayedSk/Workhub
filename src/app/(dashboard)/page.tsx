'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { projects, tasks, timeEntries, systems } from '@/lib/firestore'
import { Project, Task, TimeEntry, System } from '@/types'
import { formatCurrency, formatDuration, formatDate, statusColors, calculateProgress } from '@/lib/utils'
import {
  FolderKanban,
  Clock,
  Wallet,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'

export default function DashboardPage() {
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([])
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [systemsMap, setSystemsMap] = useState<Record<string, System>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [projectsData, tasksData, systemsData] = await Promise.all([
        projects.getByStatus('active'),
        tasks.getByStatus('in_progress'),
        systems.getAll(),
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
      setRecentTasks(tasksData.slice(0, 5))
      setTodayEntries(todayData)
      setWeekEntries(weekData)

      const sysMap: Record<string, System> = {}
      systemsData.forEach((s) => {
        sysMap[s.id] = s
      })
      setSystemsMap(sysMap)
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
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Total Owed</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOwed)}</div>
            <p className="text-xs text-muted-foreground">
              From active projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(todayMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              Tracked today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(weekMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              Total hours this week
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

        {/* Recent Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tasks in Progress</CardTitle>
                <CardDescription>Currently working on</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tasks in progress</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={statusColors.priority[task.priority]}
                        >
                          {task.priority}
                        </Badge>
                        {task.estimatedHours > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Est: {task.estimatedHours}h
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={statusColors.task[task.status]}
                    >
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
