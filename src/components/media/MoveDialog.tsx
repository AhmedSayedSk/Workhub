'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MediaFolder } from '@/types'
import { mediaFolders } from '@/lib/firestore'
import { Loader2, Folder, Home, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  currentFolderId: string | null
  onMove: (targetFolderId: string | null) => Promise<void>
}

export function MoveDialog({
  open,
  onOpenChange,
  userId,
  currentFolderId,
  onMove,
}: MoveDialogProps) {
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedFolder(null)
      loadFolders()
    }
  }, [open, userId])

  const loadFolders = async () => {
    setLoading(true)
    try {
      const allFolders = await mediaFolders.getAll(userId)
      setFolders(allFolders)
    } catch (error) {
      console.error('Failed to load folders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMove = async () => {
    if (selectedFolder === currentFolderId) return

    setIsSubmitting(true)
    try {
      await onMove(selectedFolder)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Build folder tree
  const buildFolderTree = (parentId: string | null = null, level = 0): React.ReactNode => {
    const children = folders.filter((f) => f.parentId === parentId)

    return children.map((folder) => (
      <div key={folder.id}>
        <div
          className={cn(
            'flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted',
            selectedFolder === folder.id && 'bg-primary/10',
            folder.id === currentFolderId && 'opacity-50 cursor-not-allowed'
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (folder.id !== currentFolderId) {
              setSelectedFolder(folder.id)
            }
          }}
        >
          <Folder className="h-4 w-4" style={{ color: folder.color }} />
          <span className="text-sm">{folder.name}</span>
          {folder.id === currentFolderId && (
            <span className="text-xs text-muted-foreground ml-auto">
              (current)
            </span>
          )}
        </div>
        {buildFolderTree(folder.id, level + 1)}
      </div>
    ))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to Folder</DialogTitle>
          <DialogDescription>
            Select a destination folder
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-64 border rounded-lg">
            <div className="p-2">
              {/* Root folder */}
              <div
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted',
                  selectedFolder === null && 'bg-primary/10',
                  currentFolderId === null && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => {
                  if (currentFolderId !== null) {
                    setSelectedFolder(null)
                  }
                }}
              >
                <Home className="h-4 w-4" />
                <span className="text-sm">Media Library (Root)</span>
                {currentFolderId === null && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    (current)
                  </span>
                )}
              </div>

              {/* Folder tree */}
              {buildFolderTree()}

              {folders.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No folders available
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={selectedFolder === currentFolderId || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move Here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
