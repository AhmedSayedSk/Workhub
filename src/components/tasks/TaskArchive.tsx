'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Task, Feature, TaskType, Priority } from '@/types'
import { RotateCcw, Trash2, AlertOctagon, ChevronUp, Minus, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const taskTypeBorderColors: Record<TaskType, string> = {
  task: '#64748b',
  bug: '#ef4444',
  feature: '#a855f7',
  improvement: '#06b6d4',
  documentation: '#f59e0b',
  research: '#6366f1',
}

const priorityIcons: Record<Priority, { icon: typeof AlertOctagon; color: string }> = {
  critical: { icon: AlertOctagon, color: 'text-red-500' },
  high: { icon: ChevronUp, color: 'text-orange-500' },
  medium: { icon: Minus, color: 'text-yellow-500' },
  low: { icon: ChevronDown, color: 'text-blue-500' },
}

interface TaskArchiveProps {
  tasks: Task[]
  features: Feature[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnarchiveTask: (id: string) => Promise<void>
  onPermanentDeleteTask: (id: string) => Promise<void>
}

export function TaskArchive({
  tasks,
  features,
  open,
  onOpenChange,
  onUnarchiveTask,
  onPermanentDeleteTask,
}: TaskArchiveProps) {
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const deletingTask = tasks.find((t) => t.id === deletingTaskId)

  const handlePermanentDelete = async () => {
    if (!deletingTaskId) return
    await onPermanentDeleteTask(deletingTaskId)
    setDeletingTaskId(null)
  }

  const getFeatureName = (featureId: string) => {
    return features.find((f) => f.id === featureId)?.name
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>Archived Tasks</DialogTitle>
            <DialogDescription>
              {tasks.length === 0
                ? 'No archived tasks'
                : `${tasks.length} archived task${tasks.length > 1 ? 's' : ''}`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              {tasks.map((task) => {
                const taskType = task.taskType || 'task'
                const borderColor = taskTypeBorderColors[taskType]
                const PriorityIcon = priorityIcons[task.priority]?.icon || Minus
                const priorityColor = priorityIcons[task.priority]?.color || 'text-muted-foreground'
                const featureName = getFeatureName(task.featureId)
                const archivedDate = task.archivedAt?.toDate?.()

                return (
                  <div
                    key={task.id}
                    className="p-4 rounded-lg border bg-card border-l-[3px]"
                    style={{ borderLeftColor: borderColor }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{task.name}</h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <PriorityIcon className={`h-3 w-3 ${priorityColor}`} />
                          <span className="capitalize">{task.priority}</span>
                          {featureName && (
                            <>
                              <span>&middot;</span>
                              <span>{featureName}</span>
                            </>
                          )}
                        </div>
                        {archivedDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Archived {formatDistanceToNow(archivedDate, { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onUnarchiveTask(task.id)}
                          title="Restore task"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingTaskId(task.id)}
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {tasks.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No archived tasks</p>
                  <p className="text-sm mt-1">Tasks you archive will appear here</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={!!deletingTaskId} onOpenChange={(open) => !open && setDeletingTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete &quot;{deletingTask?.name}&quot;?
              This will also delete all subtasks, comments, and time entries.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
