'use client'

import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useProjectFiles } from '@/hooks/useMediaLibrary'
import { useFileUpload } from '@/hooks/useFileUpload'
import { projects, mediaFolders, mediaFiles } from '@/lib/firestore'
import { deleteFile } from '@/lib/storage'
import { MediaFile } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileThumbnail } from '@/components/media/FileThumbnail'
import { FilePreview } from '@/components/media/FilePreview'
import { FileUploadDialog } from '@/components/media/FileUploadDialog'
import { formatFileSize, formatRelativeTime } from '@/lib/utils'
import {
  Upload,
  Files,
  Download,
  Eye,
  Link2Off,
  Trash2,
  ExternalLink,
  LayoutGrid,
  List,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { FileWithDisplayName } from '@/hooks/useFileUpload'

interface ProjectAttachmentsTabProps {
  projectId: string
  projectName: string
}

export function ProjectAttachmentsTab({ projectId, projectName }: ProjectAttachmentsTabProps) {
  const { user } = useAuth()
  const { files, loading, refetch } = useProjectFiles(projectId)
  const { toast } = useToast()

  const [folderId, setFolderId] = useState<string | null>(null)
  const folderResolvedRef = useRef(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null)

  const { uploads, isUploading, uploadFiles, cancelUpload } = useFileUpload({
    userId: user?.uid || '',
    folderId,
    linkedProjectId: projectId,
    onUploadComplete: refetch,
  })

  const ensureProjectFolder = useCallback(async (): Promise<string | null> => {
    if (folderId) return folderId

    try {
      const project = await projects.getById(projectId)
      if (project?.mediaFolderId) {
        setFolderId(project.mediaFolderId)
        folderResolvedRef.current = true
        return project.mediaFolderId
      }

      // Create new folder for this project
      const newFolderId = await mediaFolders.create({
        name: projectName,
        parentId: null,
        color: '#6366f1',
        createdBy: user?.uid || '',
      })

      // Save to project
      await projects.update(projectId, { mediaFolderId: newFolderId })
      setFolderId(newFolderId)
      folderResolvedRef.current = true
      return newFolderId
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create project folder',
        variant: 'destructive',
      })
      return null
    }
  }, [folderId, projectId, projectName, user?.uid, toast])

  const handleUpload = async (items: FileWithDisplayName[]) => {
    // Ensure folder exists before uploading
    await ensureProjectFolder()
    await uploadFiles(items)
  }

  const handleUnlink = async () => {
    if (!selectedFile) return

    try {
      await mediaFiles.unlinkFromProject(selectedFile.id, projectId)
      await refetch()
      toast({
        description: 'File unlinked from project',
        variant: 'success',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink file',
        variant: 'destructive',
      })
    }

    setSelectedFile(null)
    setIsUnlinkDialogOpen(false)
  }

  const handleDelete = async () => {
    if (!selectedFile) return

    try {
      await deleteFile(selectedFile.storagePath).catch(() => {})
      await mediaFiles.delete(selectedFile.id)
      await refetch()
      toast({
        description: 'File deleted permanently',
        variant: 'success',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      })
    }

    setSelectedFile(null)
    setIsDeleteDialogOpen(false)
  }

  const openPreview = (file: MediaFile) => {
    setSelectedFile(file)
    setIsPreviewOpen(true)
  }

  const openUnlinkDialog = (file: MediaFile) => {
    setSelectedFile(file)
    setIsUnlinkDialogOpen(true)
  }

  const openDeleteDialog = (file: MediaFile) => {
    setSelectedFile(file)
    setIsDeleteDialogOpen(true)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Attachments</CardTitle>
            <CardDescription>
              Files linked to this project
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            {files.length > 0 && (
              <div className="flex items-center border rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-r-none',
                    viewMode === 'grid' && 'bg-muted'
                  )}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-l-none',
                    viewMode === 'list' && 'bg-muted'
                  )}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Link href="/media">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Media Library
              </Button>
            </Link>
            <Button size="sm" onClick={() => setIsUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Files className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No files attached to this project</p>
            <p className="text-sm mt-1">
              Upload files or link existing files from the Media Library
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* List view */
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <FileThumbnail
                  fileName={file.name}
                  displayName={file.displayName}
                  category={file.category}
                  mimeType={file.mimeType}
                  url={file.url}
                  thumbnailUrl={file.thumbnailUrl}
                  variant="list"
                />

                <div className="flex-1 min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="font-medium truncate">{file.displayName}</p>
                    </TooltipTrigger>
                    <TooltipContent>{file.displayName}</TooltipContent>
                  </Tooltip>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)} · {formatRelativeTime(file.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openPreview(file)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(file.url, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openUnlinkDialog(file)}
                    title="Unlink from project"
                  >
                    <Link2Off className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => openDeleteDialog(file)}
                    title="Delete permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="group relative rounded-lg border hover:bg-muted/50 transition-colors overflow-hidden"
              >
                {/* Thumbnail / Icon */}
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

                {/* Info */}
                <div className="p-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm font-medium truncate">{file.displayName}</p>
                    </TooltipTrigger>
                    <TooltipContent>{file.displayName}</TooltipContent>
                  </Tooltip>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {/* Hover actions */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 shadow-sm"
                    onClick={() => window.open(file.url, '_blank')}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 shadow-sm"
                    onClick={() => openUnlinkDialog(file)}
                    title="Unlink from project"
                  >
                    <Link2Off className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 shadow-sm text-destructive hover:text-destructive"
                    onClick={() => openDeleteDialog(file)}
                    title="Delete permanently"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Upload Dialog */}
      <FileUploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        uploads={uploads}
        isUploading={isUploading}
        onUpload={handleUpload}
        onCancel={cancelUpload}
        requireDisplayName
      />

      {/* Preview Dialog */}
      <FilePreview
        file={selectedFile}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />

      {/* Unlink Confirmation */}
      <ConfirmDialog
        open={isUnlinkDialogOpen}
        onOpenChange={setIsUnlinkDialogOpen}
        title="Unlink File"
        description={`Are you sure you want to unlink "${selectedFile?.displayName}" from this project? The file will remain in your Media Library.`}
        confirmLabel="Unlink"
        onConfirm={handleUnlink}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete File"
        description={`Are you sure you want to permanently delete "${selectedFile?.displayName}"? This will remove it from the Media Library and cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </Card>
  )
}
