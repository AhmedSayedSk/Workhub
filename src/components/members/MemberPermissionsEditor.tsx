'use client'

import { useState, useEffect, useCallback } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useToast } from '@/hooks/useToast'
import {
  memberPermissions as memberPermsApi,
  projects as projectsApi,
  DEFAULT_PROJECT_PERMISSIONS,
  DEFAULT_MODULE_PERMISSIONS,
  audit,
} from '@/lib/firestore'
import {
  Project,
  Member,
  ProjectPermissions,
  ModulePermissions,
} from '@/types'
import {
  Loader2,
  ChevronDown,
  FolderKanban,
  CalendarDays,
  FolderOpen,
  Wallet,
  Clock,
  Sparkles,
  Wand2,
  Settings,
  ListTodo,
  StickyNote,
  Paperclip,
  KeyRound,
  History,
  Bot,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

export interface BufferedPermissions {
  modulePerms: ModulePermissions
  enabledProjects: Set<string>
  projectPerms: Record<string, ProjectPermissions>
}

interface MemberPermissionsEditorProps {
  member: Member
  memberUid: string | null // null if no Firebase account yet
  ownerUid: string
  /** When true, changes are stored locally instead of saved to Firestore */
  buffered?: boolean
  /** Called on every change in buffered mode */
  onBufferedChange?: (data: BufferedPermissions) => void
}

// Permission group definitions for project permissions
const PROJECT_PERM_GROUPS: {
  label: string
  icon: any
  keys: { key: keyof ProjectPermissions; label: string }[]
}[] = [
  {
    label: 'Project',
    icon: FolderKanban,
    keys: [
      { key: 'viewProject', label: 'View project details' },
      { key: 'editProject', label: 'Edit project settings' },
      { key: 'deleteProject', label: 'Delete project' },
    ],
  },
  {
    label: 'Tasks',
    icon: ListTodo,
    keys: [
      { key: 'viewTasks', label: 'View tasks' },
      { key: 'createTasks', label: 'Create tasks' },
      { key: 'editTasks', label: 'Edit tasks' },
      { key: 'deleteTasks', label: 'Delete tasks' },
      { key: 'changeTaskStatus', label: 'Change task status' },
      { key: 'archiveTasks', label: 'Archive tasks' },
    ],
  },
  {
    label: 'Notes',
    icon: StickyNote,
    keys: [
      { key: 'viewNotes', label: 'View notes' },
      { key: 'createEditNotes', label: 'Create & edit notes' },
      { key: 'deleteNotes', label: 'Delete notes' },
    ],
  },
  {
    label: 'Attachments',
    icon: Paperclip,
    keys: [
      { key: 'viewAttachments', label: 'View attachments' },
      { key: 'uploadAttachments', label: 'Upload attachments' },
      { key: 'deleteAttachments', label: 'Delete attachments' },
    ],
  },
  {
    label: 'Vault',
    icon: KeyRound,
    keys: [
      { key: 'viewVault', label: 'View vault entries' },
      { key: 'createEditVault', label: 'Create & edit vault' },
      { key: 'deleteVault', label: 'Delete vault entries' },
    ],
  },
  {
    label: 'Payments',
    icon: Wallet,
    keys: [
      { key: 'viewPayments', label: 'View payments' },
      { key: 'createEditPayments', label: 'Create & edit payments' },
      { key: 'deletePayments', label: 'Delete payments' },
    ],
  },
  {
    label: 'Activity',
    icon: History,
    keys: [
      { key: 'viewActivity', label: 'View activity log' },
    ],
  },
  {
    label: 'AI Sessions',
    icon: Bot,
    keys: [
      { key: 'viewAiSessions', label: 'View AI sessions' },
      { key: 'runAiSessions', label: 'Run AI sessions' },
    ],
  },
  {
    label: 'Time Tracking',
    icon: Clock,
    keys: [
      { key: 'logTime', label: 'Log time' },
      { key: 'viewAllTimeEntries', label: 'View all time entries' },
      { key: 'editDeleteOthersTime', label: "Edit/delete others' time" },
    ],
  },
]

const MODULE_PERM_GROUPS: {
  label: string
  icon: any
  keys: { key: keyof ModulePermissions; label: string }[]
}[] = [
  {
    label: 'Projects',
    icon: FolderKanban,
    keys: [
      { key: 'createProjects', label: 'Create new projects' },
    ],
  },
  {
    label: 'Calendar',
    icon: CalendarDays,
    keys: [
      { key: 'viewCalendar', label: 'View calendar' },
      { key: 'createEditCalendar', label: 'Create & edit events' },
      { key: 'deleteCalendar', label: 'Delete events' },
    ],
  },
  {
    label: 'Media Library',
    icon: FolderOpen,
    keys: [
      { key: 'viewMedia', label: 'View media library' },
      { key: 'uploadMedia', label: 'Upload media' },
      { key: 'deleteMedia', label: 'Delete media' },
    ],
  },
  {
    label: 'Tracking',
    icon: Clock,
    keys: [
      { key: 'viewFinances', label: 'View finances page' },
      { key: 'viewTimesheets', label: 'View timesheets page' },
    ],
  },
  {
    label: 'AI Studio',
    icon: Sparkles,
    keys: [
      { key: 'accessAiAssistant', label: 'AI Assistant' },
      { key: 'accessImageGenerator', label: 'Image Generator' },
    ],
  },
  {
    label: 'System',
    icon: Settings,
    keys: [
      { key: 'accessSettings', label: 'Full settings access' },
    ],
  },
]

export function MemberPermissionsEditor({ member, memberUid, ownerUid, buffered, onBufferedChange }: MemberPermissionsEditorProps) {
  const { toast } = useToast()
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Per-project permission states: projectId -> permissions
  const [projectPerms, setProjectPerms] = useState<Record<string, ProjectPermissions>>({})
  // Which projects are enabled (shared)
  const [enabledProjects, setEnabledProjects] = useState<Set<string>>(new Set())
  // Which project sections are expanded
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  // Module permissions
  const [modulePerms, setModulePerms] = useState<ModulePermissions>(DEFAULT_MODULE_PERMISSIONS)

  // Notify parent of buffered changes
  const emitBuffered = useCallback((mp: ModulePermissions, ep: Set<string>, pp: Record<string, ProjectPermissions>) => {
    if (buffered && onBufferedChange) {
      onBufferedChange({ modulePerms: mp, enabledProjects: ep, projectPerms: pp })
    }
  }, [buffered, onBufferedChange])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const projects = await projectsApi.getAll(ownerUid)
      setAllProjects(projects)

      if (!buffered && memberUid) {
        const permDocs = await memberPermsApi.getForMember(memberUid)
        const enabled = new Set<string>()
        const perms: Record<string, ProjectPermissions> = {}

        for (const doc of permDocs) {
          if (doc.projectId === '__global__' && doc.modules) {
            setModulePerms(doc.modules)
          } else if (doc.permissions) {
            enabled.add(doc.projectId)
            perms[doc.projectId] = doc.permissions
          }
        }
        setEnabledProjects(enabled)
        setProjectPerms(perms)
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load permissions', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [ownerUid, memberUid, buffered, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleProject = async (projectId: string) => {
    if (!buffered && !memberUid) {
      toast({ title: 'No account', description: 'This member needs to sign in before permissions can be set.', variant: 'destructive' })
      return
    }

    if (buffered) {
      // Local-only toggle
      if (enabledProjects.has(projectId)) {
        const newEnabled = new Set(enabledProjects); newEnabled.delete(projectId)
        const newPerms = { ...projectPerms }; delete newPerms[projectId]
        setEnabledProjects(newEnabled)
        setProjectPerms(newPerms)
        emitBuffered(modulePerms, newEnabled, newPerms)
      } else {
        const newEnabled = new Set(enabledProjects); newEnabled.add(projectId)
        const newPerms = { ...projectPerms, [projectId]: { ...DEFAULT_PROJECT_PERMISSIONS } }
        setEnabledProjects(newEnabled)
        setProjectPerms(newPerms)
        emitBuffered(modulePerms, newEnabled, newPerms)
      }
      return
    }

    setSaving(projectId)
    try {
      if (enabledProjects.has(projectId)) {
        const project = allProjects.find((p) => p.id === projectId)
        if (project) {
          const newShared = (project.sharedWith || []).filter((uid) => uid !== memberUid)
          await projectsApi.update(projectId, { sharedWith: newShared })
        }
        await memberPermsApi.removeForProject(memberUid!, projectId)
        setEnabledProjects((prev) => { const s = new Set(prev); s.delete(projectId); return s })
        setProjectPerms((prev) => { const p = { ...prev }; delete p[projectId]; return p })
        const removedProject = allProjects.find((p) => p.id === projectId)
        audit({ type: 'permission', action: 'updated', actorUid: ownerUid, actorEmail: '', targetName: member.name, projectId, projectName: removedProject?.name, details: { change: 'project_access_revoked' } })
      } else {
        const project = allProjects.find((p) => p.id === projectId)
        if (project) {
          const newShared = [...(project.sharedWith || []), memberUid!]
          await projectsApi.update(projectId, { sharedWith: newShared })
        }
        await memberPermsApi.setProjectPermissions(member.id, memberUid!, projectId, DEFAULT_PROJECT_PERMISSIONS)
        setEnabledProjects((prev) => new Set(prev).add(projectId))
        setProjectPerms((prev) => ({ ...prev, [projectId]: { ...DEFAULT_PROJECT_PERMISSIONS } }))
        const addedProject = allProjects.find((p) => p.id === projectId)
        audit({ type: 'permission', action: 'updated', actorUid: ownerUid, actorEmail: '', targetName: member.name, projectId, projectName: addedProject?.name, details: { change: 'project_access_granted' } })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update project access', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  const updateProjectPerm = async (projectId: string, key: keyof ProjectPermissions, value: boolean) => {
    if (!buffered && !memberUid) return
    const current = projectPerms[projectId] || DEFAULT_PROJECT_PERMISSIONS
    const updated = { ...current, [key]: value }
    const newPerms = { ...projectPerms, [projectId]: updated }
    setProjectPerms(newPerms)

    if (buffered) { emitBuffered(modulePerms, enabledProjects, newPerms); return }

    try {
      await memberPermsApi.setProjectPermissions(member.id, memberUid!, projectId, updated)
    } catch {
      setProjectPerms((prev) => ({ ...prev, [projectId]: current }))
      toast({ title: 'Error', description: 'Failed to save permission', variant: 'destructive' })
    }
  }

  const updateModulePerm = async (key: keyof ModulePermissions, value: boolean) => {
    if (!buffered && !memberUid) return
    const updated = { ...modulePerms, [key]: value }
    setModulePerms(updated)

    if (buffered) { emitBuffered(updated, enabledProjects, projectPerms); return }

    try {
      await memberPermsApi.setModulePermissions(member.id, memberUid!, updated)
    } catch {
      setModulePerms(modulePerms)
      toast({ title: 'Error', description: 'Failed to save permission', variant: 'destructive' })
    }
  }

  const toggleAllProject = async (projectId: string, on: boolean) => {
    if (!buffered && !memberUid) return
    const updated = Object.fromEntries(
      Object.keys(DEFAULT_PROJECT_PERMISSIONS).map((k) => [k, on])
    ) as unknown as ProjectPermissions
    const newPerms = { ...projectPerms, [projectId]: updated }
    setProjectPerms(newPerms)

    if (buffered) { emitBuffered(modulePerms, enabledProjects, newPerms); return }

    try {
      await memberPermsApi.setProjectPermissions(member.id, memberUid!, projectId, updated)
    } catch {
      toast({ title: 'Error', description: 'Failed to save permissions', variant: 'destructive' })
    }
  }

  const toggleAllModules = async (on: boolean) => {
    if (!buffered && !memberUid) return
    const updated = Object.fromEntries(
      Object.keys(DEFAULT_MODULE_PERMISSIONS).map((k) => [k, on])
    ) as unknown as ModulePermissions
    setModulePerms(updated)

    if (buffered) { emitBuffered(updated, enabledProjects, projectPerms); return }

    try {
      await memberPermsApi.setModulePermissions(member.id, memberUid!, updated)
      audit({ type: 'permission', action: 'updated', actorUid: ownerUid, actorEmail: '', targetName: member.name, details: { change: on ? 'all_modules_enabled' : 'all_modules_disabled' } })
    } catch {
      toast({ title: 'Error', description: 'Failed to save permissions', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!buffered && !memberUid) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        This member hasn&apos;t signed into WorkHub yet. Permissions can be configured after they log in.
      </p>
    )
  }

  const parentProjects = allProjects.filter((p) => !p.parentProjectId)
  const subProjectsMap: Record<string, Project[]> = {}
  allProjects.forEach((p) => {
    if (p.parentProjectId) {
      if (!subProjectsMap[p.parentProjectId]) subProjectsMap[p.parentProjectId] = []
      subProjectsMap[p.parentProjectId].push(p)
    }
  })

  return (
    <div className="space-y-6">
      {/* Module Access */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Module Access</Label>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAllModules(true)}>
              <ToggleRight className="h-3 w-3 mr-1" /> All On
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAllModules(false)}>
              <ToggleLeft className="h-3 w-3 mr-1" /> All Off
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {MODULE_PERM_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
              </div>
              <div className="space-y-1">
                {group.keys.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={modulePerms[key]}
                      onCheckedChange={(v) => updateModulePerm(key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Project Access */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">Project Access</Label>
        <div className="space-y-2">
          {parentProjects.map((project) => {
            const subs = subProjectsMap[project.id] || []
            const projectsToRender = [project, ...subs]

            return (
              <div key={project.id}>
                {projectsToRender.map((p) => {
                  const isEnabled = enabledProjects.has(p.id)
                  const isExpanded = expandedProjects.has(p.id)
                  const perms = projectPerms[p.id] || DEFAULT_PROJECT_PERMISSIONS
                  const isSub = !!p.parentProjectId

                  return (
                    <div key={p.id} className={isSub ? 'ml-6' : ''}>
                      <Collapsible
                        open={isExpanded && isEnabled}
                        onOpenChange={() => {
                          setExpandedProjects((prev) => {
                            const s = new Set(prev)
                            s.has(p.id) ? s.delete(p.id) : s.add(p.id)
                            return s
                          })
                        }}
                      >
                        <div className="flex items-center gap-2 py-2">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => toggleProject(p.id)}
                            disabled={saving === p.id}
                          />
                          <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0" disabled={!isEnabled}>
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="text-sm font-medium truncate">{p.name}</span>
                            {isSub && <Badge variant="outline" className="text-[10px] shrink-0">Sub</Badge>}
                            {saving === p.id && <Loader2 className="h-3 w-3 animate-spin" />}
                          </CollapsibleTrigger>
                          {isEnabled && (
                            <CollapsibleTrigger>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </CollapsibleTrigger>
                          )}
                        </div>

                        <CollapsibleContent>
                          <div className="ml-8 mb-4 space-y-3 border-l-2 border-muted pl-4">
                            {/* Select all / Deselect all */}
                            <div className="flex gap-1 pt-1">
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => toggleAllProject(p.id, true)}>
                                <ToggleRight className="h-3 w-3 mr-1" /> All On
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => toggleAllProject(p.id, false)}>
                                <ToggleLeft className="h-3 w-3 mr-1" /> All Off
                              </Button>
                            </div>

                            {PROJECT_PERM_GROUPS.map((group) => (
                              <div key={group.label}>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
                                </div>
                                <div className="space-y-1">
                                  {group.keys.map(({ key, label }) => (
                                    <div key={key} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                                      <span className="text-sm">{label}</span>
                                      <Switch
                                        checked={perms[key]}
                                        onCheckedChange={(v) => updateProjectPerm(p.id, key, v)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
