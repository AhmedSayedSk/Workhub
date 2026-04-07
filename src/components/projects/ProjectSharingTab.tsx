'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import { userProfiles, projects as projectsApi, members as membersApi } from '@/lib/firestore'
import { Project, UserProfile, Member } from '@/types'
import {
  Users,
  UserPlus,
  Loader2,
  X,
  Shield,
  Crown,
  Mail,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ProjectSharingTabProps {
  project: Project
  onUpdate: () => void
}

export function ProjectSharingTab({ project, onUpdate }: ProjectSharingTabProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<UserProfile | null>(null)
  const [confirmRemovePending, setConfirmRemovePending] = useState<string | null>(null)
  const [sharedUsers, setSharedUsers] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const isOwner = user?.uid === project.ownerId

  const loadSharedUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const profiles = await userProfiles.getByUids(project.sharedWith || [])
      setSharedUsers(profiles)
    } catch {
      // ignore
    } finally {
      setLoadingUsers(false)
    }
  }, [project.sharedWith])

  useEffect(() => {
    loadSharedUsers()
  }, [loadSharedUsers])

  // Load all team members for the dropdown
  useEffect(() => {
    membersApi.getAll().then(setAllMembers).catch(() => {})
  }, [])

  // Map email → Member for avatar lookups
  const memberByEmail = useMemo(() => {
    const map = new Map<string, Member>()
    for (const m of allMembers) map.set(m.email.toLowerCase(), m)
    return map
  }, [allMembers])

  // Find the owner's member record for their avatar
  const ownerMember = useMemo(() => {
    return user?.email ? memberByEmail.get(user.email.toLowerCase()) : undefined
  }, [user?.email, memberByEmail])

  // Filter out owner, already-shared, and pending members
  const availableMembers = useMemo(() => {
    const sharedEmails = new Set(sharedUsers.map((u) => u.email.toLowerCase()))
    const pendingEmails = new Set((project.pendingSharedEmails || []).map((e) => e.toLowerCase()))
    const ownerEmail = user?.email?.toLowerCase()
    return allMembers.filter((m) => {
      const email = m.email.toLowerCase()
      return email !== ownerEmail && !sharedEmails.has(email) && !pendingEmails.has(email)
    })
  }, [allMembers, sharedUsers, user?.email, project.pendingSharedEmails])

  const handleAddMember = async (member: Member) => {
    setDropdownOpen(false)
    setAdding(true)
    try {
      const email = member.email.toLowerCase()

      // Check if already pending
      if (project.pendingSharedEmails?.includes(email)) {
        toast({ title: 'Already invited', description: 'This member has a pending invite.', variant: 'destructive' })
        return
      }

      // Look up the member's Firebase profile by email
      const profile = await userProfiles.findByEmail(email)

      if (profile) {
        // User has an account — add their UID directly
        if (project.sharedWith?.includes(profile.uid)) {
          toast({ title: 'Already shared', description: 'This member already has access.', variant: 'destructive' })
          return
        }
        const newSharedWith = [...(project.sharedWith || []), profile.uid]
        await projectsApi.updateSharing(project.id, newSharedWith, project.ownerId)
        onUpdate()
        toast({ description: `Shared with ${member.name}` })
      } else {
        // No account yet — add as pending invite by email
        const newPending = [...(project.pendingSharedEmails || []), email]
        await projectsApi.update(project.id, { pendingSharedEmails: newPending })
        onUpdate()
        toast({ description: `${member.name} invited. Access will be granted when they sign in.` })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to share project', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (uid: string) => {
    setRemoving(uid)
    try {
      const newSharedWith = (project.sharedWith || []).filter((id) => id !== uid)
      await projectsApi.updateSharing(project.id, newSharedWith, project.ownerId)
      setConfirmRemove(null)
      onUpdate()
      toast({ description: 'Access removed' })
    } catch {
      toast({ title: 'Error', description: 'Failed to remove access', variant: 'destructive' })
    } finally {
      setRemoving(null)
    }
  }

  const handleRemovePending = async (email: string) => {
    setRemoving(email)
    try {
      const newPending = (project.pendingSharedEmails || []).filter((e) => e !== email)
      await projectsApi.update(project.id, { pendingSharedEmails: newPending })
      setConfirmRemovePending(null)
      onUpdate()
      toast({ description: 'Invite cancelled' })
    } catch {
      toast({ title: 'Error', description: 'Failed to cancel invite', variant: 'destructive' })
    } finally {
      setRemoving(null)
    }
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Shield className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">Only the project owner can manage sharing</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add member */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Share with a team member
        </Label>
        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={dropdownOpen}
              className="w-full justify-between font-normal text-muted-foreground"
              disabled={adding}
            >
              {adding ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </span>
              ) : (
                'Select a team member...'
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search members..." />
              <CommandList>
                <CommandEmpty>
                  {allMembers.length === 0
                    ? 'No team members found. Add members in the Team page first.'
                    : 'No matching members available to share with.'}
                </CommandEmpty>
                <CommandGroup>
                  {availableMembers.map((member) => (
                    <CommandItem
                      key={member.id}
                      value={`${member.name} ${member.email}`}
                      onSelect={() => handleAddMember(member)}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <MemberAvatar member={member} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{member.role}</Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          Select from your team members. They must have a WorkHub account to access the project.
        </p>
      </div>

      <Separator />

      {/* Current access list */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          People with access
        </Label>

        <div className="space-y-2">
          {/* Owner */}
          <Card>
            <CardContent className="flex items-center gap-3 py-3 px-4">
              {ownerMember ? (
                <MemberAvatar member={ownerMember} />
              ) : (
                <Avatar className="h-8 w-8">
                  {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'Owner'} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    <Crown className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.displayName || 'You'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">Owner</Badge>
            </CardContent>
          </Card>

          {/* Shared users */}
          {loadingUsers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : sharedUsers.length === 0 && !(project.pendingSharedEmails?.length) ? (
            <div className="text-center py-6 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No one else has access to this project yet</p>
            </div>
          ) : (
            <>
            {sharedUsers.map((profile) => {
              const member = memberByEmail.get(profile.email.toLowerCase())
              return (
              <Card key={profile.uid}>
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  {member ? (
                    <MemberAvatar member={member} />
                  ) : (
                    <Avatar className="h-8 w-8">
                      {profile.photoURL && <AvatarImage src={profile.photoURL} alt={profile.displayName || profile.email} />}
                      <AvatarFallback className="bg-muted text-xs font-medium">
                        {(profile.displayName || profile.email)?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {profile.displayName || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">Member</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmRemove(profile)}
                    disabled={removing === profile.uid}
                  >
                    {removing === profile.uid ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </CardContent>
              </Card>
              )
            })}

            {/* Pending invites */}
            {(project.pendingSharedEmails || []).map((email) => {
              const member = memberByEmail.get(email.toLowerCase())
              return (
                <Card key={email} className="border-dashed">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    {member ? (
                      <MemberAvatar member={member} className="opacity-60" />
                    ) : (
                      <Avatar className="h-8 w-8 opacity-60">
                        <AvatarFallback className="bg-muted text-xs font-medium">
                          {email[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-muted-foreground">
                        {member?.name || email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{member ? email : 'Pending sign-in'}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-amber-600 border-amber-300">Pending</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmRemovePending(email)}
                      disabled={removing === email}
                    >
                      {removing === email ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
            </>
          )}
        </div>
      </div>

      {/* Remove confirmation */}
      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title="Remove access"
        description={`Remove "${confirmRemove?.displayName || confirmRemove?.email}" from this project? They will no longer be able to view or edit anything in it.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => {
          if (confirmRemove) await handleRemove(confirmRemove.uid)
        }}
      />

      {/* Cancel pending invite confirmation */}
      <ConfirmDialog
        open={!!confirmRemovePending}
        onOpenChange={(open) => !open && setConfirmRemovePending(null)}
        title="Cancel invite"
        description={`Cancel the pending invite for "${confirmRemovePending}"?`}
        confirmLabel="Cancel invite"
        variant="destructive"
        onConfirm={async () => {
          if (confirmRemovePending) await handleRemovePending(confirmRemovePending)
        }}
      />
    </div>
  )
}
