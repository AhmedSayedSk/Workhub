'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { formatDuration, formatTime } from '@/lib/utils'
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from 'date-fns'
import { Clock, Plus, Loader2, Trash2, ArrowLeft } from 'lucide-react'
import { TimeEntry } from '@/types'

export default function TimeEntriesPage() {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week')
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const totalMinutes = timeEntries.reduce((sum, e) => sum + e.duration, 0)

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, { label: string; entries: TimeEntry[]; totalMinutes: number }> = {}
    timeEntries.forEach((entry) => {
      const dateKey = format(entry.startTime.toDate(), 'yyyy-MM-dd')
      const dateLabel = format(entry.startTime.toDate(), 'EEEE, MMM d, yyyy')
      if (!groups[dateKey]) {
        groups[dateKey] = { label: dateLabel, entries: [], totalMinutes: 0 }
      }
      groups[dateKey].entries.push(entry)
      groups[dateKey].totalMinutes += entry.duration
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [timeEntries])

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
        <div className="flex items-center gap-4">
          <Link href="/time">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Time Entries</h1>
            <p className="text-muted-foreground">
              {timeEntries.length} entries &middot; {formatDuration(totalMinutes)} total
            </p>
          </div>
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

      {/* Entries Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : timeEntries.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No time entries</p>
              <p className="text-sm mt-1">No entries found for this period</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map(([dateKey, group]) => (
            <Card key={dateKey}>
              {/* Date Group Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
                <span className="text-sm font-medium">{group.label}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    {formatDuration(group.totalMinutes)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left font-medium px-6 py-3 w-[140px]">Project</th>
                      <th className="text-left font-medium px-4 py-3 w-[130px]">Time</th>
                      <th className="text-left font-medium px-4 py-3 w-[100px]">Duration</th>
                      <th className="text-left font-medium px-4 py-3">Notes</th>
                      <th className="text-right font-medium px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b last:border-0 hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors group"
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: projectsMap[entry.projectId]?.color || '#6B8DD6' }}
                            />
                            <span className="font-medium text-sm truncate block">
                              {projectsMap[entry.projectId]?.name || 'Unknown Project'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatTime(entry.startTime)}
                            {entry.endTime && (
                              <> &ndash; {formatTime(entry.endTime)}</>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-base font-mono">
                            {formatDuration(entry.duration)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground">
                            {entry.notes || <span className="italic opacity-50">No notes</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteTimeEntry(entry.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
