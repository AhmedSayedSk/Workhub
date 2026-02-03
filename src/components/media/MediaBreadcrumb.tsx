'use client'

import { MediaFolder } from '@/types'
import { Button } from '@/components/ui/button'
import { ChevronRight, Home } from 'lucide-react'

interface MediaBreadcrumbProps {
  path: MediaFolder[]
  onNavigate: (folderId: string | null) => void
}

export function MediaBreadcrumb({ path, onNavigate }: MediaBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto pb-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-muted-foreground hover:text-foreground"
        onClick={() => onNavigate(null)}
      >
        <Home className="h-4 w-4" />
      </Button>

      {path.map((folder, index) => (
        <div key={folder.id} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => onNavigate(folder.id)}
          >
            <span
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: folder.color }}
            />
            {folder.name}
          </Button>
        </div>
      ))}
    </nav>
  )
}
