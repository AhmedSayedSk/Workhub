'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { projects as projectsApi, members as membersApi } from '@/lib/firestore'
import {
  Project,
  Member,
  ProjectDistribution,
  DistributionCategory,
  DistributionPartner,
} from '@/types'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  PercentIcon,
  Users,
  Layers,
  AlertTriangle,
  ChevronsUpDown,
  Crown,
  Lock,
  GripVertical,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  buildInitialDistribution,
  computePartnerShares,
  sumAllocationsForCategory,
  sumWeights,
} from '@/lib/distribution-defaults'

interface ProjectEquityTabProps {
  project: Project
  onUpdate: () => void
}

// Stable id helper for new custom categories.
function newCategoryId(): string {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// Clamp a number into [0, 100]; non-numeric → 0.
function clampPercent(raw: string | number): number {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw
  if (!Number.isFinite(n) || n < 0) return 0
  if (n > 100) return 100
  return n
}

export function ProjectEquityTab({ project, onUpdate }: ProjectEquityTabProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { settings } = useSettings()

  const isOwner = !!user && user.uid === project.ownerId

  const [draft, setDraft] = useState<ProjectDistribution | null>(project.distribution ?? null)
  const [members, setMembers] = useState<Member[]>([])
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmRemovePartner, setConfirmRemovePartner] = useState<string | null>(null)
  const [confirmRemoveCategory, setConfirmRemoveCategory] = useState<string | null>(null)
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null)

  // Sync draft when project prop changes (e.g., after parent re-fetches)
  useEffect(() => {
    setDraft(project.distribution ?? null)
  }, [project.distribution])

  useEffect(() => {
    membersApi.getAll().then(setMembers).catch(() => {})
  }, [])

  const memberById = useMemo(() => {
    const map = new Map<string, Member>()
    for (const m of members) map.set(m.id, m)
    return map
  }, [members])

  const dirty = useMemo(() => {
    return JSON.stringify(draft ?? null) !== JSON.stringify(project.distribution ?? null)
  }, [draft, project.distribution])

  const totalWeight = draft ? sumWeights(draft.categories) : 0
  const weightOk = Math.abs(totalWeight - 100) < 0.01

  // Each category's per-partner allocation must sum to 100 (per the math).
  const categoryAllocationStatus = useMemo(() => {
    if (!draft) return new Map<string, { sum: number; ok: boolean }>()
    const map = new Map<string, { sum: number; ok: boolean }>()
    for (const c of draft.categories) {
      const sum = sumAllocationsForCategory(draft.partners, c.id)
      map.set(c.id, { sum, ok: draft.partners.length === 0 || Math.abs(sum - 100) < 0.01 })
    }
    return map
  }, [draft])

  const partnerShares = useMemo(() => {
    if (!draft) return {} as Record<string, number>
    return computePartnerShares(draft.categories, draft.partners)
  }, [draft])

  const allCategoriesOk = Array.from(categoryAllocationStatus.values()).every((v) => v.ok)

  const handleEnable = () => {
    const next = buildInitialDistribution(settings?.defaultDistributionCategories)
    setDraft(next)
  }

  const handleDisable = () => {
    if (!draft) return
    setDraft({ ...draft, enabled: false })
  }

  const handleEnableExisting = () => {
    if (!draft) return
    setDraft({ ...draft, enabled: true })
  }

  const updateCategory = (id: string, patch: Partial<DistributionCategory>) => {
    if (!draft) return
    setDraft({
      ...draft,
      categories: draft.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })
  }

  const addCategory = () => {
    if (!draft) return
    const id = newCategoryId()
    setDraft({
      ...draft,
      categories: [
        ...draft.categories,
        { id, name: 'New category', weight: 0, isCustom: true },
      ],
    })
  }

  const reorderCategories = (sourceId: string, targetId: string) => {
    if (!draft || sourceId === targetId) return
    const list = [...draft.categories]
    const fromIdx = list.findIndex((c) => c.id === sourceId)
    const toIdx = list.findIndex((c) => c.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)
    setDraft({ ...draft, categories: list })
  }

  const removeCategory = (id: string) => {
    if (!draft) return
    setDraft({
      ...draft,
      categories: draft.categories.filter((c) => c.id !== id),
      partners: draft.partners.map((p) => {
        const next = { ...p.allocations }
        delete next[id]
        return { ...p, allocations: next }
      }),
    })
  }

  const addPartner = (member: Member) => {
    if (!draft) return
    if (draft.partners.some((p) => p.memberId === member.id)) {
      toast({ title: 'Already added', description: `${member.name} is already a partner.`, variant: 'destructive' })
      setMemberPickerOpen(false)
      return
    }
    setDraft({
      ...draft,
      partners: [...draft.partners, { memberId: member.id, allocations: {} }],
    })
    setMemberPickerOpen(false)
  }

  const removePartner = (memberId: string) => {
    if (!draft) return
    setDraft({
      ...draft,
      partners: draft.partners.filter((p) => p.memberId !== memberId),
    })
  }

  const updateAllocation = (memberId: string, categoryId: string, value: number) => {
    if (!draft) return
    setDraft({
      ...draft,
      partners: draft.partners.map((p) =>
        p.memberId === memberId
          ? { ...p, allocations: { ...p.allocations, [categoryId]: value } }
          : p,
      ),
    })
  }

  const handleSave = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    try {
      await projectsApi.updateDistribution(project.id, draft)
      onUpdate()
      toast({ description: 'Distribution saved', variant: 'success' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Error', description: 'Failed to save distribution', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [draft, project.id, onUpdate, toast])

  const handleReset = () => {
    setDraft(project.distribution ?? null)
  }

  // Visibility: owner OR a partner who is referenced in the saved distribution
  // (use saved data, not the draft, so a partner can't see edits before save).
  const viewerIsListedPartner = useMemo(() => {
    if (!user || !project.distribution) return false
    const viewerMember = members.find(
      (m) => m.email.toLowerCase() === (user.email || '').toLowerCase(),
    )
    if (!viewerMember) return false
    return project.distribution.partners.some((p) => p.memberId === viewerMember.id)
  }, [user, project.distribution, members])

  if (!isOwner && !viewerIsListedPartner) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Lock className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">Only the project owner and listed partners can view this</p>
      </div>
    )
  }

  // Read-only view for non-owners (partners)
  if (!isOwner && project.distribution?.enabled) {
    return (
      <ReadOnlyDistribution
        distribution={project.distribution}
        memberById={memberById}
        project={project}
      />
    )
  }

  // Owner: not yet configured
  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-4">
        <Layers className="h-12 w-12 opacity-40" />
        <div className="text-center">
          <p className="text-base font-medium text-foreground">Dynamic Equity Split / Effort-Based Profit Sharing</p>
          <p className="text-sm mt-1 max-w-md">
            Define how this project&apos;s ownership is distributed between partners across effort categories
            (programming, design, etc.). Partners&apos; effective shares are computed from category weights.
          </p>
        </div>
        <Button onClick={handleEnable} className="gap-2">
          <Plus className="h-4 w-4" />
          Set up distribution
        </Button>
      </div>
    )
  }

  // Owner: disabled but previously configured
  if (!draft.enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-4">
        <p className="text-sm">Distribution is disabled for this project.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEnableExisting}>Re-enable</Button>
        </div>
      </div>
    )
  }

  // Owner editor
  const availableMembers = members.filter(
    (m) => !draft.partners.some((p) => p.memberId === m.id),
  )

  return (
    <div className="space-y-6">
      {/* Header / status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Effort-Based Profit Sharing
          </Label>
          <p className="text-xs text-muted-foreground">
            Define category weights on the left, then for each partner distribute 100% per category on the right.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={draft.enabled}
            onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
          />
          <span className="text-xs text-muted-foreground">Enabled</span>
        </div>
      </div>

      {/* Categories — col-6 / half width */}
      <div className="lg:w-1/2 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4" />
              Effort Categories
            </Label>
            <Badge
              variant={weightOk ? 'secondary' : 'outline'}
              className={cn(
                'tabular-nums',
                weightOk
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-300',
              )}
            >
              Total {totalWeight.toFixed(1)}%
            </Badge>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-[28px_1fr_120px_44px] items-center gap-2 px-4 py-2 border-b text-xs font-medium text-muted-foreground">
                <span></span>
                <span>Name</span>
                <span className="text-right">Weight (%)</span>
                <span></span>
              </div>
              {draft.categories.map((c) => {
                const isDragging = draggingCategoryId === c.id
                const isDragOver = dragOverCategoryId === c.id && draggingCategoryId !== c.id
                return (
                  <div
                    key={c.id}
                    onDragOver={(e) => {
                      if (!draggingCategoryId) return
                      e.preventDefault()
                      setDragOverCategoryId(c.id)
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
                      setDragOverCategoryId((prev) => (prev === c.id ? null : prev))
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggingCategoryId) reorderCategories(draggingCategoryId, c.id)
                      setDraggingCategoryId(null)
                      setDragOverCategoryId(null)
                    }}
                    className={cn(
                      'grid grid-cols-[28px_1fr_120px_44px] items-center gap-2 px-4 py-2 border-b last:border-b-0 transition-colors',
                      isDragging && 'opacity-40',
                      isDragOver && 'bg-primary/10 border-primary/40',
                    )}
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDraggingCategoryId(c.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        setDraggingCategoryId(null)
                        setDragOverCategoryId(null)
                      }}
                      className="flex items-center justify-center h-10 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                      aria-label="Drag to reorder"
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <Input
                      value={c.name}
                      onChange={(e) => updateCategory(c.id, { name: e.target.value })}
                      dir="auto"
                      className="h-10 text-base"
                    />
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={c.weight}
                        onChange={(e) => updateCategory(c.id, { weight: clampPercent(e.target.value) })}
                        className="h-10 pr-7 text-right text-base"
                      />
                      <PercentIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmRemoveCategory(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                <Button variant="ghost" size="sm" onClick={addCategory} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add category
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      <Separator />

      {/* Partners section — full width */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Label className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Partners
            </Label>
            <p className="text-xs text-muted-foreground">
              For each category, distribute 100% across partners that contributed to it.
            </p>
          </div>
          <Popover open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add partner
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search team members..." />
                <CommandList>
                  <CommandEmpty>
                    {members.length === 0
                      ? 'No team members found. Add members in the Team page first.'
                      : 'No more members available.'}
                  </CommandEmpty>
                  <CommandGroup>
                    {availableMembers.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={`${m.name} ${m.email}`}
                        onSelect={() => addPartner(m)}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <MemberAvatar member={m} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {draft.partners.length === 0 ? (
          <Card>
            <CardContent className="py-10 flex flex-col items-center text-muted-foreground">
              <Users className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No partners yet. Add team members to define their share.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2 sticky left-0 bg-muted/30 z-10 min-w-[180px]">
                      Partner
                    </th>
                    {draft.categories.map((c) => {
                      const status = categoryAllocationStatus.get(c.id)
                      return (
                        <th key={c.id} className="text-center font-medium px-2 py-2 min-w-[120px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[11px] truncate max-w-[140px]" dir="auto" title={c.name}>
                              {c.name}
                            </span>
                            <span className="text-[10px] opacity-70">
                              w {c.weight}%
                            </span>
                            <span
                              className={cn(
                                'text-[10px] tabular-nums px-1.5 rounded',
                                status?.ok
                                  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
                              )}
                            >
                              Σ {(status?.sum ?? 0).toFixed(1)}%
                            </span>
                          </div>
                        </th>
                      )
                    })}
                    <th className="text-center font-medium px-3 py-2 min-w-[110px]">Share</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.partners.map((p) => {
                    const member = memberById.get(p.memberId)
                    const share = partnerShares[p.memberId] ?? 0
                    const owedFromPaid = ((project.paidAmount || 0) * share) / 100
                    return (
                      <tr key={p.memberId} className="border-b last:border-b-0 hover:bg-muted/20">
                        <td className="px-4 py-2 sticky left-0 bg-card z-10">
                          <div className="flex items-center gap-2 min-w-0">
                            {member ? (
                              <MemberAvatar member={member} size="sm" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-muted" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{member?.name || 'Unknown member'}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{member?.email || p.memberId}</p>
                            </div>
                          </div>
                        </td>
                        {draft.categories.map((c) => (
                          <td key={c.id} className="px-2 py-2 text-center align-middle">
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={p.allocations[c.id] ?? ''}
                                placeholder="0"
                                onChange={(e) =>
                                  updateAllocation(p.memberId, c.id, clampPercent(e.target.value))
                                }
                                className="h-8 text-right pr-6 text-xs"
                              />
                              <PercentIcon className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            </div>
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-semibold tabular-nums">{share.toFixed(2)}%</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {formatCurrency(owedFromPaid, project.currency)}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmRemovePartner(p.memberId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Validation summary */}
      {(!weightOk || !allCategoriesOk) && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-amber-700 dark:text-amber-300 font-medium">
              Heads up — your shares are still in progress.
            </p>
            {!weightOk && (
              <p className="text-amber-700 dark:text-amber-300">
                Category weights total {totalWeight.toFixed(1)}% (ideally 100% for accurate splits). You can still save.
              </p>
            )}
            {!allCategoriesOk && (
              <p className="text-amber-700 dark:text-amber-300">
                Some categories don&apos;t have partner allocations summing to 100% — computed shares will reflect that. You can still save.
              </p>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Crown className="h-3.5 w-3.5" />
          Only the project owner can edit. Listed partners can view.
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDisable}>
            Disable
          </Button>
          <Button variant="ghost" onClick={handleReset} disabled={!dirty || saving}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={!!confirmRemovePartner}
        onOpenChange={(open) => !open && setConfirmRemovePartner(null)}
        title="Remove partner"
        description="Remove this partner from the distribution? Their allocations will be cleared."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (confirmRemovePartner) removePartner(confirmRemovePartner)
          setConfirmRemovePartner(null)
        }}
      />
      <ConfirmDialog
        open={!!confirmRemoveCategory}
        onOpenChange={(open) => !open && setConfirmRemoveCategory(null)}
        title="Remove category"
        description="Remove this category? Allocations for it will be cleared on all partners."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (confirmRemoveCategory) removeCategory(confirmRemoveCategory)
          setConfirmRemoveCategory(null)
        }}
      />
    </div>
  )
}

// Read-only view shown to non-owner partners
function ReadOnlyDistribution({
  distribution,
  memberById,
  project,
}: {
  distribution: ProjectDistribution
  memberById: Map<string, Member>
  project: Project
}) {
  const shares = useMemo(
    () => computePartnerShares(distribution.categories, distribution.partners),
    [distribution],
  )

  return (
    <div className="space-y-6">
      <div>
        <Label className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Partner shares
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Effective ownership computed from category weights and per-category contributions.
        </p>
      </div>

      <div className="space-y-3">
        {distribution.partners.map((p) => {
          const member = memberById.get(p.memberId)
          const share = shares[p.memberId] ?? 0
          const owedFromPaid = ((project.paidAmount || 0) * share) / 100
          return (
            <Card key={p.memberId}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                {member ? (
                  <MemberAvatar member={member} size="sm" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member?.name || 'Unknown member'}</p>
                  <Progress value={share} className="h-1.5 mt-2" />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{share.toFixed(2)}%</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {formatCurrency(owedFromPaid, project.currency)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Separator />

      <div>
        <Label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          Effort categories
        </Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {distribution.categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border bg-muted/20"
            >
              <span className="text-sm truncate" dir="auto" title={c.name}>{c.name}</span>
              <Badge variant="secondary" className="tabular-nums shrink-0">{c.weight}%</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
