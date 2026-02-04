'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Task, Subtask, TaskStatus, TaskType, Priority, Feature, TaskInput } from '@/types'
import { useMemo } from 'react'
import { statusColors, taskTypeLabels, formatDuration } from '@/lib/utils'
import { useSubtasks } from '@/hooks/useTasks'
import { useTimerStore } from '@/store/timerStore'
import {
  Plus,
  Play,
  Clock,
  Loader2,
  Trash2,
  Edit,
  Save,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// Simple markdown renderer for task descriptions
function renderDescription(text: string): React.ReactNode {
  if (!text) return null

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: { content: string; ordered: boolean; number?: number }[] = []
  let key = 0

  const processInline = (line: string): React.ReactNode => {
    // Process bold **text**
    const parts: React.ReactNode[] = []
    let remaining = line
    let partKey = 0

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
      const codeMatch = remaining.match(/`([^`]+)`/)

      const matches = [
        { match: boldMatch, type: 'bold' },
        { match: codeMatch, type: 'code' },
      ].filter(m => m.match !== null)
        .sort((a, b) => (a.match!.index || 0) - (b.match!.index || 0))

      if (matches.length === 0) {
        parts.push(remaining)
        break
      }

      const earliest = matches[0]
      const match = earliest.match!
      const before = remaining.slice(0, match.index)

      if (before) parts.push(before)

      if (earliest.type === 'bold') {
        parts.push(<strong key={partKey++} className="font-semibold">{match[1]}</strong>)
      } else if (earliest.type === 'code') {
        parts.push(<code key={partKey++} className="px-1 py-0.5 rounded bg-muted font-mono text-xs">{match[1]}</code>)
      }

      remaining = remaining.slice(match.index! + match[0].length)
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>
  }

  const flushList = () => {
    if (listItems.length > 0) {
      const isOrdered = listItems[0].ordered
      if (isOrdered) {
        elements.push(
          <ol key={key++} className="list-decimal list-inside space-y-1 my-2 text-sm">
            {listItems.map((item, i) => (
              <li key={i}>{processInline(item.content)}</li>
            ))}
          </ol>
        )
      } else {
        elements.push(
          <ul key={key++} className="list-disc list-inside space-y-1 my-2 text-sm">
            {listItems.map((item, i) => (
              <li key={i}>{processInline(item.content)}</li>
            ))}
          </ul>
        )
      }
      listItems = []
    }
  }

  lines.forEach((line) => {
    const trimmedLine = line.trim()

    // Numbered lists
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) flushList()
      listItems.push({ content: numberedMatch[2], ordered: true, number: parseInt(numberedMatch[1]) })
      return
    }

    // Bullet points
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
      if (listItems.length > 0 && listItems[0].ordered) flushList()
      const content = trimmedLine.startsWith('• ') ? trimmedLine.slice(2) : trimmedLine.slice(2)
      listItems.push({ content, ordered: false })
      return
    }

    flushList()

    if (trimmedLine === '') {
      elements.push(<div key={key++} className="h-2" />)
    } else {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed">
          {processInline(trimmedLine)}
        </p>
      )
    }
  })

  flushList()

  return <div className="space-y-1">{elements}</div>
}

interface TaskDetailProps {
  task: Task | null
  projectId: string
  projectName: string
  features: Feature[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
  onDeleteTask: (id: string) => Promise<void>
}

export function TaskDetail({
  task,
  projectId,
  projectName,
  features,
  open,
  onOpenChange,
  onUpdateTask,
  onDeleteTask,
}: TaskDetailProps) {
  const { subtasks, createSubtask, updateSubtask, deleteSubtask } = useSubtasks(
    task?.id
  )
  const { isRunning, startTimer, currentSubtaskId } = useTimerStore()

  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [subtasksExpanded, setSubtasksExpanded] = useState(false)
  const [newSubtaskName, setNewSubtaskName] = useState('')
  const [newSubtaskMinutes, setNewSubtaskMinutes] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    featureId: '',
    taskType: 'task' as TaskType,
    priority: 'medium' as Priority,
    estimatedHours: '',
  })

  // Reset edit form when task changes or modal closes
  useEffect(() => {
    if (task && open) {
      setEditForm({
        name: task.name,
        description: task.description,
        featureId: task.featureId,
        taskType: task.taskType || 'task',
        priority: task.priority,
        estimatedHours: task.estimatedHours.toString(),
      })
      setIsEditing(false)
    }
  }, [task, open])

  if (!task) return null

  const handleCreateSubtask = async () => {
    if (!newSubtaskName.trim()) return

    setIsCreating(true)
    try {
      await createSubtask({
        taskId: task.id,
        name: newSubtaskName,
        status: 'todo',
        estimatedMinutes: parseInt(newSubtaskMinutes) || 0,
      })
      setNewSubtaskName('')
      setNewSubtaskMinutes('')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSubtaskStatusChange = async (
    subtask: Subtask,
    checked: boolean
  ) => {
    await updateSubtask(subtask.id, {
      status: checked ? 'done' : 'todo',
    })
  }

  const handleStartTimer = (subtask: Subtask) => {
    if (isRunning) return

    startTimer({
      subtaskId: subtask.id,
      taskId: task.id,
      projectId: task.projectId,
      taskName: `${task.name} - ${subtask.name}`,
      projectName,
    })
  }

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) return

    await onUpdateTask(task.id, {
      name: editForm.name,
      description: editForm.description,
      featureId: editForm.featureId,
      taskType: editForm.taskType,
      priority: editForm.priority,
      estimatedHours: parseFloat(editForm.estimatedHours) || 0,
    } as Partial<TaskInput>)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    await onDeleteTask(task.id)
    setIsDeleting(false)
    onOpenChange(false)
  }

  const completedSubtasks = subtasks.filter((s) => s.status === 'done').length
  const totalSubtasks = subtasks.length
  const totalEstimatedMinutes = subtasks.reduce(
    (sum, s) => sum + (s.estimatedMinutes || 0),
    0
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-8">
            {isEditing ? (
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="text-xl font-semibold"
              />
            ) : (
              <DialogTitle className="text-xl">{task.name}</DialogTitle>
            )}
            {isEditing ? (
              <Textarea
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                placeholder="Add a description..."
                className="mt-2"
              />
            ) : task.description ? (
              <div className="text-muted-foreground mt-2">
                {renderDescription(task.description)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No description</p>
            )}
          </DialogHeader>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pb-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleting(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </>
            )}
          </div>

          <div className="space-y-6 py-4">
            {/* Status, Type and Priority */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={task.status}
                  onValueChange={(value) =>
                    onUpdateTask(task.id, { status: value as TaskStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                {isEditing ? (
                  <Select
                    value={editForm.taskType}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, taskType: value as TaskType })
                    }
                  >
                    <SelectTrigger>
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
                ) : (
                  <Select
                    value={task.taskType || 'task'}
                    onValueChange={(value) =>
                      onUpdateTask(task.id, { taskType: value as TaskType })
                    }
                  >
                    <SelectTrigger>
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
                )}
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                {isEditing ? (
                  <Select
                    value={editForm.priority}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, priority: value as Priority })
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
                ) : (
                  <Select
                    value={task.priority}
                    onValueChange={(value) =>
                      onUpdateTask(task.id, { priority: value as Priority })
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
                )}
              </div>
            </div>

            {/* Feature Selection (Edit Mode) */}
            {isEditing && (
              <div className="space-y-2">
                <Label>Feature</Label>
                <Select
                  value={editForm.featureId || 'none'}
                  onValueChange={(value) =>
                    setEditForm({
                      ...editForm,
                      featureId: value === 'none' ? '' : value,
                    })
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
            )}

            {/* Time Info */}
            <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Estimated</p>
                {isEditing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={editForm.estimatedHours}
                      onChange={(e) =>
                        setEditForm({ ...editForm, estimatedHours: e.target.value })
                      }
                      className="w-20 h-8"
                      placeholder="0"
                    />
                    <span className="text-xs text-muted-foreground">hours</span>
                  </div>
                ) : (
                  <p className="font-medium">
                    {task.estimatedHours > 0
                      ? `${task.estimatedHours} hours`
                      : 'Not set'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actual</p>
                <p className="font-medium">
                  {task.actualHours > 0
                    ? formatDuration(task.actualHours * 60)
                    : '-'}
                </p>
              </div>
              {totalEstimatedMinutes > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Subtasks Est.
                  </p>
                  <p className="font-medium">
                    {formatDuration(totalEstimatedMinutes)}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Subtasks */}
            <Collapsible open={subtasksExpanded} onOpenChange={setSubtasksExpanded}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors">
                  <div className="flex items-center gap-2">
                    {subtasksExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="text-left">
                      <h4 className="font-medium">Subtasks</h4>
                      <p className="text-sm text-muted-foreground">
                        {completedSubtasks} of {totalSubtasks} completed
                      </p>
                    </div>
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-4 pt-4">
                {/* Add Subtask */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a subtask..."
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateSubtask()
                      }
                    }}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="mins"
                    value={newSubtaskMinutes}
                    onChange={(e) => setNewSubtaskMinutes(e.target.value)}
                    className="w-20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateSubtask()
                      }
                    }}
                  />
                  <Button
                    onClick={handleCreateSubtask}
                    disabled={isCreating || !newSubtaskName.trim()}
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Subtask List */}
                <div className="space-y-2">
                  {subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={subtask.status === 'done'}
                          onCheckedChange={(checked) =>
                            handleSubtaskStatusChange(subtask, checked as boolean)
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <span
                            className={
                              subtask.status === 'done'
                                ? 'line-through text-muted-foreground'
                                : ''
                            }
                          >
                            {subtask.name}
                          </span>
                          {subtask.estimatedMinutes > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({formatDuration(subtask.estimatedMinutes)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {subtask.status !== 'done' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartTimer(subtask)}
                            disabled={isRunning}
                            className={
                              currentSubtaskId === subtask.id
                                ? 'text-green-600'
                                : ''
                            }
                          >
                            <Play className="h-4 w-4 mr-1" />
                            {currentSubtaskId === subtask.id ? 'Running' : 'Start'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteSubtask(subtask.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {subtasks.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No subtasks yet. Add one above.
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{task.name}&quot;? This will also
              delete all subtasks and time entries associated with this task.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
