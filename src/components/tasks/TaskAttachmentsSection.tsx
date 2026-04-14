'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Eye,
  Download,
  Link2Off,
  Paperclip,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileThumbnail } from '@/components/media/FileThumbnail'
import { FilePreview } from '@/components/media/FilePreview'
import { TaskAttachmentPicker } from '@/components/tasks/TaskAttachmentPicker'
import { useTaskFiles } from '@/hooks/useMediaLibrary'
import { mediaFiles } from '@/lib/firestore'
import { useToast } from '@/hooks/useToast'
import { formatFileSize } from '@/lib/utils'
import type { MediaFile } from '@/types'

interface TaskAttachmentsSectionProps {
  taskId: string
  projectId: string
}

export function TaskAttachmentsSection({ taskId, projectId }: TaskAttachmentsSectionProps) {
  const { files, loading, refetch } = useTaskFiles(taskId)
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(true)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<MediaFile | null>(null)

  const openPreview = (file: MediaFile) => {
    setPreviewFile(file)
    setIsPreviewOpen(true)
  }

  const handleUnlink = async () => {
    if (!unlinkTarget) return
    try {
      await mediaFiles.unlinkFromTask(unlinkTarget.id, taskId)
      toast({ description: 'File unlinked from task', variant: 'success' })
      refetch()
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink file',
        variant: 'destructive',
      })
    } finally {
      setUnlinkTarget(null)
    }
  }

  return (
    <div className="space-y-3">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors flex-1">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium">Attachments</h4>
              <span className="text-sm text-muted-foreground">
                {loading ? '' : `${files.length} attached`}
              </span>
            </button>
          </CollapsibleTrigger>
          <Button size="sm" variant="outline" onClick={() => setIsPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Attach from project
          </Button>
        </div>

        <CollapsibleContent className="pt-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
              No files attached. Click <span className="font-medium">Attach from project</span> to link existing project files.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group relative rounded-lg border hover:bg-muted/50 transition-colors overflow-hidden"
                >
                  <div
                    className="aspect-square flex items-center justify-center bg-muted/30 cursor-pointer"
                    onClick={() => openPreview(file)}
                  >
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm font-medium truncate">{file.displayName}</p>
                      </TooltipTrigger>
                      <TooltipContent>{file.displayName}</TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 shadow-sm"
                      onClick={() => openPreview(file)}
                      title="Preview"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 shadow-sm"
                      onClick={() => window.open(file.url, '_blank')}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 shadow-sm"
                      onClick={() => setUnlinkTarget(file)}
                      title="Unlink from task"
                    >
                      <Link2Off className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <TaskAttachmentPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        projectId={projectId}
        taskId={taskId}
        alreadyLinkedFileIds={files.map((f) => f.id)}
        onLinked={refetch}
      />

      <FilePreview
        file={previewFile}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />

      <ConfirmDialog
        open={unlinkTarget !== null}
        onOpenChange={(open) => !open && setUnlinkTarget(null)}
        title="Unlink File"
        description={`Remove "${unlinkTarget?.displayName}" from this task? The file stays on the project.`}
        confirmLabel="Unlink"
        onConfirm={handleUnlink}
      />
    </div>
  )
}
