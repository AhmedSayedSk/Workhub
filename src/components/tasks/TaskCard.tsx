'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Task, Feature } from '@/types'
import { statusColors } from '@/lib/utils'
import { Clock, MoreVertical, Trash2 } from 'lucide-react'

interface TaskCardProps {
  task: Task
  feature?: Feature
  onClick: () => void
  onDelete: () => void
}

export function TaskCard({ task, feature, onClick, onDelete }: TaskCardProps) {
  return (
    <Card
      className="hover:shadow-md transition-all duration-200 cursor-pointer active:shadow-lg active:scale-[1.02] select-none"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-sm line-clamp-2">{task.name}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1">
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

        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={`text-xs ${statusColors.priority[task.priority]}`}
          >
            {task.priority}
          </Badge>

          {task.estimatedHours > 0 && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {task.estimatedHours}h
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
