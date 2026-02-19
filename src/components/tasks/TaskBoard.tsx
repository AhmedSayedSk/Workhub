'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Task, TaskStatus, TaskType, Priority, Feature, TaskInput } from '@/types'
import { taskTypeLabels } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, Loader2 } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { useSubtaskCounts } from '@/hooks/useTasks'
import { useCommentCounts } from '@/hooks/useComments'

const columns: { id: TaskStatus; title: string; borderColor: string; headerText: string }[] = [
  { id: 'todo', title: 'To Do', borderColor: 'border-slate-300', headerText: 'text-slate-600 dark:text-slate-400' },
  { id: 'in_progress', title: 'In Progress', borderColor: 'border-blue-300', headerText: 'text-blue-600 dark:text-blue-400' },
  { id: 'review', title: 'Review', borderColor: 'border-purple-300', headerText: 'text-purple-600 dark:text-purple-400' },
  { id: 'done', title: 'Done', borderColor: 'border-green-300', headerText: 'text-green-600 dark:text-green-400' },
]

interface TaskBoardProps {
  tasks: Task[]
  features: Feature[]
  projectId: string
  selectedFeatureId?: string | null
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
  selectedFeatureId,
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    featureId: '',
    taskType: 'task' as TaskType,
    priority: 'medium' as Priority,
    estimatedHours: '',
  })

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)
  const columnRefs = useRef<Record<TaskStatus, HTMLDivElement | null>>({} as Record<TaskStatus, HTMLDivElement | null>)

  // Fetch subtask counts and comment counts for all tasks
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks])
  const { counts: subtaskCounts } = useSubtaskCounts(taskIds, refreshKey)
  const { counts: commentCounts } = useCommentCounts(taskIds, 'task', refreshKey)

  // Pre-select feature when dialog opens if a feature is selected
  useEffect(() => {
    if (isCreateOpen && selectedFeatureId) {
      setFormData((prev) => ({ ...prev, featureId: selectedFeatureId }))
    }
  }, [isCreateOpen, selectedFeatureId])

  const tasksByStatus = columns.reduce((acc, col) => {
    acc[col.id] = tasks
      .filter((t) => t.status === col.id)
      .sort((a, b) => {
        if (col.id === 'done') {
          // Done column: sort by doneAt descending (last finished first)
          const doneA = a.doneAt?.toMillis?.() ?? a.sortOrder ?? a.createdAt?.toMillis?.() ?? 0
          const doneB = b.doneAt?.toMillis?.() ?? b.sortOrder ?? b.createdAt?.toMillis?.() ?? 0
          return doneB - doneA
        }
        const orderA = a.sortOrder ?? a.createdAt?.toMillis?.() ?? 0
        const orderB = b.sortOrder ?? b.createdAt?.toMillis?.() ?? 0
        return orderA - orderB
      })
    return acc
  }, {} as Record<TaskStatus, Task[]>)

  const handleCreate = async () => {
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    try {
      await onCreateTask({
        name: formData.name,
        description: formData.description,
        featureId: formData.featureId,
        projectId,
        status: createColumn,
        taskType: formData.taskType,
        priority: formData.priority,
        estimatedHours: parseFloat(formData.estimatedHours) || 0,
      })
      setFormData({
        name: '',
        description: '',
        featureId: selectedFeatureId || '',
        taskType: 'task',
        priority: 'medium',
        estimatedHours: '',
      })
      setIsCreateOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

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
    setFormData({
      name: '',
      description: '',
      featureId: selectedFeatureId || '',
      taskType: 'task',
      priority: 'medium',
      estimatedHours: '',
    })
    setIsCreateOpen(true)
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
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
                  <h3 className={cn('font-semibold', column.headerText)}>{column.title}</h3>
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
                className="space-y-3 flex-1 min-h-0 overflow-y-auto p-4 pt-3"
              >
                {columnTasks.map((task, index) => {
                  const isDragging = draggedTaskId === task.id
                  const showIndicatorBefore = isOver && dropIndicatorIndex === index

                  return (
                    <div key={task.id}>
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
                          onClick={() => onSelectTask(task)}
                          onArchive={() => onArchiveTask(task.id)}
                          onSetWaiting={onSetTaskWaiting ? () => onSetTaskWaiting(task.id) : undefined}
                          onRemoveWaiting={onRemoveTaskWaiting ? () => onRemoveTaskWaiting(task.id) : undefined}
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

      {/* Create Task Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>Add a new task to the board</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Row 1: Task name */}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Task name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            {/* Row 2: Compact metadata grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select
                  value={formData.taskType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, taskType: value as TaskType })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(taskTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value as Priority })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Feature</Label>
                <Select
                  value={formData.featureId || 'none'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, featureId: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No feature</SelectItem>
                    {features.map((feature) => (
                      <SelectItem key={feature.id} value={feature.id}>
                        {feature.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Est. Hours</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.estimatedHours}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedHours: e.target.value })
                  }
                  className="h-9"
                />
              </div>
            </div>

            {/* Row 3: Rich text description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                content={formData.description}
                onChange={(md) => setFormData({ ...formData, description: md })}
                placeholder="Task description..."
                minHeight="120px"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
