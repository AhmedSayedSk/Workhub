'use client'

import { MediaFile, MediaFolder, MediaViewMode } from '@/types'
import { FileCard } from './FileCard'
import { FolderCard } from './FolderCard'
import { cn } from '@/lib/utils'
import { Files, Folder } from 'lucide-react'

interface FileGridProps {
  files: MediaFile[]
  folders: MediaFolder[]
  viewMode: MediaViewMode
  selectedFiles: Set<string>
  onFileSelect: (fileId: string, selected: boolean) => void
  onFileClick: (file: MediaFile) => void
  onFilePreview: (file: MediaFile) => void
  onFileRename: (file: MediaFile) => void
  onFileDelete: (file: MediaFile) => void
  onFileMove: (file: MediaFile) => void
  onFileLink: (file: MediaFile) => void
  onFolderClick: (folder: MediaFolder) => void
  onFolderRename: (folder: MediaFolder) => void
  onFolderDelete: (folder: MediaFolder) => void
}

export function FileGrid({
  files,
  folders,
  viewMode,
  selectedFiles,
  onFileSelect,
  onFileClick,
  onFilePreview,
  onFileRename,
  onFileDelete,
  onFileMove,
  onFileLink,
  onFolderClick,
  onFolderRename,
  onFolderDelete,
}: FileGridProps) {
  const isEmpty = files.length === 0 && folders.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Files className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No files or folders</p>
        <p className="text-sm">Upload files or create folders to get started</p>
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Folders */}
        {folders.length > 0 && (
          <>
            <div className="px-4 py-2 bg-muted/50 text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Folders ({folders.length})
            </div>
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                viewMode={viewMode}
                onClick={() => onFolderClick(folder)}
                onRename={() => onFolderRename(folder)}
                onDelete={() => onFolderDelete(folder)}
              />
            ))}
          </>
        )}

        {/* Files */}
        {files.length > 0 && (
          <>
            <div className="px-4 py-2 bg-muted/50 text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Files className="h-4 w-4" />
              Files ({files.length})
            </div>
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                viewMode={viewMode}
                isSelected={selectedFiles.has(file.id)}
                onSelect={(selected) => onFileSelect(file.id, selected)}
                onClick={() => onFileClick(file)}
                onPreview={() => onFilePreview(file)}
                onRename={() => onFileRename(file)}
                onDelete={() => onFileDelete(file)}
                onMove={() => onFileMove(file)}
                onLink={() => onFileLink(file)}
              />
            ))}
          </>
        )}
      </div>
    )
  }

  // Grid view
  return (
    <div className="space-y-6">
      {/* Folders */}
      {folders.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Folders ({folders.length})
          </h3>
          <div
            className={cn(
              'grid gap-4',
              'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
            )}
          >
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                viewMode={viewMode}
                onClick={() => onFolderClick(folder)}
                onRename={() => onFolderRename(folder)}
                onDelete={() => onFolderDelete(folder)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Files className="h-4 w-4" />
            Files ({files.length})
          </h3>
          <div
            className={cn(
              'grid gap-4',
              'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
            )}
          >
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                viewMode={viewMode}
                isSelected={selectedFiles.has(file.id)}
                onSelect={(selected) => onFileSelect(file.id, selected)}
                onClick={() => onFileClick(file)}
                onPreview={() => onFilePreview(file)}
                onRename={() => onFileRename(file)}
                onDelete={() => onFileDelete(file)}
                onMove={() => onFileMove(file)}
                onLink={() => onFileLink(file)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
