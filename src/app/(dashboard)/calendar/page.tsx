'use client'

import { useState, useEffect, useRef, forwardRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventInput } from '@fullcalendar/core'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@/components/calendar/calendar-styles.css'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Calendar as MiniCalendar } from '@/components/ui/calendar'

import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { useProjects } from '@/hooks/useProjects'
import { CalendarEvent, CalendarEventStatus, CalendarCategory } from '@/types'
import { toast } from 'react-toastify'
import {
  Plus,
  X,
  Trash2,
  Filter,
  ChevronLeft,
  CalendarDays,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Status color mapping
const STATUS_COLORS: Record<CalendarEventStatus, string> = {
  todo: 'info',
  in_progress: 'primary',
  review: 'warning',
  done: 'success',
  cancelled: 'secondary',
}

const STATUS_LABELS: Record<CalendarEventStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
}

const STATUS_DOT_COLORS: Record<CalendarEventStatus, string> = {
  todo: 'bg-sky-500',
  in_progress: 'bg-primary',
  review: 'bg-amber-500',
  done: 'bg-green-500',
  cancelled: 'bg-gray-400',
}

const CATEGORY_LABELS: Record<CalendarCategory, string> = {
  work: 'Work',
  meeting: 'Meeting',
  deadline: 'Deadline',
  personal: 'Personal',
  reminder: 'Reminder',
}

const CATEGORY_DOT_COLORS: Record<CalendarCategory, string> = {
  work: 'bg-primary',
  meeting: 'bg-amber-500',
  deadline: 'bg-red-500',
  personal: 'bg-green-500',
  reminder: 'bg-sky-500',
}

const CATEGORY_COLORS: Record<CalendarCategory, string> = {
  work: 'primary',
  meeting: 'warning',
  deadline: 'error',
  personal: 'success',
  reminder: 'info',
}

const ALL_STATUSES: CalendarEventStatus[] = ['todo', 'in_progress', 'review', 'done', 'cancelled']
const ALL_CATEGORIES: CalendarCategory[] = ['work', 'meeting', 'deadline', 'personal', 'reminder']

interface EventFormState {
  title: string
  description: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  allDay: boolean
  category: CalendarCategory
  status: CalendarEventStatus
  projectId: string
}

function dateToInputs(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function inputsToDate(dateStr: string, timeStr: string) {
  return new Date(`${dateStr}T${timeStr || '00:00'}`)
}

const today = dateToInputs(new Date())

const defaultFormState: EventFormState = {
  title: '',
  description: '',
  startDate: today.date,
  startTime: today.time,
  endDate: today.date,
  endTime: today.time,
  allDay: true,
  category: 'work',
  status: 'todo',
  projectId: '',
}

export default function CalendarPage() {
  const { events, loading, createEvent, updateEvent, deleteEvent } = useCalendarEvents()
  const { projects } = useProjects()

  const calendarRef = useRef<any>(null)
  const [calendarApi, setCalendarApi] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<EventFormState>(defaultFormState)
  const [selectedStatuses, setSelectedStatuses] = useState<CalendarEventStatus[]>([...ALL_STATUSES])
  const [selectedCategories, setSelectedCategories] = useState<CalendarCategory[]>([...ALL_CATEGORIES])
  const [miniCalDate, setMiniCalDate] = useState<Date | undefined>(new Date())
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; event: CalendarEvent } | null>(null)
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (calendarRef.current && !calendarApi) {
      setCalendarApi(calendarRef.current.getApi())
    }
  }, [calendarApi])

  // Convert Firestore events to FullCalendar format
  // Note: FullCalendar treats allDay end dates as exclusive,
  // so we add one day to make multi-day events span correctly
  const calendarEvents: EventInput[] = events
    .filter(e => selectedStatuses.includes(e.status) && selectedCategories.includes(e.category))
    .map(event => {
      const end = event.end.toDate()
      if (event.allDay) {
        end.setDate(end.getDate() + 1)
        end.setHours(0, 0, 0, 0)
      }
      return {
        id: event.id,
        title: event.title,
        start: event.start.toDate(),
        end,
        allDay: event.allDay,
        display: 'block',
        extendedProps: {
          status: event.status,
          category: event.category,
          description: event.description,
          projectId: event.projectId,
        }
      }
    })

  const handleDateClick = (info: any) => {
    const d = dateToInputs(info.date)
    setSelectedEvent(null)
    setForm({
      ...defaultFormState,
      startDate: d.date,
      startTime: d.time,
      endDate: d.date,
      endTime: d.time,
      allDay: true,
    })
    setDialogOpen(true)
  }

  const handleEventClick = ({ event: clickedEvent }: any) => {
    const original = events.find(e => e.id === clickedEvent.id)
    if (!original) return

    const startD = dateToInputs(original.start.toDate())
    const endD = dateToInputs(original.end.toDate())

    setSelectedEvent(original)
    setForm({
      title: original.title,
      description: original.description,
      startDate: startD.date,
      startTime: startD.time,
      endDate: endD.date,
      endTime: endD.time,
      allDay: original.allDay,
      category: original.category,
      status: original.status,
      projectId: original.projectId || '',
    })
    setDialogOpen(true)
  }

  const handleEventDrop = async ({ event: droppedEvent }: any) => {
    await updateEvent(droppedEvent.id, {
      start: droppedEvent.start,
      end: droppedEvent.end || droppedEvent.start,
      allDay: droppedEvent.allDay,
    })
  }

  const handleEventResize = async ({ event: resizedEvent }: any) => {
    await updateEvent(resizedEvent.id, {
      start: resizedEvent.start,
      end: resizedEvent.end || resizedEvent.start,
    })
  }

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }

    const data = {
      title: form.title,
      description: form.description,
      start: form.allDay
        ? new Date(`${form.startDate}T00:00:00`)
        : inputsToDate(form.startDate, form.startTime),
      end: form.allDay
        ? new Date(`${form.endDate}T23:59:59`)
        : inputsToDate(form.endDate, form.endTime),
      allDay: form.allDay,
      category: form.category,
      status: form.status,
      projectId: form.projectId || undefined,
    }

    // Close dialog immediately
    setDialogOpen(false)
    setSavingDate(form.startDate)

    // Sync in background
    const syncPromise = selectedEvent
      ? updateEvent(selectedEvent.id, data)
      : createEvent(data)

    syncPromise.finally(() => {
      setSavingDate(null)
    })

    setSelectedEvent(null)
  }

  const handleDelete = async () => {
    if (selectedEvent) {
      await deleteEvent(selectedEvent.id)
      setDialogOpen(false)
      setSelectedEvent(null)
    }
  }

  const handleClose = () => {
    setDialogOpen(false)
    setSelectedEvent(null)
    setForm(defaultFormState)
  }

  const handleStatusFilterToggle = (status: CalendarEventStatus) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    )
  }

  const handleCategoryFilterToggle = (category: CalendarCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    )
  }

  const handleEventMouseEnter = (info: any) => {
    const original = events.find(e => e.id === info.event.id)
    if (!original) return
    const rect = info.el.getBoundingClientRect()
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current)
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top, event: original })
  }

  const handleEventMouseLeave = () => {
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 150)
  }

  const getEventColor = (category: CalendarCategory): string => {
    return CATEGORY_COLORS[category] || 'primary'
  }

  const calendarOptions: CalendarOptions = {
    events: calendarEvents,
    plugins: [interactionPlugin, dayGridPlugin, timeGridPlugin, listPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      start: 'sidebarToggle, prev, next, title',
      end: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
    },
    views: {
      week: {
        titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
      }
    },
    editable: true,
    eventResizableFromStart: true,
    dragScroll: true,
    dayMaxEvents: 2,
    navLinks: true,
    height: 'auto',
    dayCellClassNames(arg: any) {
      if (!savingDate) return []
      const cellDate = arg.date
      const pad = (n: number) => n.toString().padStart(2, '0')
      const cellStr = `${cellDate.getFullYear()}-${pad(cellDate.getMonth() + 1)}-${pad(cellDate.getDate())}`
      return cellStr === savingDate ? ['fc-day-saving'] : []
    },
    eventClassNames({ event: calendarEvent }: any) {
      const category = calendarEvent._def.extendedProps.category as CalendarCategory
      return [`event-bg-${getEventColor(category)}`]
    },
    eventClick: handleEventClick,
    dateClick: handleDateClick,
    eventDrop: handleEventDrop,
    eventResize: handleEventResize,
    eventMouseEnter: handleEventMouseEnter,
    eventMouseLeave: handleEventMouseLeave,
    customButtons: {
      sidebarToggle: {
        icon: 'bi bi-list',
        click() {
          setSidebarOpen(!sidebarOpen)
        }
      }
    },
    // @ts-expect-error - ref type
    ref: calendarRef,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Button onClick={() => { setSelectedEvent(null); setForm(defaultFormState); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      <Card className="overflow-visible">
        <div className="app-calendar">
          {/* Left Sidebar - Filters */}
          <div className={cn(
            'border-r bg-card transition-all duration-300 overflow-hidden flex-shrink-0',
            sidebarOpen ? 'w-64 p-4' : 'w-0 md:w-64 md:p-4'
          )}>
            <div className="space-y-4 min-w-[14rem]">
              {/* Mini Calendar */}
              <MiniCalendar
                selected={miniCalDate}
                className="p-1"
                onSelect={(date) => {
                  if (date) {
                    setMiniCalDate(date)
                    calendarApi?.gotoDate(date)
                  }
                }}
              />

              <Separator />

              {/* Status Filters */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Status</h3>
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="all-statuses"
                    checked={selectedStatuses.length === ALL_STATUSES.length}
                    onCheckedChange={(checked) =>
                      setSelectedStatuses(checked ? [...ALL_STATUSES] : [])
                    }
                  />
                  <label htmlFor="all-statuses" className="text-sm cursor-pointer">View All</label>
                </div>
                {ALL_STATUSES.map(status => (
                  <div key={status} className="flex items-center gap-2 mb-1.5">
                    <Checkbox
                      id={`status-${status}`}
                      checked={selectedStatuses.includes(status)}
                      onCheckedChange={() => handleStatusFilterToggle(status)}
                    />
                    <div className={cn('w-2.5 h-2.5 rounded-full', STATUS_DOT_COLORS[status])} />
                    <label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
                      {STATUS_LABELS[status]}
                    </label>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Category Filters */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Category</h3>
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="all-categories"
                    checked={selectedCategories.length === ALL_CATEGORIES.length}
                    onCheckedChange={(checked) =>
                      setSelectedCategories(checked ? [...ALL_CATEGORIES] : [])
                    }
                  />
                  <label htmlFor="all-categories" className="text-sm cursor-pointer">View All</label>
                </div>
                {ALL_CATEGORIES.map(category => (
                  <div key={category} className="flex items-center gap-2 mb-1.5">
                    <Checkbox
                      id={`cat-${category}`}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleCategoryFilterToggle(category)}
                    />
                    <div className={cn('w-2.5 h-2.5 rounded-full', CATEGORY_DOT_COLORS[category])} />
                    <label htmlFor={`cat-${category}`} className="text-sm cursor-pointer">
                      {CATEGORY_LABELS[category]}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="p-5 pb-0 flex-grow overflow-visible">
            <FullCalendar {...calendarOptions} />
          </div>
        </div>
      </Card>

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{selectedEvent ? 'Update Event' : 'Add Event'}</DialogTitle>
              {selectedEvent && (
                <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="event-title">Title *</Label>
              <Input
                id="event-title"
                placeholder="Event title..."
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as CalendarCategory })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        <span className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', CATEGORY_DOT_COLORS[cat])} />
                          {CATEGORY_LABELS[cat]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CalendarEventStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map(status => (
                      <SelectItem key={status} value={status}>
                        <span className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', STATUS_DOT_COLORS[status])} />
                          {STATUS_LABELS[status]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="all-day"
                checked={form.allDay}
                onCheckedChange={(checked) => setForm({ ...form, allDay: checked })}
              />
              <Label htmlFor="all-day" className="cursor-pointer">All Day</Label>
            </div>

            {/* Start & End Date/Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="start-date"
                    type="date"
                    className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    value={form.startDate}
                    onChange={e => {
                      const newStart = e.target.value
                      setForm(prev => ({
                        ...prev,
                        startDate: newStart,
                        endDate: newStart > prev.endDate ? newStart : prev.endDate,
                      }))
                    }}
                  />
                </div>
                {!form.allDay && (
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="start-time"
                      type="time"
                      className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      value={form.startTime}
                      onChange={e => setForm({ ...form, startTime: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="end-date"
                    type="date"
                    className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
                {!form.allDay && (
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="end-time"
                      type="time"
                      className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      value={form.endTime}
                      onChange={e => setForm({ ...form, endTime: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Project (optional) */}
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <Select value={form.projectId || '_none'} onValueChange={(v) => setForm({ ...form, projectId: v === '_none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="event-desc">Description</Label>
              <textarea
                id="event-desc"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Event description..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {selectedEvent ? 'Update' : 'Add Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Hover Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 max-w-[280px]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', CATEGORY_DOT_COLORS[tooltip.event.category])} />
              <span className="font-semibold text-sm truncate">{tooltip.event.title}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {tooltip.event.start.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {tooltip.event.start.toDate().toDateString() !== tooltip.event.end.toDate().toDateString() && (
                  <> – {tooltip.event.end.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                )}
              </span>
              {!tooltip.event.allDay && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {tooltip.event.start.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{CATEGORY_LABELS[tooltip.event.category]}</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <span className={cn('w-1.5 h-1.5 rounded-full mr-1', STATUS_DOT_COLORS[tooltip.event.status])} />
                {STATUS_LABELS[tooltip.event.status]}
              </Badge>
            </div>
            {tooltip.event.description && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{tooltip.event.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
