'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Feature, Task, FeatureInput } from '@/types'
import { cn } from '@/lib/utils'
import { FeatureDialog, getFeatureIcon } from './FeatureDialog'
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Layers,
  ListTodo,
} from 'lucide-react'
import { Priority } from '@/types'

const priorityBorderColors: Record<Priority, string | null> = {
  high: 'rgba(249, 115, 22, 0.6)',       // orange-500 at 60%
  medium: 'rgba(234, 179, 8, 0.5)',      // yellow-500 at 50%
  low: null,                              // no color
}

interface FeatureListProps {
  features: Feature[]
  tasks: Task[]
  projectId: string
  selectedFeatureId: string | null
  onSelectFeature: (featureId: string | null) => void
  onCreateFeature: (data: FeatureInput) => Promise<void>
  onUpdateFeature: (id: string, data: Partial<FeatureInput>) => Promise<void>
  onDeleteFeature: (id: string) => Promise<void>
}

export function FeatureList({
  features,
  tasks,
  projectId,
  selectedFeatureId,
  onSelectFeature,
  onCreateFeature,
  onUpdateFeature,
  onDeleteFeature,
}: FeatureListProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null)
  const [deletingFeature, setDeletingFeature] = useState<Feature | null>(null)

  const getTaskCount = (featureId: string | null) => {
    const activeTasks = tasks.filter((t) => !t.archived)
    if (featureId === null) {
      return activeTasks.length
    }
    return activeTasks.filter((t) => t.featureId === featureId).length
  }

  const handleEdit = (feature: Feature) => {
    setEditingFeature(feature)
  }

  const handleDelete = async () => {
    if (deletingFeature) {
      await onDeleteFeature(deletingFeature.id)
      setDeletingFeature(null)
      if (selectedFeatureId === deletingFeature.id) {
        onSelectFeature(null)
      }
    }
  }

  const handleCreateSubmit = async (data: FeatureInput) => {
    await onCreateFeature(data)
  }

  const handleEditSubmit = async (data: FeatureInput) => {
    if (editingFeature) {
      await onUpdateFeature(editingFeature.id, data)
      setEditingFeature(null)
    }
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <h3 className="font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Features
        </h3>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Feature List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-2 space-y-1">
          {/* All Tasks Option */}
          <button
            onClick={() => onSelectFeature(null)}
            className={cn(
              'w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors',
              selectedFeatureId === null
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted'
            )}
          >
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">All Tasks</span>
            </div>
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {getTaskCount(null)}
            </Badge>
          </button>

          {/* Features */}
          {features.map((feature) => {
            const FeatureIcon = getFeatureIcon(feature.icon)
            const borderColor = feature.priority ? priorityBorderColors[feature.priority] : null
            return (
              <div
                key={feature.id}
                onClick={() => onSelectFeature(feature.id)}
                className={cn(
                  'w-full flex items-center gap-2 p-3 transition-colors cursor-pointer',
                  selectedFeatureId === feature.id
                    ? 'bg-primary/10'
                    : 'hover:bg-muted',
                  borderColor && 'border-l-[3px]'
                )}
                style={borderColor ? { borderLeftColor: borderColor } : undefined}
              >
                {/* Icon */}
                <div className={cn(
                  'flex-shrink-0',
                  selectedFeatureId === feature.id ? 'text-primary' : 'text-muted-foreground'
                )}>
                  <FeatureIcon className="h-4 w-4" />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'font-medium truncate',
                      selectedFeatureId === feature.id && 'text-primary'
                    )}
                  >
                    {feature.name}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {getTaskCount(feature.id)} tasks
                  </span>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(feature)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeletingFeature(feature)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}

          {features.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No features yet</p>
              <p className="text-xs">Create one to organize your tasks</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <FeatureDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        projectId={projectId}
        onSubmit={handleCreateSubmit}
      />

      {/* Edit Dialog */}
      <FeatureDialog
        open={!!editingFeature}
        onOpenChange={(open) => !open && setEditingFeature(null)}
        feature={editingFeature}
        projectId={projectId}
        onSubmit={handleEditSubmit}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingFeature}
        onOpenChange={(open) => !open && setDeletingFeature(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feature</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingFeature?.name}&quot;? This will
              not delete the tasks associated with this feature, but they will no
              longer be grouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
