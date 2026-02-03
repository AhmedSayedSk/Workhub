'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Task, TaskStatus, Priority, Feature, TaskInput } from '@/types'
import { cn } from '@/lib/utils'
import { Plus, Loader2 } from 'lucide-react'
import { TaskCard } from './TaskCard'

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'border-slate-400' },
  { id: 'in_progress', title: 'In Progress', color: 'border-blue-400' },
  { id: 'review', title: 'Review', color: 'border-purple-400' },
  { id: 'done', title: 'Done', color: 'border-green-400' },
]

interface TaskBoardProps {
  tasks: Task[]
  features: Feature[]
  projectId: string
  selectedFeatureId?: string | null
  onCreateTask: (task: TaskInput) => Promise<void>
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
  onDeleteTask: (id: string) => Promise<void>
  onSelectTask: (task: Task) => void
}

export function TaskBoard({
  tasks,
  features,
  projectId,
  selectedFeatureId,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onSelectTask,
}: TaskBoardProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createColumn, setCreateColumn] = useState<TaskStatus>('todo')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    featureId: '',
    priority: 'medium' as Priority,
    estimatedHours: '',
  })

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)

  // Pre-select feature when dialog opens if a feature is selected
  useEffect(() => {
    if (isCreateOpen && selectedFeatureId) {
      setFormData((prev) => ({ ...prev, featureId: selectedFeatureId }))
    }
  }, [isCreateOpen, selectedFeatureId])

  const tasksByStatus = columns.reduce((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id)
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
        priority: formData.priority,
        estimatedHours: parseFloat(formData.estimatedHours) || 0,
      })
      setFormData({
        name: '',
        description: '',
        featureId: selectedFeatureId || '',
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
    const element = e.target as HTMLElement
    element.style.opacity = '1'
  }

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (dragOverColumn !== status) {
      setDragOverColumn(status)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    const task = tasks.find((t) => t.id === taskId)

    setDraggedTaskId(null)
    setDragOverColumn(null)

    if (task && task.status !== status) {
      await onUpdateTask(taskId, { status })
    }
  }

  const openCreateDialog = (status: TaskStatus) => {
    setCreateColumn(status)
    setFormData({
      name: '',
      description: '',
      featureId: selectedFeatureId || '',
      priority: 'medium',
      estimatedHours: '',
    })
    setIsCreateOpen(true)
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[500px]">
        {columns.map((column) => {
          const isOver = dragOverColumn === column.id
          const isDraggingFromThis = draggedTaskId && tasksByStatus[column.id]?.some(t => t.id === draggedTaskId)

          return (
            <div
              key={column.id}
              className={cn(
                'rounded-lg p-4 transition-all duration-200 border-2 border-dashed',
                isOver && !isDraggingFromThis
                  ? `bg-primary/5 ${column.color} scale-[1.02]`
                  : 'bg-muted/50 border-transparent',
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {tasksByStatus[column.id]?.length || 0}
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

              <div className="space-y-3 min-h-[100px]">
                {/* Drop indicator at top */}
                {isOver && !isDraggingFromThis && (
                  <div className="h-1 bg-primary/50 rounded-full animate-pulse" />
                )}

                {tasksByStatus[column.id]?.map((task) => {
                  const isDragging = draggedTaskId === task.id

                  return (
                    <div
                      key={task.id}
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
                        onClick={() => onSelectTask(task)}
                        onDelete={() => onDeleteTask(task.id)}
                      />
                    </div>
                  )
                })}

                {tasksByStatus[column.id]?.length === 0 && !isOver && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No tasks
                  </div>
                )}

                {/* Empty state when dragging over empty column */}
                {tasksByStatus[column.id]?.length === 0 && isOver && (
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>Add a new task to the board</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Task description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Feature</Label>
                <Select
                  value={formData.featureId || 'none'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, featureId: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select feature" />
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
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value as Priority })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estimated Time</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.estimatedHours}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedHours: e.target.value })
                  }
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">hours</span>
              </div>
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
