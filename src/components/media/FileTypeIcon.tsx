'use client'

import {
  Image,
  Video,
  Music,
  FileText,
  Archive,
  File,
  FileSpreadsheet,
  FileCode,
  Presentation,
} from 'lucide-react'
import { FileCategory } from '@/types'
import { cn } from '@/lib/utils'

interface FileTypeIconProps {
  category: FileCategory
  mimeType?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
}

const categoryColors = {
  image: 'text-purple-500',
  video: 'text-red-500',
  audio: 'text-green-500',
  document: 'text-blue-500',
  archive: 'text-amber-500',
  other: 'text-gray-500',
}

export function FileTypeIcon({
  category,
  mimeType,
  className,
  size = 'md',
}: FileTypeIconProps) {
  const sizeClass = sizeClasses[size]
  const colorClass = categoryColors[category]

  // Get more specific icon based on MIME type
  const getIcon = () => {
    if (mimeType) {
      // Spreadsheets
      if (
        mimeType.includes('spreadsheet') ||
        mimeType.includes('excel') ||
        mimeType === 'text/csv'
      ) {
        return FileSpreadsheet
      }

      // Presentations
      if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
        return Presentation
      }

      // Code files
      if (
        mimeType === 'text/javascript' ||
        mimeType === 'text/css' ||
        mimeType === 'application/json' ||
        mimeType === 'text/html' ||
        mimeType === 'application/xml'
      ) {
        return FileCode
      }
    }

    // Default icons by category
    switch (category) {
      case 'image':
        return Image
      case 'video':
        return Video
      case 'audio':
        return Music
      case 'document':
        return FileText
      case 'archive':
        return Archive
      default:
        return File
    }
  }

  const Icon = getIcon()

  return <Icon className={cn(sizeClass, colorClass, className)} />
}
