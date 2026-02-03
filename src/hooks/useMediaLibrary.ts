'use client'

import { useState, useEffect, useCallback } from 'react'
import { mediaFiles, mediaFolders, mediaBatch } from '@/lib/firestore'
import { deleteFile } from '@/lib/storage'
import {
  MediaFile,
  MediaFolder,
  MediaFolderInput,
  MediaSortBy,
  MediaSortOrder,
  FileCategory,
} from '@/types'
import { useToast } from './useToast'

interface UseMediaLibraryOptions {
  userId: string
  folderId?: string | null
}

export function useMediaLibrary({ userId, folderId }: UseMediaLibraryOptions) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [breadcrumb, setBreadcrumb] = useState<MediaFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<MediaSortBy>('date')
  const [sortOrder, setSortOrder] = useState<MediaSortOrder>('desc')
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | null>(null)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const [filesResult, foldersResult, pathResult] = await Promise.all([
        mediaFiles.getAll(userId, folderId),
        mediaFolders.getChildren(userId, folderId ?? null),
        folderId ? mediaFolders.getPath(folderId) : Promise.resolve([]),
      ])

      setFiles(filesResult)
      setFolders(foldersResult)
      setBreadcrumb(pathResult)
    } catch (error) {
      console.error('Failed to load media library:', error)
      toast({
        title: 'Error',
        description: 'Failed to load media library',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [userId, folderId, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter and sort files
  const filteredFiles = useCallback(() => {
    let result = [...files]

    // Apply search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(
        (file) =>
          file.name.toLowerCase().includes(lowerSearch) ||
          file.displayName.toLowerCase().includes(lowerSearch)
      )
    }

    // Apply category filter
    if (categoryFilter) {
      result = result.filter((file) => file.category === categoryFilter)
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName)
          break
        case 'date':
          comparison = a.createdAt.toMillis() - b.createdAt.toMillis()
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'type':
          comparison = a.category.localeCompare(b.category)
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [files, searchTerm, categoryFilter, sortBy, sortOrder])

  // Folder CRUD operations
  const createFolder = async (input: Omit<MediaFolderInput, 'createdBy'>) => {
    try {
      const id = await mediaFolders.create({
        ...input,
        createdBy: userId,
      })
      await fetchData()
      toast({ title: 'Success', description: 'Folder created', variant: 'success' })
      return id
    } catch {
      toast({ title: 'Error', description: 'Failed to create folder', variant: 'destructive' })
      throw new Error('Failed to create folder')
    }
  }

  const updateFolder = async (id: string, input: Partial<MediaFolderInput>) => {
    try {
      await mediaFolders.update(id, input)
      await fetchData()
      toast({ title: 'Success', description: 'Folder updated', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update folder', variant: 'destructive' })
      throw new Error('Failed to update folder')
    }
  }

  const deleteFolder = async (id: string) => {
    try {
      const storagePaths = await mediaBatch.deleteFolderCascade(id, userId)

      // Delete files from storage
      await Promise.all(storagePaths.map((path) => deleteFile(path).catch(() => {})))

      await fetchData()
      toast({ title: 'Success', description: 'Folder deleted', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete folder', variant: 'destructive' })
      throw new Error('Failed to delete folder')
    }
  }

  // File operations
  const deleteMediaFile = async (id: string) => {
    try {
      const file = await mediaFiles.getById(id)
      if (file) {
        await deleteFile(file.storagePath).catch(() => {})
        await mediaFiles.delete(id)
      }
      await fetchData()
      toast({ title: 'Success', description: 'File deleted', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete file', variant: 'destructive' })
      throw new Error('Failed to delete file')
    }
  }

  const deleteMultipleFiles = async (ids: string[]) => {
    try {
      const storagePaths = await mediaBatch.deleteFiles(ids)

      // Delete files from storage
      await Promise.all(storagePaths.map((path) => deleteFile(path).catch(() => {})))

      await fetchData()
      toast({
        title: 'Success',
        description: `${ids.length} file(s) deleted`,
        variant: 'success',
      })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete files', variant: 'destructive' })
      throw new Error('Failed to delete files')
    }
  }

  const moveFilesToFolder = async (fileIds: string[], targetFolderId: string | null) => {
    try {
      await mediaBatch.moveFiles(fileIds, targetFolderId)
      await fetchData()
      toast({
        title: 'Success',
        description: `${fileIds.length} file(s) moved`,
        variant: 'success',
      })
    } catch {
      toast({ title: 'Error', description: 'Failed to move files', variant: 'destructive' })
      throw new Error('Failed to move files')
    }
  }

  const renameFile = async (id: string, newDisplayName: string) => {
    try {
      await mediaFiles.update(id, { displayName: newDisplayName })
      await fetchData()
      toast({ title: 'Success', description: 'File renamed', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to rename file', variant: 'destructive' })
      throw new Error('Failed to rename file')
    }
  }

  // Linking operations
  const linkFileToProject = async (fileId: string, projectId: string) => {
    try {
      await mediaFiles.linkToProject(fileId, projectId)
      await fetchData()
      toast({ title: 'Success', description: 'File linked to project', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to link file', variant: 'destructive' })
      throw new Error('Failed to link file')
    }
  }

  const unlinkFileFromProject = async (fileId: string, projectId: string) => {
    try {
      await mediaFiles.unlinkFromProject(fileId, projectId)
      await fetchData()
      toast({ title: 'Success', description: 'File unlinked from project', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to unlink file', variant: 'destructive' })
      throw new Error('Failed to unlink file')
    }
  }

  const linkFileToTask = async (fileId: string, taskId: string) => {
    try {
      await mediaFiles.linkToTask(fileId, taskId)
      await fetchData()
      toast({ title: 'Success', description: 'File linked to task', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to link file', variant: 'destructive' })
      throw new Error('Failed to link file')
    }
  }

  const unlinkFileFromTask = async (fileId: string, taskId: string) => {
    try {
      await mediaFiles.unlinkFromTask(fileId, taskId)
      await fetchData()
      toast({ title: 'Success', description: 'File unlinked from task', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to unlink file', variant: 'destructive' })
      throw new Error('Failed to unlink file')
    }
  }

  return {
    files: filteredFiles(),
    folders,
    breadcrumb,
    loading,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    categoryFilter,
    setCategoryFilter,
    refetch: fetchData,
    createFolder,
    updateFolder,
    deleteFolder,
    deleteFile: deleteMediaFile,
    deleteMultipleFiles,
    moveFilesToFolder,
    renameFile,
    linkFileToProject,
    unlinkFileFromProject,
    linkFileToTask,
    unlinkFileFromTask,
  }
}

// Hook for fetching files linked to a project
export function useProjectFiles(projectId: string) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true)
      const result = await mediaFiles.getByProject(projectId)
      setFiles(result)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load project files',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  return {
    files,
    loading,
    refetch: fetchFiles,
  }
}

// Hook for fetching files linked to a task
export function useTaskFiles(taskId: string) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true)
      const result = await mediaFiles.getByTask(taskId)
      setFiles(result)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load task files',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [taskId, toast])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  return {
    files,
    loading,
    refetch: fetchFiles,
  }
}
