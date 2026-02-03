'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MediaFolder } from '@/types'
import { folderColors } from '@/lib/utils'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder?: MediaFolder | null
  parentId: string | null
  onSubmit: (data: { name: string; color: string }) => Promise<void>
}

export function FolderDialog({
  open,
  onOpenChange,
  folder,
  parentId,
  onSubmit,
}: FolderDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(folderColors[0].value)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!folder

  useEffect(() => {
    if (open) {
      if (folder) {
        setName(folder.name)
        setColor(folder.color)
      } else {
        setName('')
        setColor(folderColors[0].value)
      }
    }
  }, [open, folder])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), color })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Rename Folder' : 'Create Folder'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the folder name and color'
                : 'Create a new folder to organize your files'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Folder Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {folderColors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110',
                      color === c.value && 'ring-2 ring-offset-2 ring-primary'
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                  >
                    {color === c.value && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
