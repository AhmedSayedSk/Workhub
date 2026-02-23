'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useProjectFiles } from '@/hooks/useMediaLibrary'
import { useFileUpload } from '@/hooks/useFileUpload'
import { mediaFiles } from '@/lib/firestore'
import { MediaFile } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FileTypeIcon } from '@/components/media/FileTypeIcon'
import { CachedImage } from '@/components/media/CachedImage'
import { FilePreview } from '@/components/media/FilePreview'
import { FileUploadDialog } from '@/components/media/FileUploadDialog'
import { formatFileSize, formatRelativeTime } from '@/lib/utils'
import {
  Upload,
  Files,
  Download,
  Trash2,
  Eye,
  Link2Off,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/useToast'

interface ProjectAttachmentsTabProps {
  projectId: string
}

export function ProjectAttachmentsTab({ projectId }: ProjectAttachmentsTabProps) {
  const { user } = useAuth()
  const { files, loading, refetch } = useProjectFiles(projectId)
  const { uploads, isUploading, uploadFiles, cancelUpload } = useFileUpload({
    userId: user?.uid || '',
    folderId: null,
    onUploadComplete: async () => {
      // Link newly uploaded files to this project
      const recentUploads = uploads.filter((u) => u.status === 'complete')
      await refetch()
    },
  })
  const { toast } = useToast()

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null)

  const handleUpload = async (filesToUpload: File[]) => {
    await uploadFiles(filesToUpload)

    // Wait for uploads to complete and link to project
    setTimeout(async () => {
      const allFiles = await mediaFiles.getAll(user?.uid || '')
      const recentFiles = allFiles
        .filter((f) => Date.now() - f.createdAt.toMillis() < 60000)
        .slice(0, filesToUpload.length)

      for (const file of recentFiles) {
        if (!file.linkedProjects.includes(projectId)) {
          await mediaFiles.linkToProject(file.id, projectId)
        }
      }

      await refetch()
    }, 2000)
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

  const openPreview = (file: MediaFile) => {
    setSelectedFile(file)
    setIsPreviewOpen(true)
  }

  const openUnlinkDialog = (file: MediaFile) => {
    setSelectedFile(file)
    setIsUnlinkDialogOpen(true)
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
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex-shrink-0">
                  {file.category === 'image' ? (
                    <CachedImage
                      src={file.thumbnailUrl || file.url}
                      alt={file.displayName}
                      className="w-10 h-10 object-contain rounded"
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
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => openUnlinkDialog(file)}
                  >
                    <Link2Off className="h-4 w-4" />
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
    </Card>
  )
}
