'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useMediaLibrary } from '@/hooks/useMediaLibrary'
import { useFileUpload } from '@/hooks/useFileUpload'
import { mediaFiles } from '@/lib/firestore'
import { MediaFile, MediaFolder, MediaViewMode, MediaSortBy, FileCategory } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  FileGrid,
  FilePreview,
  FolderDialog,
  FileUploadDialog,
  MediaBreadcrumb,
  RenameDialog,
  MoveDialog,
  FileLinkSelector,
} from '@/components/media'
import {
  Upload,
  FolderPlus,
  Grid,
  List,
  Search,
  Trash2,
  FolderInput,
  SortAsc,
  SortDesc,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MediaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const folderId = searchParams.get('folder') || undefined
  const { user } = useAuth()

  const {
    files,
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
    refetch,
    createFolder,
    updateFolder,
    deleteFolder,
    deleteFile,
    deleteMultipleFiles,
    moveFilesToFolder,
    renameFile,
    linkFileToProject,
    unlinkFileFromProject,
    linkFileToTask,
    unlinkFileFromTask,
  } = useMediaLibrary({ userId: user?.uid || '', folderId })

  const { uploads, isUploading, uploadFiles, cancelUpload } = useFileUpload({
    userId: user?.uid || '',
    folderId: folderId ?? null,
    onUploadComplete: refetch,
  })

  // View state
  const [viewMode, setViewMode] = useState<MediaViewMode>('grid')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  // Dialog states
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)

  // Selected items for operations
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | null>(null)
  const [editingFolder, setEditingFolder] = useState<MediaFolder | null>(null)

  // Navigation
  const navigateToFolder = useCallback(
    (targetFolderId: string | null) => {
      if (targetFolderId) {
        router.push(`/media?folder=${targetFolderId}`)
      } else {
        router.push('/media')
      }
      setSelectedFiles(new Set())
    },
    [router]
  )

  // File selection
  const handleFileSelect = (fileId: string, selected: boolean) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(fileId)
      } else {
        next.delete(fileId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedFiles(new Set(files.map((f) => f.id)))
  }

  const clearSelection = () => {
    setSelectedFiles(new Set())
  }

  // Folder operations
  const handleCreateFolder = async (data: { name: string; color: string }) => {
    await createFolder({
      name: data.name,
      color: data.color,
      parentId: folderId ?? null,
    })
  }

  const handleUpdateFolder = async (data: { name: string; color: string }) => {
    if (editingFolder) {
      await updateFolder(editingFolder.id, data)
    }
  }

  const handleDeleteFolder = async () => {
    if (selectedFolder) {
      await deleteFolder(selectedFolder.id)
      setSelectedFolder(null)
      setIsDeleteDialogOpen(false)
    }
  }

  // File operations
  const handleDeleteFile = async () => {
    if (selectedFile) {
      await deleteFile(selectedFile.id)
      setSelectedFile(null)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleBulkDelete = async () => {
    await deleteMultipleFiles(Array.from(selectedFiles))
    setSelectedFiles(new Set())
    setIsBulkDeleteDialogOpen(false)
  }

  const handleRenameFile = async (newName: string) => {
    if (selectedFile) {
      await renameFile(selectedFile.id, newName)
    }
  }

  const handleMoveFile = async (targetFolderId: string | null) => {
    if (selectedFiles.size > 0) {
      await moveFilesToFolder(Array.from(selectedFiles), targetFolderId)
      setSelectedFiles(new Set())
    } else if (selectedFile) {
      await moveFilesToFolder([selectedFile.id], targetFolderId)
    }
  }

  const handleLinkFile = async (projectIds: string[], taskIds: string[]) => {
    if (!selectedFile) return

    // Unlink removed projects
    for (const projectId of selectedFile.linkedProjects) {
      if (!projectIds.includes(projectId)) {
        await mediaFiles.unlinkFromProject(selectedFile.id, projectId)
      }
    }

    // Link new projects
    for (const projectId of projectIds) {
      if (!selectedFile.linkedProjects.includes(projectId)) {
        await mediaFiles.linkToProject(selectedFile.id, projectId)
      }
    }

    // Unlink removed tasks
    for (const taskId of selectedFile.linkedTasks) {
      if (!taskIds.includes(taskId)) {
        await mediaFiles.unlinkFromTask(selectedFile.id, taskId)
      }
    }

    // Link new tasks
    for (const taskId of taskIds) {
      if (!selectedFile.linkedTasks.includes(taskId)) {
        await mediaFiles.linkToTask(selectedFile.id, taskId)
      }
    }

    await refetch()
  }

  // File actions
  const openFilePreview = (file: MediaFile) => {
    setSelectedFile(file)
    setIsPreviewOpen(true)
  }

  const openFileRename = (file: MediaFile) => {
    setSelectedFile(file)
    setIsRenameDialogOpen(true)
  }

  const openFileDelete = (file: MediaFile) => {
    setSelectedFile(file)
    setSelectedFolder(null)
    setIsDeleteDialogOpen(true)
  }

  const openFileMove = (file: MediaFile) => {
    setSelectedFile(file)
    setIsMoveDialogOpen(true)
  }

  const openFileLink = (file: MediaFile) => {
    setSelectedFile(file)
    setIsLinkDialogOpen(true)
  }

  // Folder actions
  const openFolderRename = (folder: MediaFolder) => {
    setEditingFolder(folder)
    setIsFolderDialogOpen(true)
  }

  const openFolderDelete = (folder: MediaFolder) => {
    setSelectedFolder(folder)
    setSelectedFile(null)
    setIsDeleteDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Media Library</h1>
          <p className="text-muted-foreground">
            Manage your files and folders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingFolder(null)
              setIsFolderDialogOpen(true)
            }}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      <MediaBreadcrumb path={breadcrumb} onNavigate={navigateToFolder} />

      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category filter */}
        <Select
          value={categoryFilter || 'all'}
          onValueChange={(value) =>
            setCategoryFilter(value === 'all' ? null : (value as FileCategory))
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="archive">Archives</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as MediaSortBy)}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
            <SelectItem value="type">Type</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? (
            <SortAsc className="h-4 w-4" />
          ) : (
            <SortDesc className="h-4 w-4" />
          )}
        </Button>

        {/* View toggle */}
        <div className="flex items-center border rounded-lg">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-r-none',
              viewMode === 'grid' && 'bg-muted'
            )}
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-l-none',
              viewMode === 'list' && 'bg-muted'
            )}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selection toolbar */}
      {selectedFiles.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedFiles.size} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
          >
            Select all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
          >
            Clear
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMoveDialogOpen(true)}
          >
            <FolderInput className="h-4 w-4 mr-2" />
            Move
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBulkDeleteDialogOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      )}

      {/* File grid */}
      <FileGrid
        files={files}
        folders={folders}
        viewMode={viewMode}
        selectedFiles={selectedFiles}
        onFileSelect={handleFileSelect}
        onFileClick={openFilePreview}
        onFilePreview={openFilePreview}
        onFileRename={openFileRename}
        onFileDelete={openFileDelete}
        onFileMove={openFileMove}
        onFileLink={openFileLink}
        onFolderClick={(folder) => navigateToFolder(folder.id)}
        onFolderRename={openFolderRename}
        onFolderDelete={openFolderDelete}
      />

      {/* Dialogs */}
      <FileUploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        uploads={uploads}
        isUploading={isUploading}
        onUpload={uploadFiles}
        onCancel={cancelUpload}
      />

      <FolderDialog
        open={isFolderDialogOpen}
        onOpenChange={setIsFolderDialogOpen}
        folder={editingFolder}
        parentId={folderId ?? null}
        onSubmit={editingFolder ? handleUpdateFolder : handleCreateFolder}
      />

      <FilePreview
        file={selectedFile}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />

      <RenameDialog
        open={isRenameDialogOpen}
        onOpenChange={setIsRenameDialogOpen}
        currentName={selectedFile?.displayName || ''}
        onRename={handleRenameFile}
        type="file"
      />

      <MoveDialog
        open={isMoveDialogOpen}
        onOpenChange={setIsMoveDialogOpen}
        userId={user?.uid || ''}
        currentFolderId={folderId ?? null}
        onMove={handleMoveFile}
      />

      <FileLinkSelector
        open={isLinkDialogOpen}
        onOpenChange={setIsLinkDialogOpen}
        currentProjectLinks={selectedFile?.linkedProjects || []}
        currentTaskLinks={selectedFile?.linkedTasks || []}
        onLink={handleLinkFile}
      />

      {/* Delete confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedFolder ? 'Folder' : 'File'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedFolder ? (
                <>
                  Are you sure you want to delete the folder &quot;{selectedFolder.name}&quot;?
                  This will also delete all files and subfolders inside it.
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete &quot;{selectedFile?.displayName}&quot;?
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={selectedFolder ? handleDeleteFolder : handleDeleteFile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedFiles.size} files</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedFiles.size} selected files?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedFiles.size} files
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
