'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useMembers } from '@/hooks/useMembers'
import { Member, MemberInput } from '@/types'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { colorPresets } from '@/lib/utils'
import { Plus, Loader2, MoreVertical, Edit, Trash2, Mail, Phone, Search } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'

const defaultForm: MemberInput = {
  name: '',
  role: '',
  email: '',
  phone: '',
  avatarUrl: null,
  color: colorPresets[0].value,
}

export default function TeamPage() {
  const { members, loading, createMember, updateMember, deleteMember } = useMembers()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [form, setForm] = useState<MemberInput>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [fetchingAvatar, setFetchingAvatar] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const lookupAvatar = useCallback(async (email: string) => {
    if (!email || !email.includes('@') || !email.includes('.')) return
    setFetchingAvatar(true)
    try {
      const res = await fetch(`/api/avatar-lookup?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      if (data.avatarUrl) {
        setForm((prev) => ({ ...prev, avatarUrl: data.avatarUrl }))
      }
    } catch {
      // Silently fail — avatar lookup is best-effort
    } finally {
      setFetchingAvatar(false)
    }
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleEmailChange = (email: string) => {
    setForm((prev) => ({ ...prev, email }))

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Auto-lookup after 600ms of no typing, only if looks like a valid email
    if (email && email.includes('@') && email.includes('.')) {
      debounceRef.current = setTimeout(() => {
        lookupAvatar(email)
      }, 600)
    }
  }

  const openCreate = () => {
    setEditingMember(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (member: Member) => {
    setEditingMember(member)
    setForm({
      name: member.name,
      role: member.role,
      email: member.email,
      phone: member.phone,
      avatarUrl: member.avatarUrl,
      color: member.color,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingMember) {
        await updateMember(editingMember.id, form)
      } else {
        await createMember(form)
      }
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteMember(deleteTarget.id)
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </div>

      {/* Members Grid */}
      {members.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No team members yet</p>
          <p className="text-sm mt-1">Add your first team member to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {members.map((member) => (
            <Card key={member.id} className="group relative overflow-hidden">
              {/* Full-width avatar banner */}
              <div
                className="h-28 flex items-center justify-center relative"
                style={{ backgroundColor: member.color + '20' }}
              >
                <MemberAvatar member={member} size="lg" className="h-20 w-20 text-2xl" />
                {/* Actions dropdown */}
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/60 backdrop-blur-sm hover:bg-background/80">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(member)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(member)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {/* Info below avatar */}
              <CardContent className="p-4 text-center">
                <h3 className="font-semibold truncate">{member.name}</h3>
                {member.role && (
                  <p className="text-sm text-muted-foreground truncate">{member.role}</p>
                )}
                <div className="mt-2 space-y-1">
                  {member.email && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{member.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Member' : 'Add Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Avatar preview */}
            <div className="flex justify-center">
              <MemberAvatar
                member={{
                  id: '',
                  name: form.name || 'M',
                  role: form.role,
                  email: form.email,
                  phone: form.phone,
                  avatarUrl: form.avatarUrl,
                  color: form.color,
                  createdAt: Timestamp.now(),
                }}
                size="lg"
                className="h-16 w-16 text-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                placeholder="e.g. Frontend Developer"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex gap-2 items-stretch">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 px-3"
                  disabled={fetchingAvatar || !form.email}
                  onClick={() => lookupAvatar(form.email)}
                  title="Look up avatar from email"
                >
                  {fetchingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Avatar auto-detected from Gravatar when available
              </p>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <PhoneInput
                value={form.phone}
                onChange={(value) => setForm({ ...form, phone: value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Avatar URL</Label>
              <Input
                placeholder="https://... (auto-filled from email if found)"
                value={form.avatarUrl || ''}
                onChange={(e) => setForm({ ...form, avatarUrl: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className="h-8 w-8 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: preset.value,
                      borderColor: form.color === preset.value ? 'white' : 'transparent',
                      boxShadow: form.color === preset.value ? `0 0 0 2px ${preset.value}` : 'none',
                    }}
                    onClick={() => setForm({ ...form, color: preset.value })}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingMember ? 'Save' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{deleteTarget?.name}&quot; from the team?
              Their existing task assignments will remain but show as unresolved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
