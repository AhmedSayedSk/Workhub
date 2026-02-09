'use client'

import { useState, useMemo } from 'react'
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

  // Group by day for chart
  const dayTotals = eachDayOfInterval({ start, end }).map((date) => {
    const dayEntries = timeEntries.filter((e) => {
      const entryDate = e.startTime.toDate()
      return (
        entryDate >= startOfDay(date) && entryDate <= endOfDay(date)
      )
    })
    const minutes = dayEntries.reduce((sum, e) => sum + e.duration, 0)
    return {
      date: format(date, 'EEE'),
      fullDate: format(date, 'MMM d'),
      hours: Math.round((minutes / 60) * 10) / 10,
    }
  })

  // Group by project
  const projectTotals = Object.entries(
    timeEntries.reduce((acc, entry) => {
      const projectId = entry.projectId
      if (!acc[projectId]) {
        acc[projectId] = 0
      }
      acc[projectId] += entry.duration
      return acc
    }, {} as Record<string, number>)
  )
    .map(([projectId, minutes]) => ({
      project: projectsMap[projectId]?.name || 'Unknown',
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
                Math.round(totalMinutes / Math.max(1, dayTotals.filter((d) => d.hours > 0).length))
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
            <CardDescription>Hours worked each day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
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
                      return (
                        <div className="bg-popover text-popover-foreground rounded-lg border p-2 shadow-md">
                          <p className="font-medium">{payload[0].payload.fullDate}</p>
                          <p className="text-sm text-muted-foreground">
                            {payload[0].value} hours
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="hours"
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
            <CardTitle>By Project</CardTitle>
            <CardDescription>Time distribution across projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projectTotals.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No time tracked in this period
                </p>
              ) : (
                projectTotals.slice(0, 5).map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.project}</span>
                      <span className="text-muted-foreground">
                        {formatDuration(item.minutes)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${(item.minutes / totalMinutes) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
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
