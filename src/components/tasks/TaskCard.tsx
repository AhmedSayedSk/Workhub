'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Task, Feature, TaskType, Priority } from '@/types'
import {
  Clock,
  MoreVertical,
  Trash2,
  AlertOctagon,
  ChevronUp,
  Minus,
  ChevronDown,
} from 'lucide-react'

const taskTypeBorderColors: Record<TaskType, string> = {
  task: '#64748b',       // slate-500
  bug: '#ef4444',        // red-500
  feature: '#a855f7',    // purple-500
  improvement: '#06b6d4', // cyan-500
  documentation: '#f59e0b', // amber-500
  research: '#6366f1',   // indigo-500
}

const priorityIcons: Record<Priority, { icon: typeof AlertOctagon; color: string }> = {
  critical: { icon: AlertOctagon, color: 'text-red-500 opacity-100' },
  high: { icon: ChevronUp, color: 'text-orange-500 opacity-80' },
  medium: { icon: Minus, color: 'text-yellow-500 opacity-60' },
  low: { icon: ChevronDown, color: 'text-blue-500 opacity-40' },
}

interface TaskCardProps {
  task: Task
  feature?: Feature
  onClick: () => void
  onDelete: () => void
}

export function TaskCard({ task, feature, onClick, onDelete }: TaskCardProps) {
  const taskType = task.taskType || 'task'
  const borderColor = taskTypeBorderColors[taskType]
  const PriorityIcon = priorityIcons[task.priority]?.icon || Minus
  const priorityColor = priorityIcons[task.priority]?.color || 'text-muted-foreground'

  return (
    <Card
      className="hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all duration-200 cursor-pointer active:shadow-lg active:scale-[1.02] select-none border-l-[3px] rounded-none relative"
      style={{ borderLeftColor: borderColor }}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-2">{task.name}</h4>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {task.estimatedHours > 0 && (
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {task.estimatedHours}h
          </div>
        )}

        {/* Priority icon - absolute bottom right */}
        <div
          className={`absolute bottom-0 right-2 h-6 w-6 flex items-center justify-center ${priorityColor}`}
          title={task.priority}
        >
          <PriorityIcon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}
