'use client'

import React, { useState, useEffect, useRef, useMemo, forwardRef } from 'react'
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
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import { useAuth } from '@/hooks/useAuth'
import { useModulePermissions } from '@/hooks/usePermissions'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { useProjects } from '@/hooks/useProjects'
import { projects as projectsApi } from '@/lib/firestore'
import { uploadFile } from '@/lib/storage'
import { CalendarEvent, CalendarEventStatus, CalendarCategory, Project } from '@/types'
import { toast } from 'react-toastify'
import {
  Plus,
  X,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  FolderTree,
  ChevronsUpDown,
  CalendarDays,
  Clock,
  ImagePlus,
  Table2,
  ArrowUpDown,
  Download,
  ShieldAlert,
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
  imageUrl: string
  imageFile: File | null
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
  imageUrl: '',
  imageFile: null,
}

export default function CalendarPage() {
  const { canModule, loading: permsLoading, isAppOwner } = useModulePermissions()
  const { user } = useAuth()
  const { events, loading, createEvent, updateEvent, deleteEvent } = useCalendarEvents()
  const { projects } = useProjects()

  const calendarRef = useRef<any>(null)
  const [calendarApi, setCalendarApi] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<EventFormState>(defaultFormState)
  const [selectedStatuses, setSelectedStatuses] = useState<CalendarEventStatus[]>([...ALL_STATUSES])
  const [selectedCategories, setSelectedCategories] = useState<CalendarCategory[]>([...ALL_CATEGORIES])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [miniCalDate, setMiniCalDate] = useState<Date | undefined>(new Date())
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; event: CalendarEvent } | null>(null)
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar')
  const [tableSortField, setTableSortField] = useState<'start' | 'title' | 'status' | 'category'>('start')
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    projectsApi.getAll(user?.uid).then(setAllProjects)
  }, [user?.uid])

  // Filter events: owner sees all, members only see events linked to their accessible projects
  const accessibleProjectIds = useMemo(() => new Set(allProjects.map(p => p.id)), [allProjects])
  const accessibleEvents = useMemo(() => {
    if (isAppOwner) return events
    return events.filter(e => e.projectId && accessibleProjectIds.has(e.projectId))
  }, [events, accessibleProjectIds, isAppOwner])

  useEffect(() => {
    if (calendarRef.current && !calendarApi) {
      setCalendarApi(calendarRef.current.getApi())
    }
  }, [calendarApi])

  const parentProjects = useMemo(() => {
    return allProjects.filter(p => !p.parentProjectId)
  }, [allProjects])

  const subProjectsByParent = useMemo(() => {
    const map: Record<string, Project[]> = {}
    allProjects.forEach(p => {
      if (p.parentProjectId) {
        if (!map[p.parentProjectId]) map[p.parentProjectId] = []
        map[p.parentProjectId].push(p)
      }
    })
    return map
  }, [allProjects])

  const getProjectName = (projectId: string): string => {
    const project = allProjects.find(p => p.id === projectId)
    return project?.name || ''
  }

  const handleProjectFilterToggle = (projectId: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    )
  }

  // Convert Firestore events to FullCalendar format
  // Note: FullCalendar treats allDay end dates as exclusive,
  // so we add one day to make multi-day events span correctly
  const calendarEvents: EventInput[] = accessibleEvents
    .filter(e => selectedStatuses.includes(e.status) && selectedCategories.includes(e.category))
    .filter(e => selectedProjectIds.length === 0 || selectedProjectIds.includes(e.projectId || ''))
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

  const filteredTableEvents = useMemo(() => {
    const filtered = accessibleEvents
      .filter(e => selectedStatuses.includes(e.status) && selectedCategories.includes(e.category))
      .filter(e => selectedProjectIds.length === 0 || selectedProjectIds.includes(e.projectId || ''))
    filtered.sort((a, b) => {
      let cmp = 0
      switch (tableSortField) {
        case 'start': cmp = (a.start?.toMillis?.() || 0) - (b.start?.toMillis?.() || 0); break
        case 'title': cmp = a.title.localeCompare(b.title); break
        case 'status': cmp = a.status.localeCompare(b.status); break
        case 'category': cmp = a.category.localeCompare(b.category); break
      }
      return tableSortDir === 'asc' ? cmp : -cmp
    })
    return filtered
  }, [accessibleEvents, selectedStatuses, selectedCategories, selectedProjectIds, tableSortField, tableSortDir])

  const handleTableSort = (field: typeof tableSortField) => {
    if (tableSortField === field) setTableSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setTableSortField(field); setTableSortDir('asc') }
  }

  const openEventFromTable = (event: CalendarEvent) => {
    const startD = dateToInputs(event.start.toDate())
    const endD = dateToInputs(event.end.toDate())
    setSelectedEvent(event)
    setForm({
      title: event.title,
      description: event.description,
      startDate: startD.date,
      startTime: startD.time,
      endDate: endD.date,
      endTime: endD.time,
      allDay: event.allDay,
      category: event.category,
      status: event.status,
      projectId: event.projectId || '',
      imageUrl: event.imageUrl || '',
      imageFile: null,
    })
    setDialogOpen(true)
  }

  const eventProjectIds = useMemo(() => {
    const ids = new Set<string>()
    accessibleEvents.forEach(e => {
      if (e.projectId) ids.add(e.projectId)
    })
    return Array.from(ids)
  }, [accessibleEvents])

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
    const original = accessibleEvents.find(e => e.id === clickedEvent.id)
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
      imageUrl: original.imageUrl || '',
      imageFile: null,
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

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }

    // Close dialog immediately
    setDialogOpen(false)
    setSavingDate(form.startDate)

    // Upload image if a new file was selected
    let imageUrl = form.imageUrl || undefined
    if (form.imageFile) {
      try {
        const path = `calendar-events/${user?.uid}/${Date.now()}-${form.imageFile.name}`
        const result = await uploadFile(form.imageFile, path)
        imageUrl = result.url
      } catch {
        toast.error('Failed to upload image')
      }
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
      imageUrl,
    }

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
    const original = accessibleEvents.find(e => e.id === info.event.id)
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
      start: 'sidebarToggle, prev, title, next',
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

  if (!permsLoading && !canModule('viewCalendar')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm">You don&apos;t have permission to access this module.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Calendar</h1>
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 rounded-md text-xs"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" />
              Calendar
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 rounded-md text-xs"
              onClick={() => setViewMode('table')}
            >
              <Table2 className="h-3.5 w-3.5 mr-1" />
              Table
            </Button>
          </div>
        </div>
        <Button onClick={() => { setSelectedEvent(null); setForm(defaultFormState); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {viewMode === 'calendar' ? (
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

              {/* Filters */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Filters</h3>

                {/* Status Filter Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-sm">
                      {selectedStatuses.length === ALL_STATUSES.length
                        ? 'All Statuses'
                        : `${selectedStatuses.length} Status${selectedStatuses.length !== 1 ? 'es' : ''}`}
                      <ChevronsUpDown className="h-3.5 w-3.5 ml-2 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Checkbox
                        id="pop-all-statuses"
                        checked={selectedStatuses.length === ALL_STATUSES.length}
                        onCheckedChange={(checked) =>
                          setSelectedStatuses(checked ? [...ALL_STATUSES] : [])
                        }
                      />
                      <label htmlFor="pop-all-statuses" className="text-sm cursor-pointer">View All</label>
                    </div>
                    {ALL_STATUSES.map(status => (
                      <div key={status} className="flex items-center gap-2 mb-1.5 px-1">
                        <Checkbox
                          id={`pop-status-${status}`}
                          checked={selectedStatuses.includes(status)}
                          onCheckedChange={() => handleStatusFilterToggle(status)}
                        />
                        <div className={cn('w-2.5 h-2.5 rounded-full', STATUS_DOT_COLORS[status])} />
                        <label htmlFor={`pop-status-${status}`} className="text-sm cursor-pointer">
                          {STATUS_LABELS[status]}
                        </label>
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* Category Filter Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-sm">
                      {selectedCategories.length === ALL_CATEGORIES.length
                        ? 'All Categories'
                        : `${selectedCategories.length} Categor${selectedCategories.length !== 1 ? 'ies' : 'y'}`}
                      <ChevronsUpDown className="h-3.5 w-3.5 ml-2 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Checkbox
                        id="pop-all-categories"
                        checked={selectedCategories.length === ALL_CATEGORIES.length}
                        onCheckedChange={(checked) =>
                          setSelectedCategories(checked ? [...ALL_CATEGORIES] : [])
                        }
                      />
                      <label htmlFor="pop-all-categories" className="text-sm cursor-pointer">View All</label>
                    </div>
                    {ALL_CATEGORIES.map(category => (
                      <div key={category} className="flex items-center gap-2 mb-1.5 px-1">
                        <Checkbox
                          id={`pop-cat-${category}`}
                          checked={selectedCategories.includes(category)}
                          onCheckedChange={() => handleCategoryFilterToggle(category)}
                        />
                        <div className={cn('w-2.5 h-2.5 rounded-full', CATEGORY_DOT_COLORS[category])} />
                        <label htmlFor={`pop-cat-${category}`} className="text-sm cursor-pointer">
                          {CATEGORY_LABELS[category]}
                        </label>
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* Project Filter Popover */}
                {eventProjectIds.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between text-sm">
                        {selectedProjectIds.length === 0
                          ? 'All Projects'
                          : `${selectedProjectIds.length} Project${selectedProjectIds.length !== 1 ? 's' : ''}`}
                        <ChevronsUpDown className="h-3.5 w-3.5 ml-2 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <Checkbox
                          id="pop-all-projects"
                          checked={selectedProjectIds.length === 0}
                          onCheckedChange={(checked) =>
                            setSelectedProjectIds(checked ? [] : [...eventProjectIds])
                          }
                        />
                        <label htmlFor="pop-all-projects" className="text-sm cursor-pointer">View All</label>
                      </div>
                      {eventProjectIds.map(pid => (
                        <div key={pid} className="flex items-center gap-2 mb-1.5 px-1">
                          <Checkbox
                            id={`pop-proj-${pid}`}
                            checked={selectedProjectIds.includes(pid)}
                            onCheckedChange={() => handleProjectFilterToggle(pid)}
                          />
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                          <label htmlFor={`pop-proj-${pid}`} className="text-sm cursor-pointer truncate">
                            {getProjectName(pid) || 'Unknown'}
                          </label>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="p-5 pb-0 flex-grow overflow-visible">
            <FullCalendar {...calendarOptions} />
          </div>
        </div>
      </Card>
      ) : (
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                {([
                  ['title', 'Title'],
                  ['start', 'Date'],
                  ['category', 'Category'],
                  ['status', 'Status'],
                ] as const).map(([field, label]) => (
                  <th
                    key={field}
                    className="text-left text-xs font-medium text-muted-foreground px-4 py-3 cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleTableSort(field)}
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <ArrowUpDown className={cn("h-3 w-3", tableSortField === field ? "text-foreground" : "opacity-30")} />
                    </div>
                  </th>
                ))}
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Project</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filteredTableEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No events found</td>
                </tr>
              ) : (
                filteredTableEvents.map(evt => {
                  const project = allProjects.find(p => p.id === evt.projectId)
                  const startDate = evt.start?.toDate?.()
                  return (
                    <tr
                      key={evt.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => openEventFromTable(evt)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {evt.imageUrl && (
                            <img src={evt.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium">{evt.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {startDate ? startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        {!evt.allDay && startDate && (
                          <span className="ml-1 text-xs opacity-60">{startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("h-2 w-2 rounded-full", CATEGORY_DOT_COLORS[evt.category])} />
                          <span className="text-xs">{CATEGORY_LABELS[evt.category]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("h-2 w-2 rounded-full", STATUS_DOT_COLORS[evt.status])} />
                          <span className="text-xs">{STATUS_LABELS[evt.status]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {project?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={e => { e.stopPropagation(); deleteEvent(evt.id) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-b">
            <DialogTitle className="text-lg font-semibold">
              {selectedEvent ? 'Update Event' : 'Add Event'}
            </DialogTitle>
          </div>

          {/* Two-column layout */}
          <div className="flex max-h-[70vh] overflow-y-auto">
            {/* LEFT column - 3/5 */}
            <div className="w-3/5 p-6 space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="event-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Title *</Label>
                <Input
                  id="event-title"
                  placeholder="Event title..."
                  className="h-10 text-base"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</Label>
                <RichTextEditor
                  content={form.description}
                  onChange={(markdown) => setForm({ ...form, description: markdown })}
                  placeholder="Event description..."
                  minHeight="180px"
                />
              </div>

            </div>

            {/* RIGHT column - 2/5 */}
            <div className="w-2/5 bg-muted/10 border-l p-6 space-y-5">
              {/* Schedule */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Schedule</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="all-day" className="text-xs cursor-pointer text-muted-foreground">All Day</Label>
                    <Switch
                      id="all-day"
                      checked={form.allDay}
                      onCheckedChange={(checked) => setForm({ ...form, allDay: checked })}
                    />
                  </div>
                </div>

                {/* Start & End in same row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase">Start</span>
                    <div className="relative">
                      <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="date"
                        className="pl-8 h-9 text-xs [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
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
                        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          type="time"
                          className="pl-8 h-9 text-xs [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          value={form.startTime}
                          onChange={e => setForm({ ...form, startTime: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase">End</span>
                    <div className="relative">
                      <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="date"
                        className="pl-8 h-9 text-xs [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        value={form.endDate}
                        min={form.startDate}
                        onChange={e => setForm({ ...form, endDate: e.target.value })}
                      />
                    </div>
                    {!form.allDay && (
                      <div className="relative">
                        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          type="time"
                          className="pl-8 h-9 text-xs [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          value={form.endTime}
                          onChange={e => setForm({ ...form, endTime: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</Label>
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
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</Label>
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

              {/* Project Select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project</Label>
                <Select value={form.projectId || '_none'} onValueChange={(v) => setForm({ ...form, projectId: v === '_none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {parentProjects.map(parent => {
                      const subs = subProjectsByParent[parent.id] || []
                      return (
                        <React.Fragment key={parent.id}>
                          <SelectItem value={parent.id}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color || '#8b5cf6' }} />
                              {parent.name}
                            </span>
                          </SelectItem>
                          {subs.map(sub => (
                            <SelectItem key={sub.id} value={sub.id}>
                              <span className="flex items-center gap-2 pl-4">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || '#8b5cf6' }} />
                                {sub.name}
                              </span>
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Image Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <ImagePlus className="h-3.5 w-3.5" />
                  Image
                </Label>
                {(form.imageUrl || form.imageFile) ? (
                  <div className="space-y-2">
                    <div
                      className="relative rounded-lg overflow-hidden border bg-muted/20 cursor-pointer h-40"
                      onClick={() => setImagePreview(form.imageFile ? URL.createObjectURL(form.imageFile) : form.imageUrl)}
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/30" id="img-loader">
                        <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                      </div>
                      <img
                        src={form.imageFile ? URL.createObjectURL(form.imageFile) : form.imageUrl}
                        alt="Event image"
                        className="w-full h-full object-contain relative z-[1]"
                        onLoad={(e) => {
                          const loader = (e.target as HTMLElement).previousElementSibling
                          if (loader) (loader as HTMLElement).style.display = 'none'
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <label className="flex-1 cursor-pointer rounded-md border px-3 py-1.5 text-xs text-center hover:bg-accent transition-colors">
                        Replace
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) setForm({ ...form, imageFile: file })
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const url = form.imageFile ? URL.createObjectURL(form.imageFile) : form.imageUrl
                          if (!url) return
                          window.open(url, '_blank')
                        }}
                        className="flex-1 rounded-md border px-3 py-1.5 text-xs flex items-center justify-center gap-1 hover:bg-accent transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, imageUrl: '', imageFile: null })}
                        className="flex-1 rounded-md border px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors bg-muted/5 hover:bg-muted/10">
                    <ImagePlus className="h-6 w-6 text-muted-foreground/40 mb-1" />
                    <span className="text-xs text-muted-foreground">Upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setForm({ ...form, imageFile: file })
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Footer bar */}
          <div className="flex items-center justify-between gap-2 px-6 py-4 border-t bg-muted/30">
            <div>
              {selectedEvent && (
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit}>
                {selectedEvent ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Event"
        description={
          selectedEvent
            ? `Are you sure you want to delete "${selectedEvent.title}"? This action cannot be undone.`
            : 'Are you sure you want to delete this event? This action cannot be undone.'
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          await handleDelete()
          setDeleteConfirmOpen(false)
        }}
      />

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
            {tooltip.event.projectId && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                <Briefcase className="h-3 w-3" />
                {getProjectName(tooltip.event.projectId)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      <Dialog open={!!imagePreview} onOpenChange={(open) => { if (!open) setImagePreview(null) }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-0 bg-transparent shadow-none overflow-hidden [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center justify-center">
            <button
              className="absolute top-2 right-2 z-10 rounded-full bg-black/50 p-2 text-white/80 hover:text-white hover:bg-black/70 transition-colors"
              onClick={() => setImagePreview(null)}
            >
              <X className="h-5 w-5" />
            </button>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Full size preview"
                className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
