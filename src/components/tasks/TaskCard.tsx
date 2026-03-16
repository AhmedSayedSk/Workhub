'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Task, Feature, Priority, TaskType, Member } from '@/types'
import { taskTypeLabels } from '@/lib/utils'
import {
  Clock,
  MoreVertical,
  Archive,
  CheckSquare,
  MessageSquare,
  Hourglass,
  Pause,
  Play,
  UserPlus,
  Bot,
} from 'lucide-react'
import { MemberAvatarGroup } from '@/components/members/MemberAvatarGroup'
import { AssigneeSelect } from '@/components/members/AssigneeSelect'
import { getIconComponent } from '@/lib/task-icons'
import { format } from 'date-fns'

const priorityBorderColors: Record<Priority, string | null> = {
  high: 'rgba(249, 115, 22, 0.6)',       // orange-500 at 60%
  medium: 'rgba(234, 179, 8, 0.5)',      // yellow-500 at 50%
  low: null,                              // no color
}

const taskTypeBadgeColors: Record<TaskType, string> = {
  task: '#64748b',       // slate-500
  bug: '#ef4444',        // red-500
  feature: '#a855f7',    // purple-500
  improvement: '#06b6d4', // cyan-500
  documentation: '#f59e0b', // amber-500
  research: '#6366f1',   // indigo-500
}

interface TaskCardProps {
  task: Task
  feature?: Feature
  subtaskCount?: { total: number; completed: number }
  commentCount?: number
  assignees?: Member[]
  allMembers?: Member[]
  isAiProcessing?: boolean
  onAssigneeChange?: (ids: string[]) => void
  onClick: () => void
  onArchive: () => void
  onSetWaiting?: () => void
  onRemoveWaiting?: () => void
  selectable?: boolean
  selected?: boolean
  onSelectionToggle?: (taskId: string) => void
}

export function TaskCard({ task, feature, subtaskCount, commentCount, assignees, allMembers, isAiProcessing, onAssigneeChange, onClick, onArchive, onSetWaiting, onRemoveWaiting, selectable, selected, onSelectionToggle }: TaskCardProps) {
  const [assignOpen, setAssignOpen] = useState(false)
  const taskType = task.taskType || 'task'
  const priority = task.priority || 'low'
  const borderColor = priorityBorderColors[priority] || undefined
  const typeLabel = taskTypeLabels[taskType] || 'Task'
  const badgeColor = taskTypeBadgeColors[taskType] || '#64748b'

  const hasSubtasks = subtaskCount && subtaskCount.total > 0
  const hasComments = !!commentCount && commentCount > 0
  const hasAssignees = assignees && assignees.length > 0

  const createdDate = task.createdAt?.toDate?.()
  const currentYear = new Date().getFullYear()
  const isCurrentYear = createdDate?.getFullYear() === currentYear
  const formattedDate = createdDate
    ? format(createdDate, isCurrentYear ? 'MMM d' : 'MMM d, yyyy')
    : null

  const isWaiting = !!task.waiting

  return (
    <Card
      className={`group/card hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all duration-200 cursor-pointer active:shadow-lg active:scale-[1.02] select-none rounded-none border-r-0 relative ${borderColor ? 'border-l-[3px]' : ''} ${isWaiting ? 'opacity-60 border-dashed border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10' : ''} ${isAiProcessing ? 'ring-1 ring-blue-400/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-[0_0_12px_-3px_rgba(59,130,246,0.3)]' : ''}`}
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
      onClick={onClick}
    >
      {/* AI Processing badge */}
      {isAiProcessing && (
        <div className="absolute -top-2 left-3 z-10 pointer-events-none">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 shadow-sm animate-pulse">
            <Bot className="h-2.5 w-2.5" />
            <span>AI Processing</span>
          </div>
        </div>
      )}
      {/* Waiting badge */}
      {isWaiting && !isAiProcessing && (
        <div className="absolute -top-2 left-3 z-10 pointer-events-none">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 shadow-sm">
            <Hourglass className="h-2.5 w-2.5" />
            <span>Waiting</span>
          </div>
        </div>
      )}
      {/* Hover badge - task type & date */}
      <div
        className="absolute -top-2 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 z-10 pointer-events-none"
      >
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium text-white shadow-sm"
          style={{ backgroundColor: badgeColor }}
        >
          <span>{typeLabel}</span>
          {formattedDate && (
            <>
              <span className="opacity-60">•</span>
              <span className="opacity-80">{formattedDate}</span>
            </>
          )}
        </div>
      </div>
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          {/* Task icon - vertically centered */}
          {task.icon && (() => {
            const TaskIcon = getIconComponent(task.icon)
            return <TaskIcon className="h-4.5 w-4.5 shrink-0" style={{ color: taskTypeBadgeColors[taskType] }} />
          })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              {selectable && (
                <div
                  className="flex items-center mr-2 mt-0.5 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectionToggle?.(task.id)
                  }}
                >
                  <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary/60'}`}>
                    {selected && (
                      <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm line-clamp-2">{task.name}</h4>
              </div>
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 flex-shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {allMembers && onAssigneeChange && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setTimeout(() => setAssignOpen(true), 100)
                          }}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Assign
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {isWaiting ? (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveWaiting?.()
                        }}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Resume Task
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetWaiting?.()
                        }}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Set Waiting
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onArchive()
                      }}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* AssigneeSelect popover anchored to the three-dot button */}
                {allMembers && onAssigneeChange && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <AssigneeSelect
                      members={allMembers}
                      selectedIds={task.assigneeIds || []}
                      onChange={onAssigneeChange}
                      open={assignOpen}
                      onOpenChange={setAssignOpen}
                      trigger={<span className="absolute inset-0 pointer-events-none" />}
                    />
                  </div>
                )}
              </div>
            </div>

            {(task.estimatedHours > 0 || hasSubtasks || hasComments || hasAssignees) && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  {task.estimatedHours > 0 && (
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {task.estimatedHours}h
                    </div>
                  )}

                  {hasSubtasks && (
                    <div className="flex items-center" title={`${subtaskCount.completed}/${subtaskCount.total} subtasks completed`}>
                      <CheckSquare className="h-3 w-3 mr-1" />
                      <span className={subtaskCount.completed === subtaskCount.total ? 'text-green-600 dark:text-green-400' : ''}>
                        {subtaskCount.completed}/{subtaskCount.total}
                      </span>
                    </div>
                  )}

                  {hasComments && (
                    <div className="flex items-center text-blue-500" title={`${commentCount} comment${commentCount > 1 ? 's' : ''}`}>
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {commentCount}
                    </div>
                  )}
                </div>

                {/* Assignee avatars (only shown when there are assignees) */}
                {hasAssignees && (
                  <MemberAvatarGroup members={assignees} max={3} size="sm" />
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
