'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { authFetch } from '@/lib/api-client'
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { colorPresets } from '@/lib/utils'
import { Plus, Loader2, MoreVertical, Edit, Trash2, Mail, Phone, Search, ShieldAlert, Eye, EyeOff, KeyRound, RefreshCw, Copy, Check } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/hooks/useToast'
import { userProfiles } from '@/lib/firestore'
import { MemberPermissionsEditor, BufferedPermissions } from '@/components/members/MemberPermissionsEditor'
import { memberPermissions as memberPermsApi, projects as projectsApi } from '@/lib/firestore'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const defaultForm: MemberInput = {
  name: '',
  role: '',
  email: '',
  phone: '',
  avatarUrl: null,
  color: colorPresets[0].value,
}

export default function TeamPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)
  const { toast } = useToast()
  const { members, loading, createMember, updateMember, deleteMember } = useMembers()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [form, setForm] = useState<MemberInput>(defaultForm)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editMemberUid, setEditMemberUid] = useState<string | null>(null)
  const [fetchingAvatar, setFetchingAvatar] = useState(false)
  const [bufferedPerms, setBufferedPerms] = useState<BufferedPermissions | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const lookupAvatar = useCallback(async (email: string) => {
    if (!email || !email.includes('@') || !email.includes('.')) return
    setFetchingAvatar(true)
    try {
      const res = await authFetch(`/api/avatar-lookup?email=${encodeURIComponent(email)}`)
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

  const generatePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$'
    let pwd = ''
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
    setPassword(pwd)
    setShowPassword(true)
    setPasswordCopied(false)
  }

  const copyPassword = async () => {
    await navigator.clipboard.writeText(password)
    setPasswordCopied(true)
    setTimeout(() => setPasswordCopied(false), 2000)
  }

  const handleResetPassword = async () => {
    if (!editingMember?.email || !password || password.length < 6) return
    setResettingPassword(true)
    try {
      const res = await authFetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editingMember.email, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }
      toast({ description: `Password updated for ${editingMember.name}` })
      setPassword('')
      setShowPassword(false)
    } catch {
      toast({ title: 'Error', description: 'Failed to reset password', variant: 'destructive' })
    } finally {
      setResettingPassword(false)
    }
  }

  const openCreate = () => {
    setEditingMember(null)
    setForm(defaultForm)
    setPassword('')
    setShowPassword(false)
    setBufferedPerms(null)
    setDialogOpen(true)
  }

  const openEdit = async (member: Member) => {
    setEditingMember(member)
    setForm({
      name: member.name,
      role: member.role,
      email: member.email,
      phone: member.phone,
      avatarUrl: member.avatarUrl,
      color: member.color,
    })
    setPassword('')
    setShowPassword(false)
    setPasswordCopied(false)
    setEditMemberUid(null)
    setDialogOpen(true)

    // Look up Firebase UID for this member
    if (member.email) {
      const profile = await userProfiles.findByEmail(member.email).catch(() => null)
      setEditMemberUid(profile?.uid || null)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return

    // Validate password for new members
    if (!editingMember) {
      if (!form.email.trim()) {
        toast({ title: 'Email required', description: 'Team members need an email to log in.', variant: 'destructive' })
        return
      }
      if (!password || password.length < 6) {
        toast({ title: 'Password too short', description: 'Password must be at least 6 characters.', variant: 'destructive' })
        return
      }
    }

    setSaving(true)
    try {
      if (editingMember) {
        await updateMember(editingMember.id, form)
      } else {
        // Create Firebase Auth account first
        const res = await authFetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            password,
            displayName: form.name,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast({ title: 'Error', description: data.error || 'Failed to create account', variant: 'destructive' })
          return
        }

        // Create the member record
        const newMemberId = await createMember(form)

        // Apply buffered permissions if any were set
        if (bufferedPerms && data.uid && newMemberId) {
          const uid = data.uid as string
          const mid = newMemberId as string

          // Apply module permissions
          const hasModuleChanges = Object.values(bufferedPerms.modulePerms).some(v => v)
          if (hasModuleChanges) {
            await memberPermsApi.setModulePermissions(mid, uid, bufferedPerms.modulePerms)
          }

          // Apply project permissions and sharing
          for (const projectId of bufferedPerms.enabledProjects) {
            const perms = bufferedPerms.projectPerms[projectId]
            if (perms) {
              await memberPermsApi.setProjectPermissions(mid, uid, projectId, perms)
              // Add uid to project sharedWith
              await updateDoc(doc(db, 'projects', projectId), {
                sharedWith: arrayUnion(uid),
              }).catch(() => {})
            }
          }
        }

        toast({ description: `${form.name} added with login access.` })
      }
      setDialogOpen(false)
    } catch {
      toast({ title: 'Error', description: 'Failed to save member', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteMember(deleteTarget.id)
    setDeleteTarget(null)
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAppOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm">Only the workspace owner can manage team members.</p>
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
        <DialogContent className="max-w-4xl max-h-[92vh] h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Member' : 'Add Member'}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="permissions" className="flex-1">Permissions</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
              <MemberFormFields
                form={form} setForm={setForm} editingMember={editingMember}
                handleEmailChange={handleEmailChange} lookupAvatar={lookupAvatar}
                fetchingAvatar={fetchingAvatar}
                password={password} setPassword={setPassword}
                showPassword={showPassword} setShowPassword={setShowPassword}
                passwordCopied={passwordCopied}
                generatePassword={generatePassword} copyPassword={copyPassword}
                handleResetPassword={handleResetPassword} resettingPassword={resettingPassword}
                saving={saving} handleSave={handleSave}
                onClose={() => setDialogOpen(false)}
              />
            </TabsContent>
            <TabsContent value="permissions" className="flex-1 overflow-y-auto mt-4">
              {editingMember ? (
                <MemberPermissionsEditor
                  member={editingMember}
                  memberUid={editMemberUid}
                  ownerUid={user!.uid}
                />
              ) : (
                <MemberPermissionsEditor
                  member={{ id: '', name: form.name || 'New Member', role: form.role, email: form.email, phone: form.phone, avatarUrl: form.avatarUrl, color: form.color, createdAt: Timestamp.now() }}
                  memberUid={null}
                  ownerUid={user!.uid}
                  buffered
                  onBufferedChange={setBufferedPerms}
                />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Member"
        description={`Are you sure you want to remove "${deleteTarget?.name}" from the team? Their existing task assignments will remain but show as unresolved.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  )
}

/* Extracted form fields component */
function MemberFormFields({
  form, setForm, editingMember,
  handleEmailChange, lookupAvatar, fetchingAvatar,
  password, setPassword, showPassword, setShowPassword,
  passwordCopied, generatePassword, copyPassword,
  handleResetPassword, resettingPassword,
  saving, handleSave, onClose,
}: {
  form: MemberInput
  setForm: (f: MemberInput) => void
  editingMember: Member | null
  handleEmailChange: (email: string) => void
  lookupAvatar: (email: string) => void
  fetchingAvatar: boolean
  password: string
  setPassword: (p: string) => void
  showPassword: boolean
  setShowPassword: (s: boolean) => void
  passwordCopied: boolean
  generatePassword: () => void
  copyPassword: () => void
  handleResetPassword: () => void
  resettingPassword: boolean
  saving: boolean
  handleSave: () => void
  onClose: () => void
}) {
  return (
    <div className="space-y-5">
      {/* Avatar banner with color background */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{ backgroundColor: form.color + '20' }}
      >
        <div className="flex items-center gap-5 px-5 py-4">
          <MemberAvatar
            member={{
              id: '', name: form.name || 'M', role: form.role, email: form.email,
              phone: form.phone, avatarUrl: form.avatarUrl, color: form.color, createdAt: Timestamp.now(),
            }}
            size="lg"
            className="h-20 w-20 text-2xl ring-4 ring-background shadow-lg"
          />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold truncate">{form.name || 'New Member'}</p>
            {form.role && <p className="text-sm text-muted-foreground truncate">{form.role}</p>}
            {/* Color picker inline */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {colorPresets.map((preset) => (
                <button key={preset.value} type="button" className="h-6 w-6 rounded-full border-2 transition-all hover:scale-110"
                  style={{ backgroundColor: preset.value, borderColor: form.color === preset.value ? 'white' : 'transparent', boxShadow: form.color === preset.value ? `0 0 0 2px ${preset.value}` : 'none' }}
                  onClick={() => setForm({ ...form, color: preset.value })} title={preset.name}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form fields in grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Input placeholder="e.g. Frontend Developer" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <div className="flex gap-2 items-stretch">
            <Input type="email" placeholder="email@example.com" value={form.email} onChange={(e) => handleEmailChange(e.target.value)} className="flex-1" />
            <Button type="button" variant="outline" className="shrink-0 px-3" disabled={fetchingAvatar || !form.email} onClick={() => lookupAvatar(form.email)} title="Look up avatar">
              {fetchingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <PhoneInput value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
        </div>
      </div>

      <Separator />

      {/* Password & Avatar URL in grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5" />
            {editingMember ? 'Reset Password' : 'Login Password *'}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters"
                value={password} onChange={(e) => { setPassword(e.target.value) }} className="pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={generatePassword} title="Generate password" className="shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {password && (
              <Button type="button" variant="outline" size="icon" onClick={copyPassword} title="Copy password" className="shrink-0">
                {passwordCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {editingMember ? 'Leave empty to keep current password.' : 'Used by the member to log into WorkHub.'}
          </p>
          {editingMember && password.length >= 6 && (
            <Button type="button" variant="secondary" size="sm" onClick={handleResetPassword} disabled={resettingPassword} className="w-full">
              {resettingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Update Password
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Label>Avatar URL</Label>
          <Input placeholder="https://..." value={form.avatarUrl || ''} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value || null })} />
          <p className="text-xs text-muted-foreground">Auto-detected from Gravatar when available</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {editingMember ? 'Save' : 'Add Member'}
        </Button>
      </div>
    </div>
  )
}
