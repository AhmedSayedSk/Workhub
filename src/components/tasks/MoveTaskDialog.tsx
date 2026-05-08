'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, ChevronsUpDown, Loader2, FolderInput } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Project, Feature, Task } from '@/types'
import { features as featuresApi } from '@/lib/firestore'

interface MoveTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  currentProjectName: string
  // Projects the user is allowed to move the task to (already filtered by createTasks permission).
  // The current project is excluded by this component.
  allowedTargets: Project[]
  onConfirm: (target: { projectId: string; projectName: string; featureId: string }) => Promise<void>
}

const NO_FEATURE_VALUE = '__none__'

export function MoveTaskDialog({
  open,
  onOpenChange,
  task,
  currentProjectName,
  allowedTargets,
  onConfirm,
}: MoveTaskDialogProps) {
  const [targetId, setTargetId] = useState<string>('')
  const [targetFeatureId, setTargetFeatureId] = useState<string>('')
  const [features, setFeatures] = useState<Feature[]>([])
  const [loadingFeatures, setLoadingFeatures] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Reset state each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setTargetId('')
    setTargetFeatureId('')
    setFeatures([])
    setSubmitting(false)
    setPickerOpen(false)
  }, [open])

  // Load features for the selected target project (lazily, after pick).
  useEffect(() => {
    if (!targetId) {
      setFeatures([])
      return
    }
    let cancelled = false
    setLoadingFeatures(true)
    featuresApi
      .getAll(targetId)
      .then((list) => {
        if (cancelled) return
        setFeatures(list)
        setTargetFeatureId('') // default to "No feature"
      })
      .catch(() => {
        if (!cancelled) setFeatures([])
      })
      .finally(() => {
        if (!cancelled) setLoadingFeatures(false)
      })
    return () => {
      cancelled = true
    }
  }, [targetId])

  const eligible = useMemo(
    () => allowedTargets.filter((p) => p.id !== task.projectId),
    [allowedTargets, task.projectId],
  )
  const targetProject = eligible.find((p) => p.id === targetId)

  const handleSubmit = async () => {
    if (!targetProject) return
    setSubmitting(true)
    try {
      await onConfirm({
        projectId: targetProject.id,
        projectName: targetProject.name,
        featureId: targetFeatureId,
      })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" />
            Move task to another project
          </DialogTitle>
          <DialogDescription>
            Moving <span className="font-medium text-foreground">&ldquo;{task.name}&rdquo;</span> from{' '}
            <span className="font-medium text-foreground">{currentProjectName}</span>. Comments, subtasks,
            time entries, and questions follow the task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target project */}
          <div className="space-y-2">
            <Label>Target project</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className={cn(
                    'w-full justify-between font-normal',
                    !targetProject && 'text-muted-foreground',
                  )}
                  disabled={eligible.length === 0}
                >
                  {targetProject?.name || (eligible.length === 0 ? 'No projects available' : 'Select a project…')}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search projects…" />
                  <CommandList>
                    <CommandEmpty>No matching project.</CommandEmpty>
                    <CommandGroup>
                      {eligible.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => {
                            setTargetId(p.id)
                            setPickerOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              targetId === p.id ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {eligible.length === 0 && (
              <p className="text-xs text-muted-foreground">
                You don&apos;t have permission to create tasks in any other project.
              </p>
            )}
          </div>

          {/* Target feature */}
          <div className="space-y-2">
            <Label>Feature in target project (optional)</Label>
            <Select
              value={targetFeatureId || NO_FEATURE_VALUE}
              onValueChange={(v) => setTargetFeatureId(v === NO_FEATURE_VALUE ? '' : v)}
              disabled={!targetId || loadingFeatures}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingFeatures ? 'Loading features…' : 'No feature'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FEATURE_VALUE}>No feature</SelectItem>
                {features.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targetId && !loadingFeatures && features.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Target project has no features yet — task will land unassigned.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!targetProject || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Move task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
