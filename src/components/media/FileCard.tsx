'use client'

import { useState } from 'react'
import { MediaFile, MediaViewMode } from '@/types'
import { FileTypeIcon } from './FileTypeIcon'
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  MoreVertical,
  Download,
  Trash2,
  Edit,
  Link,
  FolderInput,
  Eye,
} from 'lucide-react'
import { CachedImage } from './CachedImage'

interface FileCardProps {
  file: MediaFile
  viewMode: MediaViewMode
  isSelected: boolean
  onSelect: (selected: boolean) => void
  onClick: () => void
  onPreview: () => void
  onRename: () => void
  onDelete: () => void
  onMove: () => void
  onLink: () => void
}

export function FileCard({
  file,
  viewMode,
  isSelected,
  onSelect,
  onClick,
  onPreview,
  onRename,
  onDelete,
  onMove,
  onLink,
}: FileCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(file.url, '_blank')
  }

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPreview()
  }

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRename()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  const handleMove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMove()
  }

  const handleLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    onLink()
  }

  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          'flex items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors',
          isSelected && 'bg-primary/5'
        )}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          onClick={(e) => e.stopPropagation()}
        />

        <div className="flex-shrink-0">
          {file.category === 'image' && file.thumbnailUrl ? (
            <CachedImage
              src={file.thumbnailUrl || file.url}
              alt={file.displayName}
              className="w-10 h-10 object-cover rounded"
            />
          ) : (
            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded">
              <FileTypeIcon
                category={file.category}
                mimeType={file.mimeType}
                size="md"
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{file.displayName}</p>
          <p className="text-sm text-muted-foreground">
            {formatFileSize(file.size)}
          </p>
        </div>

        <div className="text-sm text-muted-foreground hidden md:block">
          {formatRelativeTime(file.createdAt)}
        </div>

        <div
          className={cn(
            'flex items-center gap-1 transition-opacity',
            isHovered || isSelected ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePreview}
          >
            <Eye className="h-4 w-4" />
          </Button>

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
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={handlePreview}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleRename}>
                <Edit className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleMove}>
                <FolderInput className="mr-2 h-4 w-4" />
                Move
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLink}>
                <Link className="mr-2 h-4 w-4" />
                Link to Project/Task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
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
      className={cn(
        'group relative rounded-lg border bg-card hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all cursor-pointer',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'absolute top-2 left-2 z-10 transition-opacity',
          isHovered || isSelected ? 'opacity-100' : 'opacity-0'
        )}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="bg-background/80 backdrop-blur-sm"
        />
      </div>

      {/* Menu */}
      <div
        className={cn(
          'absolute top-2 right-2 z-10 transition-opacity',
          isHovered || isSelected ? 'opacity-100' : 'opacity-0'
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
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={handlePreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleRename}>
              <Edit className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMove}>
              <FolderInput className="mr-2 h-4 w-4" />
              Move
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLink}>
              <Link className="mr-2 h-4 w-4" />
              Link to Project/Task
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Thumbnail/Icon */}
      <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
        {file.category === 'image' ? (
          <CachedImage
            src={file.thumbnailUrl || file.url}
            alt={file.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileTypeIcon
              category={file.category}
              mimeType={file.mimeType}
              size="lg"
            />
          </div>
        )}
      </div>

      {/* File info */}
      <div className="p-3">
        <p className="font-medium truncate text-sm">{file.displayName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatFileSize(file.size)}
        </p>
      </div>
    </div>
  )
}
