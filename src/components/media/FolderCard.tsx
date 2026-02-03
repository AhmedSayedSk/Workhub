'use client'

import { useState } from 'react'
import { MediaFolder, MediaViewMode } from '@/types'
import { cn, formatRelativeTime } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreVertical, Trash2, Edit, Folder } from 'lucide-react'

interface FolderCardProps {
  folder: MediaFolder
  viewMode: MediaViewMode
  onClick: () => void
  onRename: () => void
  onDelete: () => void
}

export function FolderCard({
  folder,
  viewMode,
  onClick,
  onRename,
  onDelete,
}: FolderCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  if (viewMode === 'list') {
    return (
      <div
        className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex-shrink-0">
          <div
            className="w-10 h-10 flex items-center justify-center rounded"
            style={{ backgroundColor: `${folder.color}20` }}
          >
            <Folder className="h-5 w-5" style={{ color: folder.color }} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{folder.name}</p>
          <p className="text-sm text-muted-foreground">Folder</p>
        </div>

        <div className="text-sm text-muted-foreground hidden md:block">
          {formatRelativeTime(folder.createdAt)}
        </div>

        <div
          className={cn(
            'flex items-center gap-1 transition-opacity',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRename}>
                <Edit className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  // Grid view
  return (
    <div
      className="group relative rounded-lg border bg-card hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Menu */}
      <div
        className={cn(
          'absolute top-2 right-2 z-10 transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-background/80 backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRename}>
              <Edit className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Folder Icon */}
      <div
        className="aspect-square relative overflow-hidden rounded-t-lg flex items-center justify-center"
        style={{ backgroundColor: `${folder.color}15` }}
      >
        <Folder className="h-16 w-16" style={{ color: folder.color }} />
      </div>

      {/* Folder info */}
      <div className="p-3">
        <p className="font-medium truncate text-sm">{folder.name}</p>
        <p className="text-xs text-muted-foreground mt-1">Folder</p>
      </div>
    </div>
  )
}
