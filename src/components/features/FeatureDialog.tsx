'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Feature, FeatureInput, FeatureStatus, Priority } from '@/types'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Search } from 'lucide-react'
import { ICON_LIBRARY, getIconComponent, matchesIconSearch } from '@/lib/task-icons'

// Re-export for backward compat
export const getFeatureIcon = getIconComponent


interface FeatureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature?: Feature | null
  projectId: string
  onSubmit: (data: FeatureInput) => Promise<void>
}

export function FeatureDialog({
  open,
  onOpenChange,
  feature,
  projectId,
  onSubmit,
}: FeatureDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [iconSearch, setIconSearch] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: '' as Priority | '',
    estimatedHours: '',
    status: 'pending' as FeatureStatus,
    icon: null as string | null,
  })

  useEffect(() => {
    if (feature) {
      setFormData({
        name: feature.name,
        description: feature.description,
        priority: feature.priority || '',
        estimatedHours: feature.estimatedHours.toString(),
        status: feature.status,
        icon: feature.icon || null,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        priority: '',
        estimatedHours: '',
        status: 'pending',
        icon: null,
      })
    }
  }, [feature, open])

  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        projectId,
        name: formData.name,
        description: formData.description,
        priority: (formData.priority || null) as Priority,
        estimatedHours: parseFloat(formData.estimatedHours) || 0,
        status: formData.status,
        icon: formData.icon,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const SelectedIcon = getIconComponent(formData.icon)

  const isEdit = !!feature

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Feature' : 'Create Feature'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the feature details'
              : 'Add a new feature to organize your tasks'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Icon & Name Row */}
          <div className="flex gap-4 items-start">
            {/* Icon Picker */}
            <Popover open={iconPickerOpen} onOpenChange={(open) => {
                setIconPickerOpen(open)
                if (!open) setIconSearch('')
              }}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex-shrink-0 w-16 h-16 mt-5 rounded-xl border-2 border-dashed flex items-center justify-center transition-all hover:border-primary/50 hover:bg-muted/50 group',
                    formData.icon
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-muted-foreground/25'
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
                    formData.icon
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                  )}>
                    <SelectedIcon className="h-6 w-6" />
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search icons..."
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-3">
                    <div className="grid grid-cols-7 gap-1">
                      {ICON_LIBRARY
                        .filter((entry) =>
                          iconSearch ? matchesIconSearch(entry, iconSearch) : true
                        )
                        .map(({ name, icon: Icon }) => (
                          <button
                            key={name}
                            type="button"
                            className={cn(
                              'h-9 w-9 rounded-lg flex items-center justify-center transition-all hover:bg-muted',
                              formData.icon === name && 'bg-primary/15 text-primary ring-2 ring-primary/30'
                            )}
                            onClick={() => {
                              setFormData({ ...formData, icon: name })
                              setIconPickerOpen(false)
                              setIconSearch('')
                            }}
                            title={name}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        ))}
                    </div>
                    {iconSearch && ICON_LIBRARY.filter((entry) =>
                      matchesIconSearch(entry, iconSearch)
                    ).length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">
                        No icons found
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Name & Label */}
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Feature Name *</Label>
              <Input
                placeholder="e.g., User Authentication"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="h-11 text-base"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Feature description..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value === 'none' ? '' : value as Priority })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as FeatureStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Estimated Hours</Label>
            <Input
              type="number"
              placeholder="0"
              value={formData.estimatedHours}
              onChange={(e) =>
                setFormData({ ...formData, estimatedHours: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
