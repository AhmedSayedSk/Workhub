'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ImagePlus, X } from 'lucide-react'
import { CachedImage } from '@/components/media/CachedImage'
import { ImageSelector } from '@/components/media/ImageSelector'

interface ProjectImagePickerProps {
  value: string | null
  onChange: (url: string | null) => void
  className?: string
}

export function ProjectImagePicker({ value, onChange, className }: ProjectImagePickerProps) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  const handleSelect = (url: string) => {
    onChange(url)
  }

  return (
    <>
      <div className={cn('flex items-center gap-4', className)}>
        <div
          onClick={() => setIsSelectorOpen(true)}
          className={cn(
            'relative w-20 h-20 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all overflow-hidden group',
            value
              ? 'border-transparent hover:border-primary/50'
              : 'border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          {value ? (
            <>
              <CachedImage
                src={value}
                alt="Project icon"
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">Change</span>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1">
          <p className="text-sm font-medium">Project Icon</p>
          <p className="text-xs text-muted-foreground">
            {value ? 'Click to change or remove' : 'Click to select from library'}
          </p>
        </div>
      </div>

      <ImageSelector
        open={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        onSelect={handleSelect}
        currentValue={value}
      />
    </>
  )
}

// Display component for project icon
interface ProjectIconProps {
  src: string | null | undefined
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProjectIcon({ src, name, size = 'md', className }: ProjectIconProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-lg',
  }

  if (src) {
    return (
      <CachedImage
        src={src}
        alt={name}
        className={cn(
          'rounded-lg object-contain flex-shrink-0',
          sizeClasses[size],
          className
        )}
      />
    )
  }

  // Fallback: show first letter of project name
  return (
    <div
      className={cn(
        'rounded-lg bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0',
        sizeClasses[size],
        className
      )}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
