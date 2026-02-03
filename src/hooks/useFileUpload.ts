'use client'

import { useState, useCallback } from 'react'
import { mediaFiles } from '@/lib/firestore'
import {
  uploadFile,
  generateStoragePath,
  getFileCategory,
  validateFileSize,
  MAX_FILE_SIZE,
} from '@/lib/storage'
import { UploadProgress } from '@/types'
import { useToast } from './useToast'
import { generateId, formatFileSize } from '@/lib/utils'

interface UseFileUploadOptions {
  userId: string
  folderId?: string | null
  onUploadComplete?: () => void
}

export function useFileUpload({ userId, folderId, onUploadComplete }: UseFileUploadOptions) {
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const updateUploadProgress = useCallback(
    (fileId: string, updates: Partial<UploadProgress>) => {
      setUploads((prev) =>
        prev.map((upload) =>
          upload.fileId === fileId ? { ...upload, ...updates } : upload
        )
      )
    },
    []
  )

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!userId) {
        toast({
          title: 'Error',
          description: 'You must be logged in to upload files',
          variant: 'destructive',
        })
        return
      }

      // Validate file sizes
      const invalidFiles = files.filter((file) => !validateFileSize(file))
      if (invalidFiles.length > 0) {
        toast({
          title: 'Error',
          description: `Some files exceed the maximum size of ${formatFileSize(MAX_FILE_SIZE)}`,
          variant: 'destructive',
        })
        return
      }

      setIsUploading(true)

      // Initialize upload progress for all files
      const initialUploads: UploadProgress[] = files.map((file) => ({
        fileId: generateId(),
        fileName: file.name,
        progress: 0,
        status: 'pending',
      }))

      setUploads(initialUploads)

      const uploadPromises = files.map(async (file, index) => {
        const fileId = initialUploads[index].fileId
        const storagePath = generateStoragePath(userId, fileId, file.name)

        try {
          // Start uploading
          updateUploadProgress(fileId, { status: 'uploading' })

          const result = await uploadFile(file, storagePath, {
            onProgress: (progress) => {
              updateUploadProgress(fileId, { progress })
            },
          })

          // Processing - create Firestore document
          updateUploadProgress(fileId, { status: 'processing', progress: 100 })

          await mediaFiles.create({
            name: file.name,
            displayName: file.name,
            mimeType: file.type || 'application/octet-stream',
            category: getFileCategory(file.type),
            size: result.size, // Use optimized size
            url: result.url,
            storagePath,
            thumbnailUrl: null,
            folderId: folderId ?? null,
            linkedProjects: [],
            linkedTasks: [],
            uploadedBy: userId,
            metadata: {},
          })

          updateUploadProgress(fileId, { status: 'complete' })
          return { success: true, fileName: file.name }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Upload failed'
          updateUploadProgress(fileId, { status: 'error', error: errorMessage })
          return { success: false, fileName: file.name, error: errorMessage }
        }
      })

      const results = await Promise.all(uploadPromises)

      const successCount = results.filter((r) => r.success).length
      const failCount = results.filter((r) => !r.success).length

      if (successCount > 0) {
        toast({
          title: 'Upload Complete',
          description:
            failCount > 0
              ? `${successCount} file(s) uploaded, ${failCount} failed`
              : `${successCount} file(s) uploaded successfully`,
          variant: failCount > 0 ? 'default' : 'success',
        })
      } else if (failCount > 0) {
        toast({
          title: 'Upload Failed',
          description: 'All files failed to upload',
          variant: 'destructive',
        })
      }

      setIsUploading(false)
      onUploadComplete?.()

      // Clear completed uploads after a delay
      setTimeout(() => {
        setUploads((prev) =>
          prev.filter((upload) => upload.status !== 'complete')
        )
      }, 3000)
    },
    [userId, folderId, toast, updateUploadProgress, onUploadComplete]
  )

  const cancelUpload = useCallback((fileId: string) => {
    setUploads((prev) => prev.filter((upload) => upload.fileId !== fileId))
  }, [])

  const clearUploads = useCallback(() => {
    setUploads([])
  }, [])

  return {
    uploads,
    isUploading,
    uploadFiles,
    cancelUpload,
    clearUploads,
  }
}
