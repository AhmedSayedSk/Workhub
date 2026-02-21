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
import { Checkbox } from '@/components/ui/checkbox'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { DatePicker } from '@/components/ui/date-picker'
import { Task, Subtask, TaskStatus, TaskType, Priority, Feature, TaskInput, CommentParentType, Member } from '@/types'
import { Timestamp } from 'firebase/firestore'
import { taskTypeLabels, formatDuration } from '@/lib/utils'
import { useSubtasks } from '@/hooks/useTasks'
import { useComments } from '@/hooks/useComments'
import { useTimerStore } from '@/store/timerStore'
import { useAuth } from '@/hooks/useAuth'
import {
  Plus,
  Play,
  Loader2,
  Trash2,
  Edit,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Send,
  Archive,
  Hourglass,
  Pause,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import { AssigneeSelect } from '@/components/members/AssigneeSelect'

function formatRelativeTime(timestamp: { toDate: () => Date }): string {
  const now = new Date()
  const date = timestamp.toDate()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Comment section used for both tasks and subtasks
function CommentSection({
  parentId,
  parentType,
  onDataChanged,
}: {
  parentId: string
  parentType: CommentParentType
  onDataChanged?: () => void
}) {
  const { user } = useAuth()
  const { comments, addComment, deleteComment } = useComments(parentId, parentType)
  const [newComment, setNewComment] = useState('')

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return
    await addComment({
      parentId,
      parentType,
      text: newComment.trim(),
      authorId: user.uid,
      authorName: user.displayName || user.email || 'Unknown',
    })
    setNewComment('')
    onDataChanged?.()
  }

  return (
    <div className="space-y-2">
      {/* Comment list */}
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 text-sm group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs">{comment.authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{comment.text}</p>
              </div>
              {user && comment.authorId === user.uid && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => { deleteComment(comment.id); onDataChanged?.() }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Comment input */}
      <div className="flex items-end gap-2">
        <Textarea
          placeholder="Add a comment... (Shift+Enter for new line)"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          className="flex-1 min-h-[40px] max-h-[160px] text-sm resize-none"
          rows={2}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          disabled={!newComment.trim()}
          onClick={handleSubmit}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Extracted SubtaskItem so each subtask can manage its own comment state
function SubtaskItem({
  subtask,
  taskId,
  projectId,
  projectName,
  taskName,
  onStatusChange,
  onDelete,
  onDataChanged,
}: {
  subtask: Subtask
  taskId: string
  projectId: string
  projectName: string
  taskName: string
  onStatusChange: (subtask: Subtask, checked: boolean) => void
  onDelete: (id: string) => void
  onDataChanged?: () => void
}) {
  const { isRunning, startTimer, currentSubtaskId } = useTimerStore()
  const { comments } = useComments(subtask.id, 'subtask')
  const [commentsOpen, setCommentsOpen] = useState(false)

  const handleStartTimer = () => {
    if (isRunning) return
    startTimer({
      subtaskId: subtask.id,
      taskId,
      projectId,
      taskName: `${taskName} - ${subtask.name}`,
      projectName,
    })
  }

  const commentCount = comments.length

  return (
    <div className="p-3 rounded-lg border hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Checkbox
            checked={subtask.status === 'done'}
            onCheckedChange={(checked) =>
              onStatusChange(subtask, checked as boolean)
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
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${commentCount > 0 ? 'text-blue-500' : 'text-muted-foreground'}`}
            onClick={() => setCommentsOpen(!commentsOpen)}
            title={commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? 's' : ''}` : 'Add comment'}
          >
            <div className="relative">
              <MessageSquare className="h-4 w-4" />
              {commentCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-medium">
                  {commentCount}
                </span>
              )}
            </div>
          </Button>
          {subtask.status !== 'done' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartTimer}
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
            onClick={() => onDelete(subtask.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Subtask Comments (expandable) */}
      {commentsOpen && (
        <div className="mt-2 pl-8">
          <CommentSection parentId={subtask.id} parentType="subtask" onDataChanged={onDataChanged} />
        </div>
      )}
    </div>
  )
}

interface TaskDetailProps {
  task: Task | null
  projectId: string
  projectName: string
  features: Feature[]
  allMembers?: Member[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
  onArchiveTask: (id: string) => Promise<void>
  onSetTaskWaiting?: (id: string) => Promise<void>
  onRemoveTaskWaiting?: (id: string) => Promise<void>
  onDataChanged?: () => void
}

export function TaskDetail({
  task,
  projectId,
  projectName,
  features,
  allMembers,
  open,
  onOpenChange,
  onUpdateTask,
  onArchiveTask,
  onSetTaskWaiting,
  onRemoveTaskWaiting,
  onDataChanged,
}: TaskDetailProps) {
  const { subtasks, createSubtask, updateSubtask, deleteSubtask } = useSubtasks(
    task?.id
  )

  const [isEditing, setIsEditing] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
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
        name: task.name || '',
        description: task.description || '',
        featureId: task.featureId || '',
        taskType: task.taskType || 'task',
        priority: task.priority || 'medium',
        estimatedHours: (task.estimatedHours || 0).toString(),
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
      onDataChanged?.()
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
    onDataChanged?.()
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
    })
    setIsEditing(false)
  }

  const handleArchive = async () => {
    await onArchiveTask(task.id)
    setIsArchiving(false)
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
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b shrink-0">
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
                <DialogTitle className="text-xl cursor-pointer" onDoubleClick={() => setIsEditing(true)}>{task.name}</DialogTitle>
              )}
            </DialogHeader>
            <div className="flex items-center gap-2 mt-3">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
            {/* Waiting Banner */}
            {task.waiting && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
                <Hourglass className="h-4 w-4 shrink-0" />
                <span className="font-medium">This task is waiting</span>
                {task.waitingReason && (
                  <span className="text-amber-600 dark:text-amber-400">— {task.waitingReason}</span>
                )}
              </div>
            )}
          </div>

          {/* Two-column layout */}
          <div className="flex flex-1 min-h-0">
            {/* Left Column - Main content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Description */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                {isEditing ? (
                  <RichTextEditor
                    content={editForm.description}
                    onChange={(md) =>
                      setEditForm({ ...editForm, description: md })
                    }
                    placeholder="Add a description..."
                    minHeight="120px"
                  />
                ) : task.description ? (
                  <div onDoubleClick={() => setIsEditing(true)} className="cursor-pointer">
                    <RichTextEditor
                      content={task.description}
                      editable={false}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground cursor-pointer" onDoubleClick={() => setIsEditing(true)}>No description</p>
                )}
              </div>

              <Separator />

              {/* Task Comments */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Comments</Label>
                <CommentSection parentId={task.id} parentType="task" onDataChanged={onDataChanged} />
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
                      <SubtaskItem
                        key={subtask.id}
                        subtask={subtask}
                        taskId={task.id}
                        projectId={task.projectId}
                        projectName={projectName}
                        taskName={task.name}
                        onStatusChange={handleSubtaskStatusChange}
                        onDelete={(id) => { deleteSubtask(id); onDataChanged?.() }}
                        onDataChanged={onDataChanged}
                      />
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

            {/* Right Column - Properties sidebar */}
            <div className="w-72 shrink-0 border-l bg-muted/20 overflow-y-auto p-5 space-y-5">
              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                <Select
                  value={task.status}
                  onValueChange={(value) =>
                    onUpdateTask(task.id, { status: value as TaskStatus })
                  }
                >
                  <SelectTrigger className="h-9">
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

              {/* Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</Label>
                {isEditing ? (
                  <Select
                    value={editForm.taskType}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, taskType: value as TaskType })
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
                ) : (
                  <Select
                    value={task.taskType || 'task'}
                    onValueChange={(value) =>
                      onUpdateTask(task.id, { taskType: value as TaskType })
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
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</Label>
                {isEditing ? (
                  <Select
                    value={editForm.priority}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, priority: value as Priority })
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
                ) : (
                  <Select
                    value={task.priority}
                    onValueChange={(value) =>
                      onUpdateTask(task.id, { priority: value as Priority })
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
                )}
              </div>

              {/* Assignees */}
              {allMembers && allMembers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignees</Label>
                  <div className="space-y-2">
                    {(task.assigneeIds || []).length > 0 && (
                      <div className="space-y-1.5">
                        {(task.assigneeIds || []).map((id) => {
                          const member = allMembers.find((m) => m.id === id)
                          if (!member) return null
                          return (
                            <div key={id} className="flex items-center gap-2">
                              <MemberAvatar member={member} size="sm" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{member.name}</div>
                                {member.role && <div className="text-xs text-muted-foreground truncate">{member.role}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <AssigneeSelect
                      members={allMembers}
                      selectedIds={task.assigneeIds || []}
                      onChange={(ids) => onUpdateTask(task.id, { assigneeIds: ids })}
                      trigger={
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          {(task.assigneeIds || []).length > 0 ? 'Edit Assignees' : 'Assign Members'}
                        </Button>
                      }
                    />
                  </div>
                </div>
              )}

              {/* Feature */}
              {features.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Feature</Label>
                  {isEditing ? (
                    <Select
                      value={editForm.featureId || 'none'}
                      onValueChange={(value) =>
                        setEditForm({
                          ...editForm,
                          featureId: value === 'none' ? '' : value,
                        })
                      }
                    >
                      <SelectTrigger className="h-9">
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
                  ) : (
                    <Select
                      value={task.featureId || 'none'}
                      onValueChange={(value) =>
                        onUpdateTask(task.id, { featureId: value === 'none' ? '' : value })
                      }
                    >
                      <SelectTrigger className="h-9">
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
                  )}
                </div>
              )}

              {/* Deadline */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deadline</Label>
                <DatePicker
                  value={task.deadline ? task.deadline.toDate() : null}
                  onChange={(date) =>
                    onUpdateTask(task.id, { deadline: date ? Timestamp.fromDate(date) : null })
                  }
                  placeholder="No deadline"
                  className="h-9"
                />
              </div>

              {/* Waiting Info */}
              {task.waiting && task.waitingAt && (
                <>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs">
                    <Hourglass className="h-3.5 w-3.5 shrink-0" />
                    <span>Waiting since {formatRelativeTime(task.waitingAt)}</span>
                  </div>
                </>
              )}

              <Separator />

              {/* Time Info */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated</span>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          key="est-edit"
                          type="number"
                          value={editForm.estimatedHours}
                          onChange={(e) =>
                            setEditForm({ ...editForm, estimatedHours: e.target.value })
                          }
                          className="w-16 h-7 text-sm text-right"
                          placeholder="0"
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Input
                          key="est-view"
                          type="number"
                          defaultValue={task.estimatedHours || ''}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            if (val !== task.estimatedHours) {
                              onUpdateTask(task.id, { estimatedHours: val })
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          }}
                          className="w-16 h-7 text-sm text-right"
                          placeholder="0"
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Actual</span>
                    <span className="text-sm font-medium">
                      {task.actualHours > 0
                        ? formatDuration(task.actualHours * 60)
                        : '-'}
                    </span>
                  </div>
                  {totalEstimatedMinutes > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Subtasks Est.</span>
                      <span className="text-sm font-medium">
                        {formatDuration(totalEstimatedMinutes)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</Label>
                {task.waiting ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
                    onClick={() => onRemoveTaskWaiting?.(task.id)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                    onClick={() => onSetTaskWaiting?.(task.id)}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Set Waiting
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:bg-destructive/10"
                  onClick={() => setIsArchiving(true)}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Archive
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isArchiving} onOpenChange={setIsArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive &quot;{task.name}&quot;? You can restore
              it later from the archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
