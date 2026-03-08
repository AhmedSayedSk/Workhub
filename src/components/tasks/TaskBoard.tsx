'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Task, TaskStatus, TaskType, Priority, Feature, TaskInput, Member } from '@/types'
import { Timestamp } from 'firebase/firestore'
import { taskTypeLabels } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'
import { Plus, Loader2, Bot, UserX } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { Switch } from '@/components/ui/switch'
import { TaskCard } from './TaskCard'
import { useSubtaskCounts } from '@/hooks/useTasks'
import { useCommentCounts } from '@/hooks/useComments'
import { AssigneeSelect } from '@/components/members/AssigneeSelect'

function getDoneDayLabel(task: Task): string {
  const date = task.doneAt?.toDate?.() ?? task.createdAt?.toDate?.()
  if (!date) return 'Unknown'
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d, yyyy')
}

/** Extracted so its form state doesn't re-render the entire board */
function CreateTaskDialog({
  open,
  onOpenChange,
  status,
  features,
  selectedFeatureId,
  allMembers,
  projectId,
  onCreateTask,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: TaskStatus
  features: Feature[]
  selectedFeatureId?: string | null
  allMembers?: Member[]
  projectId: string
  onCreateTask: (task: TaskInput) => Promise<void>
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Name is separate state so typing doesn't re-render the heavy RichTextEditor
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('task')
  const [priority, setPriority] = useState<Priority>('medium')
  const [featureId, setFeatureId] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [skipAutoAssign, setSkipAutoAssign] = useState(true)

  const handleDescriptionChange = useCallback((md: string) => {
    setDescription(md)
  }, [])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setTaskType('task')
      setPriority('medium')
      setFeatureId(selectedFeatureId || '')
      setEstimatedHours('')
      setDeadline(null)
      setAssigneeIds([])
      setSkipAutoAssign(true)
    }
  }, [open, selectedFeatureId])

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await onCreateTask({
        name,
        description,
        featureId,
        projectId,
        status,
        taskType,
        priority,
        estimatedHours: parseFloat(estimatedHours) || 0,
        deadline: deadline ? Timestamp.fromDate(deadline) : null,
        assigneeIds: skipAutoAssign ? [] : assigneeIds,
        skipAutoAssign,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>Add a new task to the board</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 flex flex-col p-6 gap-4 min-h-0">
            <div className="space-y-2 shrink-0">
              <Label>Name *</Label>
              <Input
                placeholder="Task name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col flex-1 min-h-0 space-y-2">
              <Label className="shrink-0">Description</Label>
              <div className="flex-1 min-h-0 [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div>div:last-of-type]:flex-1 [&>div>div:last-of-type]:overflow-y-auto [&_.ProseMirror]:min-h-full">
                <RichTextEditor
                  content={description}
                  onChange={handleDescriptionChange}
                  placeholder="Task description..."
                  minHeight="0"
                />
              </div>
            </div>
          </div>
          <div className="w-64 shrink-0 border-l bg-muted/20 overflow-y-auto p-5 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</Label>
              <Select value={taskType} onValueChange={(value) => setTaskType(value as TaskType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(taskTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {features.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Feature</Label>
                <Select value={featureId || 'none'} onValueChange={(value) => setFeatureId(value === 'none' ? '' : value)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No feature</SelectItem>
                    {features.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deadline</Label>
              <DatePicker value={deadline} onChange={setDeadline} placeholder="No deadline" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Est. Hours</Label>
              <Input type="number" placeholder="0" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="h-9" />
            </div>
            {allMembers && allMembers.length > 0 && !skipAutoAssign && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignees</Label>
                <AssigneeSelect
                  members={allMembers}
                  selectedIds={assigneeIds}
                  onChange={setAssigneeIds}
                  trigger={
                    <Button variant="outline" size="sm" className="w-full h-9 text-xs">
                      {assigneeIds.length > 0 ? `${assigneeIds.length} assigned` : 'Assign members'}
                    </Button>
                  }
                />
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs font-medium cursor-pointer" htmlFor="skip-auto-assign">Leave unassigned</Label>
                </div>
                <Switch id="skip-auto-assign" checked={skipAutoAssign} onCheckedChange={(checked) => { setSkipAutoAssign(checked); if (checked) setAssigneeIds([]) }} />
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">Task will not be assigned to anyone. A manager can assign later.</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={isSubmitting || !name.trim()}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const columns: { id: TaskStatus; title: string; borderColor: string; headerText: string }[] = [
  { id: 'todo', title: 'To Do', borderColor: 'border-slate-300', headerText: 'text-slate-600 dark:text-slate-400' },
  { id: 'in_progress', title: 'In Progress', borderColor: 'border-blue-300', headerText: 'text-slate-600 dark:text-slate-400' },
  { id: 'review', title: 'Review', borderColor: 'border-purple-300', headerText: 'text-slate-600 dark:text-slate-400' },
  { id: 'done', title: 'Done', borderColor: 'border-green-300', headerText: 'text-slate-600 dark:text-slate-400' },
]

interface TaskBoardProps {
  tasks: Task[]
  features: Feature[]
  projectId: string
  projectName?: string
  allMembers?: Member[]
  selectedFeatureId?: string | null
  selectionMode?: boolean
  aiProcessingTaskIds?: Set<string>
  onProcessingStarted?: (taskIds: string[]) => void
  onCreateTask: (task: TaskInput) => Promise<void>
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
  onArchiveTask: (id: string) => Promise<void>
  onSetTaskWaiting?: (id: string) => Promise<void>
  onRemoveTaskWaiting?: (id: string) => Promise<void>
  onSelectTask: (task: Task) => void
  onReorderTask?: (taskId: string, newStatus: TaskStatus, newSortOrder: number) => Promise<void>
  onTaskMovedToDone?: (x: number, y: number) => void
  refreshKey?: number
}

export function TaskBoard({
  tasks,
  features,
  projectId,
  projectName,
  allMembers,
  selectedFeatureId,
  selectionMode = false,
  aiProcessingTaskIds,
  onProcessingStarted,
  onCreateTask,
  onUpdateTask,
  onArchiveTask,
  onSetTaskWaiting,
  onRemoveTaskWaiting,
  onSelectTask,
  onReorderTask,
  onTaskMovedToDone,
  refreshKey,
}: TaskBoardProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createColumn, setCreateColumn] = useState<TaskStatus>('todo')

  // Selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)
  const columnRefs = useRef<Record<TaskStatus, HTMLDivElement | null>>({} as Record<TaskStatus, HTMLDivElement | null>)

  // Fetch subtask counts and comment counts for all tasks
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks])
  const { counts: subtaskCounts } = useSubtaskCounts(taskIds, refreshKey)
  const { counts: commentCounts } = useCommentCounts(taskIds, 'task', refreshKey)

  // Build membersMap for efficient lookup
  const membersMap = useMemo(() => {
    const map = new Map<string, Member>()
    allMembers?.forEach((m) => map.set(m.id, m))
    return map
  }, [allMembers])

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  // Clear selection when selection mode is turned off
  useEffect(() => {
    if (!selectionMode) {
      setSelectedTaskIds(new Set())
    }
  }, [selectionMode])

  const handleProcessTasks = () => {
    if (selectedTaskIds.size === 0) return
    onProcessingStarted?.(Array.from(selectedTaskIds))
    setSelectedTaskIds(new Set())
  }

  const tasksByStatus = useMemo(() => columns.reduce((acc, col) => {
    acc[col.id] = tasks
      .filter((t) => t.status === col.id)
      .sort((a, b) => {
        if (col.id === 'done') {
          const doneA = a.doneAt?.toMillis?.() ?? a.sortOrder ?? a.createdAt?.toMillis?.() ?? 0
          const doneB = b.doneAt?.toMillis?.() ?? b.sortOrder ?? b.createdAt?.toMillis?.() ?? 0
          return doneB - doneA
        }
        const orderA = a.sortOrder ?? a.createdAt?.toMillis?.() ?? 0
        const orderB = b.sortOrder ?? b.createdAt?.toMillis?.() ?? 0
        return orderA - orderB
      })
    return acc
  }, {} as Record<TaskStatus, Task[]>), [tasks])

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.setData('taskId', taskId)
    e.dataTransfer.effectAllowed = 'move'

    // Add a slight delay to allow the drag image to be captured
    requestAnimationFrame(() => {
      const element = e.target as HTMLElement
      element.style.opacity = '0.5'
    })
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null)
    setDragOverColumn(null)
    setDropIndicatorIndex(null)
    const element = e.target as HTMLElement
    element.style.opacity = '1'
  }

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (dragOverColumn !== status) {
      setDragOverColumn(status)
    }

    // Calculate drop position based on mouse Y position
    const columnTasks = tasksByStatus[status] || []
    const columnRef = columnRefs.current[status]
    if (!columnRef) return

    const taskElements = columnRef.querySelectorAll('[data-task-id]')
    const mouseY = e.clientY

    let newIndex = columnTasks.length // Default to end

    for (let i = 0; i < taskElements.length; i++) {
      const rect = taskElements[i].getBoundingClientRect()
      const midY = rect.top + rect.height / 2

      if (mouseY < midY) {
        newIndex = i
        break
      }
    }

    // Don't show indicator at same position as dragged task
    const draggedTask = tasks.find(t => t.id === draggedTaskId)
    if (draggedTask?.status === status) {
      const draggedIndex = columnTasks.findIndex(t => t.id === draggedTaskId)
      if (newIndex === draggedIndex || newIndex === draggedIndex + 1) {
        setDropIndicatorIndex(null)
        return
      }
    }

    setDropIndicatorIndex(newIndex)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null)
      setDropIndicatorIndex(null)
    }
  }

  const calculateNewSortOrder = (columnTasks: Task[], dropIndex: number, draggedTaskId: string): number => {
    // Filter out the dragged task from calculations
    const otherTasks = columnTasks.filter(t => t.id !== draggedTaskId)

    if (otherTasks.length === 0) {
      return Date.now()
    }

    // Adjust index if we filtered out the dragged task that was before this position
    const draggedIndex = columnTasks.findIndex(t => t.id === draggedTaskId)
    let adjustedIndex = dropIndex
    if (draggedIndex >= 0 && draggedIndex < dropIndex) {
      adjustedIndex = dropIndex - 1
    }

    if (adjustedIndex === 0) {
      // Inserting at the beginning
      const firstOrder = otherTasks[0]?.sortOrder ?? otherTasks[0]?.createdAt?.toMillis?.() ?? Date.now()
      return firstOrder - 1000
    } else if (adjustedIndex >= otherTasks.length) {
      // Inserting at the end
      const lastOrder = otherTasks[otherTasks.length - 1]?.sortOrder ??
                        otherTasks[otherTasks.length - 1]?.createdAt?.toMillis?.() ?? Date.now()
      return lastOrder + 1000
    } else {
      // Inserting between two tasks
      const prevOrder = otherTasks[adjustedIndex - 1]?.sortOrder ??
                        otherTasks[adjustedIndex - 1]?.createdAt?.toMillis?.() ?? Date.now()
      const nextOrder = otherTasks[adjustedIndex]?.sortOrder ??
                        otherTasks[adjustedIndex]?.createdAt?.toMillis?.() ?? Date.now()
      return Math.floor((prevOrder + nextOrder) / 2)
    }
  }

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    const task = tasks.find((t) => t.id === taskId)
    const targetIndex = dropIndicatorIndex

    setDraggedTaskId(null)
    setDragOverColumn(null)
    setDropIndicatorIndex(null)

    if (!task) return

    const columnTasks = tasksByStatus[status] || []
    const statusChanged = task.status !== status
    const hasDropPosition = targetIndex !== null

    // Calculate new sort order
    const newSortOrder = hasDropPosition
      ? calculateNewSortOrder(columnTasks, targetIndex, taskId)
      : (columnTasks.length > 0
          ? (columnTasks[columnTasks.length - 1]?.sortOrder ?? Date.now()) + 1000
          : Date.now())

    // Only update if something changed
    if (statusChanged || hasDropPosition) {
      if (status === 'done' && task.status !== 'done') {
        onTaskMovedToDone?.(e.clientX, e.clientY)
      }

      if (onReorderTask) {
        await onReorderTask(taskId, status, newSortOrder)
      } else {
        await onUpdateTask(taskId, { status, sortOrder: newSortOrder } as Partial<Task>)
      }
    }
  }

  const openCreateDialog = (status: TaskStatus) => {
    setCreateColumn(status)
    setIsCreateOpen(true)
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 h-full">
        {columns.map((column) => {
          const isOver = dragOverColumn === column.id
          const columnTasks = tasksByStatus[column.id] || []

          return (
            <div
              key={column.id}
              className={cn(
                'rounded-lg overflow-hidden transition-all duration-200 border-2 border-dashed flex flex-col',
                isOver
                  ? `bg-primary/5 ${column.borderColor} scale-[1.02]`
                  : 'bg-muted/50 border-transparent',
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className={cn('font-bold', column.headerText)}>{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnTasks.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openCreateDialog(column.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Column Content */}
              <div
                ref={(el) => { columnRefs.current[column.id] = el }}
                className="space-y-3 flex-1 min-h-0 overflow-y-auto py-3"
              >
                {columnTasks.map((task, index) => {
                  const isDragging = draggedTaskId === task.id
                  const showIndicatorBefore = isOver && dropIndicatorIndex === index

                  // Day separator for done column
                  let daySeparator: React.ReactNode = null
                  if (column.id === 'done') {
                    const dayLabel = getDoneDayLabel(task)
                    const prevTask = index > 0 ? columnTasks[index - 1] : null
                    const prevDayLabel = prevTask ? getDoneDayLabel(prevTask) : null
                    if (dayLabel !== prevDayLabel) {
                      daySeparator = (
                        <div className={cn('flex items-center gap-2 px-2 pb-2', index > 0 ? 'pt-2' : '')}>
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{dayLabel}</span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      )
                    }
                  }

                  return (
                    <div key={task.id}>
                      {daySeparator}
                      {/* Drop indicator before this task */}
                      {showIndicatorBefore && (
                        <div className="h-1 bg-primary rounded-full mb-3 animate-pulse" />
                      )}
                      <div
                        data-task-id={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          'transition-all duration-200 cursor-grab active:cursor-grabbing',
                          isDragging && 'opacity-50 scale-95 rotate-2',
                        )}
                      >
                        <TaskCard
                          task={task}
                          feature={features.find((f) => f.id === task.featureId)}
                          subtaskCount={subtaskCounts[task.id]}
                          commentCount={commentCounts[task.id] || 0}
                          assignees={(task.assigneeIds || []).map((id) => membersMap.get(id)).filter(Boolean) as Member[]}
                          allMembers={allMembers}
                          isAiProcessing={aiProcessingTaskIds?.has(task.id)}
                          onAssigneeChange={allMembers ? (ids) => onUpdateTask(task.id, { assigneeIds: ids }) : undefined}
                          onClick={() => selectionMode ? toggleTaskSelection(task.id) : onSelectTask(task)}
                          onArchive={() => onArchiveTask(task.id)}
                          onSetWaiting={onSetTaskWaiting ? () => onSetTaskWaiting(task.id) : undefined}
                          onRemoveWaiting={onRemoveTaskWaiting ? () => onRemoveTaskWaiting(task.id) : undefined}
                          selectable={selectionMode}
                          selected={selectedTaskIds.has(task.id)}
                          onSelectionToggle={toggleTaskSelection}
                        />
                      </div>
                    </div>
                  )
                })}

                {/* Drop indicator at end */}
                {isOver && dropIndicatorIndex !== null && dropIndicatorIndex >= columnTasks.length && (
                  <div className="h-1 bg-primary rounded-full animate-pulse" />
                )}

                {columnTasks.length === 0 && !isOver && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No tasks
                  </div>
                )}

                {/* Empty state when dragging over empty column */}
                {columnTasks.length === 0 && isOver && (
                  <div className="text-center py-8 text-primary text-sm font-medium animate-pulse">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Floating Action Bar - shown when tasks are selected */}
      {selectionMode && selectedTaskIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border bg-card shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <span className="text-sm font-medium text-muted-foreground">
            {selectedTaskIds.size} task{selectedTaskIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="w-px h-6 bg-border" />
          <Button
            size="sm"
            onClick={handleProcessTasks}
            className="gap-2"
          >
            <Bot className="h-4 w-4" />
            Process with Claude
          </Button>
        </div>
      )}

      {/* Create Task Dialog — extracted component so form state doesn't re-render the board */}
      <CreateTaskDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        status={createColumn}
        features={features}
        selectedFeatureId={selectedFeatureId}
        allMembers={allMembers}
        projectId={projectId}
        onCreateTask={onCreateTask}
      />
    </>
  )
}
