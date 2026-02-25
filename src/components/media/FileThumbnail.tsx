'use client'

import { FileTypeIcon } from './FileTypeIcon'
import { CachedImage } from './CachedImage'
import { getFileExtension } from '@/lib/storage'
import { FileCategory } from '@/types'
import { cn } from '@/lib/utils'

interface FileThumbnailProps {
  fileName: string
  displayName: string
  category: FileCategory
  mimeType: string
  url: string
  thumbnailUrl: string | null
  /** 'list' renders a small square, 'grid' renders a full aspect-square */
  variant: 'list' | 'grid'
  className?: string
}

export function FileThumbnail({
  fileName,
  displayName,
  category,
  mimeType,
  url,
  thumbnailUrl,
  variant,
  className,
}: FileThumbnailProps) {
  const ext = getFileExtension(fileName)

  if (variant === 'list') {
    return (
      <div className={cn('flex-shrink-0', className)}>
        {category === 'image' ? (
          <CachedImage
            src={thumbnailUrl || url}
            alt={displayName}
            className="w-10 h-10 object-contain rounded"
          />
        ) : (
          <div className="relative w-10 h-10 flex items-center justify-center bg-muted rounded">
            <FileTypeIcon
              category={category}
              mimeType={mimeType}
              size="lg"
            />
            {ext && (
              <span className="absolute -bottom-1.5 -right-1.5 px-1 py-px text-[10px] font-bold uppercase leading-none rounded bg-background border shadow-sm text-muted-foreground">
                {ext}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Grid variant
  if (category === 'image') {
    return (
      <CachedImage
        src={thumbnailUrl || url}
        alt={displayName}
        className={cn('w-full h-full object-contain', className)}
      />
    )
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <FileTypeIcon
        category={category}
        mimeType={mimeType}
        className="h-10 w-10"
      />
      {ext && (
        <span className="px-2 py-0.5 text-xs font-bold uppercase leading-none rounded bg-background border shadow-sm text-muted-foreground">
          {ext}
        </span>
      )}
    </div>
  )
}
