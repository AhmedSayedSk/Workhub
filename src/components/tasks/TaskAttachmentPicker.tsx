'use client'

import { useMemo, useState } from 'react'
import { Check, Search, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileThumbnail } from '@/components/media/FileThumbnail'
import { useProjectFiles } from '@/hooks/useMediaLibrary'
import { mediaFiles } from '@/lib/firestore'
import { useToast } from '@/hooks/useToast'
import { formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface TaskAttachmentPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  taskId: string
  alreadyLinkedFileIds: string[]
  onLinked: () => void
}

export function TaskAttachmentPicker({
  open,
  onOpenChange,
  projectId,
  taskId,
  alreadyLinkedFileIds,
  onLinked,
}: TaskAttachmentPickerProps) {
  const { files, loading } = useProjectFiles(projectId)
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLinking, setIsLinking] = useState(false)

  const linkedSet = useMemo(() => new Set(alreadyLinkedFileIds), [alreadyLinkedFileIds])

  const visibleFiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return files
      .filter((f) => !linkedSet.has(f.id))
      .filter((f) => (q ? f.displayName.toLowerCase().includes(q) : true))
  }, [files, linkedSet, query])

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return
    setIsLinking(true)
    try {
      await Promise.all(
        Array.from(selectedIds).map((fileId) => mediaFiles.linkToTask(fileId, taskId)),
      )
      toast({
        description: `${selectedIds.size} file${selectedIds.size === 1 ? '' : 's'} attached`,
        variant: 'success',
      })
      onLinked()
      setSelectedIds(new Set())
      setQuery('')
      onOpenChange(false)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to attach files',
        variant: 'destructive',
      })
    } finally {
      setIsLinking(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedIds(new Set())
      setQuery('')
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attach from Project Files</DialogTitle>
          <DialogDescription>
            Select one or more files already attached to this project to link to this task.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="pl-9"
          />
        </div>

        <div className="max-h-96 overflow-y-auto -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : visibleFiles.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {files.length === 0
                ? 'This project has no attachments yet. Upload files in the Project Attachments tab first.'
                : query
                  ? 'No files match your search.'
                  : 'All project files are already attached to this task.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visibleFiles.map((file) => {
                const isSelected = selectedIds.has(file.id)
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => toggle(file.id)}
                    className={cn(
                      'relative group rounded-lg border overflow-hidden text-left transition-colors',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="aspect-square flex items-center justify-center bg-muted/30">
                      <FileThumbnail
                        fileName={file.name}
                        displayName={file.displayName}
                        category={file.category}
                        mimeType={file.mimeType}
                        url={file.url}
                        thumbnailUrl={file.thumbnailUrl}
                        variant="grid"
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-medium truncate">{file.displayName}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLinking}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0 || isLinking}>
              {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Attach {selectedIds.size > 0 ? `${selectedIds.size} file${selectedIds.size === 1 ? '' : 's'}` : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
