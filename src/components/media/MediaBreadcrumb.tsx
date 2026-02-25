'use client'

import { MediaFolder } from '@/types'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

interface MediaBreadcrumbProps {
  path: MediaFolder[]
  onNavigate: (folderId: string | null) => void
}

export function MediaBreadcrumb({ path, onNavigate }: MediaBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-0.5 text-sm whitespace-nowrap">
      <ChevronRight className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />

      {path.map((folder, index) => (
        <div key={folder.id} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground font-medium"
            onClick={() => onNavigate(folder.id)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0"
              style={{ backgroundColor: folder.color }}
            />
            {folder.name}
          </Button>
        </div>
      ))}
    </nav>
  )
}
