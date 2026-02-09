'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MediaFile } from '@/types'
import { formatFileSize, formatDate } from '@/lib/utils'
import { isPreviewable } from '@/lib/storage'
import { FileTypeIcon } from './FileTypeIcon'
import { Download, X, ExternalLink } from 'lucide-react'
import { CachedImage } from './CachedImage'

interface FilePreviewProps {
  file: MediaFile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FilePreview({ file, open, onOpenChange }: FilePreviewProps) {
  if (!file) return null

  const canPreview = isPreviewable(file.mimeType)

  const handleDownload = () => {
    window.open(file.url, '_blank')
  }

  const renderPreview = () => {
    if (!canPreview) {
      return (
        <div className="flex flex-col items-center justify-center py-16 bg-muted rounded-lg">
          <FileTypeIcon
            category={file.category}
            mimeType={file.mimeType}
            size="lg"
            className="mb-4"
          />
          <p className="text-muted-foreground">Preview not available</p>
          <Button variant="outline" className="mt-4" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download to view
          </Button>
        </div>
      )
    }

    // Image preview
    if (file.category === 'image') {
      return (
        <div className="relative bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden">
          <CachedImage
            src={file.url}
            alt={file.displayName}
            className="max-w-full max-h-[60vh] mx-auto object-contain"
          />
        </div>
      )
    }

    // Video preview
    if (file.category === 'video') {
      return (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            src={file.url}
            controls
            className="max-w-full max-h-[60vh] mx-auto"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )
    }

    // Audio preview
    if (file.category === 'audio') {
      return (
        <div className="flex flex-col items-center justify-center py-8 bg-muted rounded-lg">
          <FileTypeIcon
            category={file.category}
            mimeType={file.mimeType}
            size="lg"
            className="mb-4"
          />
          <audio src={file.url} controls className="w-full max-w-md">
            Your browser does not support the audio element.
          </audio>
        </div>
      )
    }

    // PDF preview
    if (file.mimeType === 'application/pdf') {
      return (
        <div className="relative bg-muted rounded-lg overflow-hidden h-[60vh]">
          <iframe
            src={`${file.url}#toolbar=0`}
            className="w-full h-full"
            title={file.displayName}
          />
        </div>
      )
    }

    // Fallback
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-muted rounded-lg">
        <FileTypeIcon
          category={file.category}
          mimeType={file.mimeType}
          size="lg"
          className="mb-4"
        />
        <p className="text-muted-foreground">Preview not available</p>
        <Button variant="outline" className="mt-4" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download to view
        </Button>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="truncate">{file.displayName}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(file.url, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview area */}
          {renderPreview()}

          {/* File info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
            <div>
              <p className="text-muted-foreground">Size</p>
              <p className="font-medium">{formatFileSize(file.size)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium">{file.mimeType}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Uploaded</p>
              <p className="font-medium">{formatDate(file.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Category</p>
              <p className="font-medium capitalize">{file.category}</p>
            </div>
          </div>

          {/* Linked entities */}
          {(file.linkedProjects.length > 0 || file.linkedTasks.length > 0) && (
            <div className="p-4 bg-muted/50 rounded-lg text-sm">
              <p className="text-muted-foreground mb-2">Linked to</p>
              <div className="flex flex-wrap gap-2">
                {file.linkedProjects.length > 0 && (
                  <span className="px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs">
                    {file.linkedProjects.length} project(s)
                  </span>
                )}
                {file.linkedTasks.length > 0 && (
                  <span className="px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-xs">
                    {file.linkedTasks.length} task(s)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
