'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { useTimeEntries } from '@/hooks/useTimeEntries'
import { useProjects } from '@/hooks/useProjects'
import { timeEntries as timeEntriesApi } from '@/lib/firestore'
import { TimeEntry } from '@/types'
import {
  formatDuration,
  formatDate,
  formatTime,
} from '@/lib/utils'
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  eachDayOfInterval,
} from 'date-fns'
import { Clock, Plus, Loader2, Trash2, Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export default function TimePage() {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week')
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Memoize date ranges to prevent infinite re-fetching
  const { start, end } = useMemo(() => {
    const now = new Date()
    const ranges = {
      today: { start: startOfDay(now), end: endOfDay(now) },
      week: { start: startOfWeek(now), end: endOfWeek(now) },
      month: { start: startOfMonth(now), end: endOfMonth(now) },
    }
    return ranges[dateRange]
  }, [dateRange])

  const {
    timeEntries,
    projectsMap,
    tasksMap,
    loading,
    createTimeEntry,
    deleteTimeEntry,
  } = useTimeEntries(undefined, start, end)

  const { projects } = useProjects()

  // "By Project" distribution mode: today, week, or all time
  const [distributionMode, setDistributionMode] = useState<'today' | 'week' | 'all'>('today')
  const [allTimeEntries, setAllTimeEntries] = useState<TimeEntry[]>([])
  const [allTimeLoading, setAllTimeLoading] = useState(false)

  const todayStart = useMemo(() => startOfDay(new Date()), [])
  const todayEnd = useMemo(() => endOfDay(new Date()), [])
  const weekStart = useMemo(() => startOfWeek(new Date()), [])
  const weekEnd = useMemo(() => endOfWeek(new Date()), [])

  // Filter entries by distribution mode
  const todayEntries = useMemo(() => {
    const source = allTimeEntries.length > 0 ? allTimeEntries : timeEntries
    return source.filter((e) => {
      const d = e.startTime.toDate()
      return d >= todayStart && d <= todayEnd
    })
  }, [timeEntries, allTimeEntries, todayStart, todayEnd])

  const weekEntries = useMemo(() => {
    const source = allTimeEntries.length > 0 ? allTimeEntries : timeEntries
    return source.filter((e) => {
      const d = e.startTime.toDate()
      return d >= weekStart && d <= weekEnd
    })
  }, [timeEntries, allTimeEntries, weekStart, weekEnd])

  useEffect(() => {
    if (distributionMode === 'all' && allTimeEntries.length === 0) {
      setAllTimeLoading(true)
      timeEntriesApi.getAll().then((entries) => {
        setAllTimeEntries(entries)
      }).finally(() => setAllTimeLoading(false))
    }
  }, [distributionMode, allTimeEntries.length])

  const [manualForm, setManualForm] = useState({
    projectId: '',
    taskId: '',
    date: new Date() as Date | null,
    hours: '',
    minutes: '',
    notes: '',
  })

  // Calculate totals
  const totalMinutes = timeEntries.reduce((sum, e) => sum + e.duration, 0)

  const CHART_COLORS_FALLBACK = [
    'hsl(var(--primary))',
    'hsl(var(--chart-2, 160 60% 45%))',
    'hsl(var(--chart-3, 30 80% 55%))',
    'hsl(var(--chart-4, 280 65% 60%))',
    'hsl(var(--chart-5, 340 75% 55%))',
    'hsl(200 70% 50%)',
    'hsl(45 90% 50%)',
    'hsl(120 50% 45%)',
  ]

  // Get unique project IDs from entries
  const uniqueProjectIds = useMemo(() => {
    const ids = new Set<string>()
    timeEntries.forEach((e) => ids.add(e.projectId))
    return Array.from(ids)
  }, [timeEntries])

  // Group by day for chart — each day has per-project hours
  const dayTotals = eachDayOfInterval({ start, end }).map((date) => {
    const dayEntries = timeEntries.filter((e) => {
      const entryDate = e.startTime.toDate()
      return (
        entryDate >= startOfDay(date) && entryDate <= endOfDay(date)
      )
    })
    const row: Record<string, string | number> = {
      date: `${format(date, 'EEE')} ${format(date, 'M/d')}`,
      fullDate: format(date, 'EEEE, MMM d'),
    }
    uniqueProjectIds.forEach((pid) => {
      const mins = dayEntries
        .filter((e) => e.projectId === pid)
        .reduce((sum, e) => sum + e.duration, 0)
      row[pid] = Math.round((mins / 60) * 10) / 10
    })
    return row
  })

  // Group by project — uses today's, week's, or all-time entries based on mode
  const distributionEntries = distributionMode === 'all' ? allTimeEntries : distributionMode === 'week' ? weekEntries : todayEntries
  const distributionTotalMinutes = distributionEntries.reduce((sum, e) => sum + e.duration, 0)

  const projectTotals = Object.entries(
    distributionEntries.reduce((acc, entry) => {
      const projectId = entry.projectId
      if (!acc[projectId]) {
        acc[projectId] = 0
      }
      acc[projectId] += entry.duration
      return acc
    }, {} as Record<string, number>)
  )
    .map(([projectId, minutes]) => ({
      projectId,
      project: projectsMap[projectId]?.name || 'Unknown',
      color: projectsMap[projectId]?.color,
      minutes,
      hours: Math.round((minutes / 60) * 10) / 10,
    }))
    .sort((a, b) => b.minutes - a.minutes)

  const handleManualEntry = async () => {
    const duration =
      (parseInt(manualForm.hours) || 0) * 60 +
      (parseInt(manualForm.minutes) || 0)

    if (!manualForm.projectId || duration <= 0 || !manualForm.date) return

    setIsSubmitting(true)
    try {
      const entryDate = manualForm.date
      await createTimeEntry({
        projectId: manualForm.projectId,
        taskId: manualForm.taskId || '',
        subtaskId: '',
        startTime: entryDate,
        endTime: new Date(entryDate.getTime() + duration * 60000),
        duration,
        notes: manualForm.notes,
        isManual: true,
      })
      setManualForm({
        projectId: '',
        taskId: '',
        date: new Date(),
        hours: '',
        minutes: '',
        notes: '',
      })
      setIsManualEntryOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time Tracking</h1>
          <p className="text-muted-foreground">
            Track and analyze your work time
          </p>
        </div>
        <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Manual Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Time Entry</DialogTitle>
              <DialogDescription>
                Manually log time for a project
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={manualForm.projectId}
                  onValueChange={(value) =>
                    setManualForm({ ...manualForm, projectId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker
                  value={manualForm.date}
                  onChange={(date) =>
                    setManualForm({ ...manualForm, date })
                  }
                  placeholder="Select date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={manualForm.hours}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, hours: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="0"
                    value={manualForm.minutes}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, minutes: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="What did you work on?"
                  value={manualForm.notes}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, notes: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsManualEntryOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleManualEntry}
                disabled={isSubmitting || !manualForm.projectId}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Date Range Tabs */}
      <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totalMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {timeEntries.length} entries
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(
                Math.round(totalMinutes / Math.max(1, dayTotals.filter((d) => uniqueProjectIds.some((pid) => (d[pid] as number) > 0)).length))
              )}
            </div>
            <p className="text-xs text-muted-foreground">Per working day</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Project</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projectTotals[0]?.project || '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {projectTotals[0] ? formatDuration(projectTotals[0].minutes) : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Breakdown</CardTitle>
            <CardDescription>Hours worked each day by project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayTotals}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const items = payload.filter((p) => (p.value as number) > 0)
                      const total = items.reduce((sum, p) => sum + (p.value as number), 0)
                      return (
                        <div className="bg-popover text-popover-foreground rounded-lg border p-2.5 shadow-md min-w-[140px]">
                          <p className="font-medium mb-1.5">{payload[0].payload.fullDate}</p>
                          {items.map((p) => (
                            <div key={p.dataKey as string} className="flex items-center justify-between gap-4 text-sm">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0"
                                  style={{ backgroundColor: p.color }}
                                />
                                <span className="text-muted-foreground truncate max-w-[120px]">{p.name}</span>
                              </div>
                              <span className="font-medium">{p.value}h</span>
                            </div>
                          ))}
                          {items.length > 1 && (
                            <div className="flex justify-between text-sm font-medium border-t mt-1.5 pt-1.5">
                              <span>Total</span>
                              <span>{Math.round(total * 10) / 10}h</span>
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
                  {uniqueProjectIds.map((pid, i) => (
                    <Bar
                      key={pid}
                      dataKey={pid}
                      name={projectsMap[pid]?.name || 'Unknown'}
                      stackId="projects"
                      fill={projectsMap[pid]?.color || CHART_COLORS_FALLBACK[i % CHART_COLORS_FALLBACK.length]}
                      radius={i === uniqueProjectIds.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>By Project</CardTitle>
                <CardDescription>Time distribution across projects</CardDescription>
              </div>
              <div className="flex items-center rounded-lg border p-0.5">
                <button
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    distributionMode === 'today'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setDistributionMode('today')}
                >
                  Today
                </button>
                <button
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    distributionMode === 'week'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setDistributionMode('week')}
                >
                  Week
                </button>
                <button
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    distributionMode === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setDistributionMode('all')}
                >
                  All Time
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {distributionMode === 'all' && allTimeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {projectTotals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No time tracked {distributionMode === 'all' ? 'yet' : distributionMode === 'week' ? 'this week' : 'today'}
                  </p>
                ) : (
                  projectTotals.map((item) => (
                    <div key={item.projectId} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color || 'hsl(var(--primary))' }}
                          />
                          <span className="font-medium">{item.project}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {formatDuration(item.minutes)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${distributionTotalMinutes > 0 ? (item.minutes / distributionTotalMinutes) * 100 : 0}%`,
                            backgroundColor: item.color || 'hsl(var(--primary))',
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Entries</CardTitle>
            <CardDescription>Your time log for this period</CardDescription>
          </div>
          {timeEntries.length > 5 && (
            <Link href="/time/entries">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time entries in this period</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {projectsMap[entry.projectId]?.name || 'Unknown Project'}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatDate(entry.startTime)} at {formatTime(entry.startTime)}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-medium text-sm">{formatDuration(entry.duration)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteTimeEntry(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
