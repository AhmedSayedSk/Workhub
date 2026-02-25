'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { UploadProgress } from '@/types'
import { formatFileSize } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Upload, X, CheckCircle2, AlertCircle, Loader2, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileWithDisplayName } from '@/hooks/useFileUpload'

interface FileUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  uploads: UploadProgress[]
  isUploading: boolean
  onUpload: (files: FileWithDisplayName[]) => void
  onCancel: (fileId: string) => void
  requireDisplayName?: boolean
}

export function FileUploadDialog({
  open,
  onOpenChange,
  uploads,
  isUploading,
  onUpload,
  onCancel,
  requireDisplayName = false,
}: FileUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileNames, setFileNames] = useState<Record<number, string>>({})
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isUploading) {
      setIsDragActive(true)
    }
  }, [isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (isUploading) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      setSelectedFiles((prev) => {
        const startIdx = prev.length
        const newNames: Record<number, string> = {}
        files.forEach((f, i) => {
          newNames[startIdx + i] = f.name.replace(/\.[^/.]+$/, '')
        })
        setFileNames((prevNames) => ({ ...prevNames, ...newNames }))
        return [...prev, ...files]
      })
    }
  }, [isUploading])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length > 0) {
      setSelectedFiles((prev) => {
        const startIdx = prev.length
        const newNames: Record<number, string> = {}
        files.forEach((f, i) => {
          newNames[startIdx + i] = f.name.replace(/\.[^/.]+$/, '')
        })
        setFileNames((prevNames) => ({ ...prevNames, ...newNames }))
        return [...prev, ...files]
      })
    }
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleClick = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click()
    }
  }, [isUploading])

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    setFileNames((prev) => {
      const next: Record<number, string> = {}
      Object.entries(prev).forEach(([key, value]) => {
        const k = Number(key)
        if (k < index) next[k] = value
        else if (k > index) next[k - 1] = value
      })
      return next
    })
  }

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      const items: FileWithDisplayName[] = selectedFiles.map((file, i) => ({
        file,
        displayName: fileNames[i] || file.name.replace(/\.[^/.]+$/, ''),
      }))
      onUpload(items)
      setSelectedFiles([])
      setFileNames({})
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFiles([])
      setFileNames({})
      onOpenChange(false)
    }
  }

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
      default:
        return <File className="h-4 w-4 text-muted-foreground" />
    }
  }

  const hasUploads = uploads.length > 0
  const hasSelectedFiles = selectedFiles.length > 0
  const hasEmptyNames = requireDisplayName && selectedFiles.some((_, i) => !fileNames[i]?.trim())

  // Check if all uploads are complete (no pending/uploading/processing)
  const allUploadsFinished = hasUploads && uploads.every(
    (u) => u.status === 'complete' || u.status === 'error'
  )

  // Auto-close dialog after uploads complete
  useEffect(() => {
    if (allUploadsFinished && !isUploading) {
      const timer = setTimeout(() => {
        setSelectedFiles([])
        setFileNames({})
        onOpenChange(false)
      }, 1000) // Close after 1 second to show completion status briefly

      return () => clearTimeout(timer)
    }
  }, [allUploadsFinished, isUploading, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Drag and drop files or click to browse
          </DialogDescription>
        </DialogHeader>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Dropzone */}
        {!hasUploads && (
          <div
            onClick={handleClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50',
              isUploading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-primary font-medium">Drop files here</p>
            ) : (
              <>
                <p className="font-medium">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Maximum file size: 50 MB
                </p>
              </>
            )}
          </div>
        )}

        {/* Selected files (before upload) */}
        {hasSelectedFiles && !hasUploads && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <p className="text-sm font-medium">
              Selected files ({selectedFiles.length})
            </p>
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-2 rounded-lg border bg-muted/50"
              >
                <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {requireDisplayName ? (
                    <Input
                      value={fileNames[index] || ''}
                      onChange={(e) =>
                        setFileNames((prev) => ({ ...prev, [index]: e.target.value }))
                      }
                      placeholder="File name (required)"
                      className="h-7 text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium truncate">{file.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {file.name} · {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeSelectedFile(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Upload progress */}
        {hasUploads && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {uploads.map((upload) => (
              <div
                key={upload.fileId}
                className="flex items-center gap-3 p-2 rounded-lg border"
              >
                <div className="flex-shrink-0">
                  {getStatusIcon(upload.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">
                      {upload.fileName}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {upload.status === 'complete'
                        ? 'Complete'
                        : upload.status === 'error'
                        ? 'Failed'
                        : upload.status === 'processing'
                        ? 'Processing'
                        : `${Math.round(upload.progress)}%`}
                    </span>
                  </div>
                  {(upload.status === 'uploading' ||
                    upload.status === 'pending') && (
                    <Progress value={upload.progress} className="h-1" />
                  )}
                  {upload.error && (
                    <p className="text-xs text-destructive mt-1">
                      {upload.error}
                    </p>
                  )}
                </div>
                {upload.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onCancel(upload.fileId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Cancel'}
          </Button>
          {!hasUploads && (
            <Button
              onClick={handleUpload}
              disabled={!hasSelectedFiles || isUploading || hasEmptyNames}
            >
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload {hasSelectedFiles ? `(${selectedFiles.length})` : ''}
            </Button>
          )}
          {hasUploads && !isUploading && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
