'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Task, Subtask, TaskStatus, Priority, SubtaskStatus } from '@/types'
import { statusColors, formatDuration } from '@/lib/utils'
import { useSubtasks } from '@/hooks/useTasks'
import { useTimerStore } from '@/store/timerStore'
import { Plus, Play, Clock, Loader2, Trash2 } from 'lucide-react'

interface TaskDetailProps {
  task: Task | null
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
}

export function TaskDetail({
  task,
  projectName,
  open,
  onOpenChange,
  onUpdateTask,
}: TaskDetailProps) {
  const { subtasks, createSubtask, updateSubtask, deleteSubtask } = useSubtasks(
    task?.id
  )
  const { isRunning, startTimer, currentSubtaskId } = useTimerStore()

  const [newSubtaskName, setNewSubtaskName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  if (!task) return null

  const handleCreateSubtask = async () => {
    if (!newSubtaskName.trim()) return

    setIsCreating(true)
    try {
      await createSubtask({
        taskId: task.id,
        name: newSubtaskName,
        status: 'todo',
        estimatedMinutes: 0,
      })
      setNewSubtaskName('')
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

  const completedSubtasks = subtasks.filter((s) => s.status === 'done').length
  const totalSubtasks = subtasks.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{task.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {task.description || 'No description'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
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
              <Label>Priority</Label>
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
            </div>
          </div>

          {/* Time Info */}
          <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Estimated</p>
              <p className="font-medium">
                {task.estimatedHours > 0
                  ? `${task.estimatedHours} hours`
                  : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Actual</p>
              <p className="font-medium">
                {task.actualHours > 0
                  ? formatDuration(task.actualHours * 60)
                  : '-'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Subtasks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Subtasks</h4>
                <p className="text-sm text-muted-foreground">
                  {completedSubtasks} of {totalSubtasks} completed
                </p>
              </div>
            </div>

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
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={subtask.status === 'done'}
                      onCheckedChange={(checked) =>
                        handleSubtaskStatusChange(subtask, checked as boolean)
                      }
                    />
                    <span
                      className={
                        subtask.status === 'done'
                          ? 'line-through text-muted-foreground'
                          : ''
                      }
                    >
                      {subtask.name}
                    </span>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
