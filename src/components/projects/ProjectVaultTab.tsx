'use client'

import { useState, useRef, useMemo } from 'react'
import { useProjectVault } from '@/hooks/useProjectVault'
import { useAuth } from '@/hooks/useAuth'
import { VaultEntry, VaultEntryType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils'
import { uploadFile, generateStoragePath, deleteFile } from '@/lib/storage'
import { generateId } from '@/lib/utils'
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Lock,
  File,
  Loader2,
  Copy,
  Check,
  Download,
  Vault,
  KeyRound,
  StickyNote,
  Paperclip,
  Shield,
  ShieldCheck,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useSettings } from '@/hooks/useSettings'
import { detectBrand } from '@/lib/brand-icons'
import { BrandIcon } from '@/components/vault/BrandIcon'
import { VaultPasskeyDialog } from '@/components/vault/VaultPasskeyDialog'

interface ProjectVaultTabProps {
  projectId: string
}

const entryTypeConfig: Record<VaultEntryType, { label: string; icon: typeof FileText; color: string }> = {
  text: {
    label: 'Text Note',
    icon: StickyNote,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20',
  },
  password: {
    label: 'Sensitive Data',
    icon: KeyRound,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20',
  },
  file: {
    label: 'File',
    icon: Paperclip,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20',
  },
}

const URL_REGEX = /(https?:\/\/[^\s]+)/

function linkifyText(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return part ? <span key={i}>{part}</span> : null
  })
}

const VAULT_SESSION_DURATION = 5 * 60 * 1000 // 5 minutes

export function ProjectVaultTab({ projectId }: ProjectVaultTabProps) {
  const { user } = useAuth()
  const { entries, loading, createEntry, updateEntry, deleteEntry } = useProjectVault({ projectId })
  const { toast } = useToast()
  const { settings } = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<VaultEntry | null>(null)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Vault passkey session
  const [vaultUnlockedAt, setVaultUnlockedAt] = useState<number | null>(null)
  const [isPasskeyDialogOpen, setIsPasskeyDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const hasPasskeyProtection = !!settings?.vaultPasskey

  const isVaultLocked = () => {
    if (!hasPasskeyProtection) return true
    if (!vaultUnlockedAt) return true
    return Date.now() - vaultUnlockedAt > VAULT_SESSION_DURATION
  }

  const requirePasskey = (action: () => void) => {
    if (!hasPasskeyProtection) {
      toast({
        title: 'Passkey Required',
        description: 'Set a vault passkey first in Settings > Security to access sensitive data.',
        variant: 'destructive',
      })
      return
    }
    if (!isVaultLocked()) {
      action()
      return
    }
    setPendingAction(() => action)
    setIsPasskeyDialogOpen(true)
  }

  const handlePasskeyVerified = () => {
    setVaultUnlockedAt(Date.now())
    setIsPasskeyDialogOpen(false)
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
  }

  const handlePasskeyCancel = () => {
    setIsPasskeyDialogOpen(false)
    setPendingAction(null)
  }

  const [formData, setFormData] = useState({
    type: 'text' as VaultEntryType,
    label: '',
    key: '',
    value: '',
  })

  const resetForm = () => {
    setFormData({
      type: 'text',
      label: '',
      key: '',
      value: '',
    })
  }

  const handleOpenAdd = (type: VaultEntryType) => {
    resetForm()
    setFormData((prev) => ({ ...prev, type }))
    if (type === 'file') {
      fileInputRef.current?.click()
    } else {
      setIsAddDialogOpen(true)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.uid) return

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    setIsUploading(true)

    try {
      const fileId = generateId()
      const storagePath = `vault/${user.uid}/${projectId}/${fileId}/${file.name}`

      const result = await uploadFile(file, storagePath)

      await createEntry({
        type: 'file',
        label: file.name,
        value: result.url,
        fileName: file.name,
        fileSize: result.size,
        storagePath,
      })
    } catch (error) {
      console.error('Failed to upload file:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleAdd = async () => {
    if (!formData.label.trim() || !formData.value.trim()) return

    setIsSubmitting(true)
    try {
      await createEntry({
        type: formData.type,
        label: formData.label,
        ...(formData.type === 'password' && formData.key.trim() ? { key: formData.key.trim() } : {}),
        value: formData.value,
      })
      setIsAddDialogOpen(false)
      resetForm()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEdit = (entry: VaultEntry) => {
    if (entry.type === 'password') {
      const doOpen = () => {
        setSelectedEntry(entry)
        setFormData({
          type: entry.type,
          label: entry.label,
          key: entry.key || '',
          value: entry.value,
        })
        setIsEditDialogOpen(true)
      }
      requirePasskey(doOpen)
      return
    }
    setSelectedEntry(entry)
    setFormData({
      type: entry.type,
      label: entry.label,
      key: entry.key || '',
      value: entry.value,
    })
    setIsEditDialogOpen(true)
  }

  const handleEdit = async () => {
    if (!selectedEntry || !formData.label.trim()) return

    setIsSubmitting(true)
    try {
      await updateEntry(selectedEntry.id, {
        label: formData.label,
        ...(selectedEntry.type === 'password' ? { key: formData.key.trim() || undefined } : {}),
        value: formData.value,
      })
      setIsEditDialogOpen(false)
      setSelectedEntry(null)
      resetForm()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenDelete = (entry: VaultEntry) => {
    setSelectedEntry(entry)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedEntry) return

    setIsSubmitting(true)
    try {
      const storagePath = await deleteEntry(selectedEntry.id)

      // Delete from storage if it's a file
      if (storagePath) {
        try {
          await deleteFile(storagePath)
        } catch (error) {
          console.error('Failed to delete file from storage:', error)
        }
      }

      setIsDeleteDialogOpen(false)
      setSelectedEntry(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const togglePasswordVisibility = (entryId: string) => {
    const doToggle = () => {
      setVisiblePasswords((prev) => {
        const next = new Set(prev)
        if (next.has(entryId)) {
          next.delete(entryId)
        } else {
          next.add(entryId)
        }
        return next
      })
    }

    // Only require passkey when revealing (not hiding)
    if (!visiblePasswords.has(entryId)) {
      requirePasskey(doToggle)
    } else {
      doToggle()
    }
  }

  const copyToClipboard = async (entryId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(entryId)
      setTimeout(() => setCopiedId(null), 2000)
      toast({
        title: 'Copied',
        description: 'Value copied to clipboard',
        variant: 'success',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      })
    }
  }

  const protectedCopy = (entryId: string, value: string) => {
    requirePasskey(() => copyToClipboard(entryId, value))
  }

  const handleDownload = (entry: VaultEntry) => {
    if (entry.type === 'file' && entry.value) {
      window.open(entry.value, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Project Vault
                {hasPasskeyProtection && (
                  isVaultLocked() ? (
                    <Shield className="h-4 w-4 text-amber-500" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                  )
                )}
              </CardTitle>
              <CardDescription>
                Store sensitive data, notes, and files specific to this project
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isUploading}>
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Entry
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleOpenAdd('text')}>
                  <StickyNote className="h-4 w-4 mr-2" />
                  Text Note
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenAdd('password')}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Sensitive Data
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenAdd('file')}>
                  <Paperclip className="h-4 w-4 mr-2" />
                  Upload File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No entries yet</p>
              <p className="text-sm">Add notes, passwords, or files to your project vault</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const config = entryTypeConfig[entry.type]
                const Icon = config.icon
                const isPasswordVisible = visiblePasswords.has(entry.id)
                const brand = detectBrand(entry.label)

                const defaultIcon = (
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', config.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                )

                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    {/* Icon */}
                    {brand ? (
                      <BrandIcon brand={brand} fallback={defaultIcon} />
                    ) : (
                      defaultIcon
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{entry.label}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </div>

                      {entry.type === 'text' && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                          {linkifyText(entry.value)}
                        </p>
                      )}

                      {entry.type === 'password' && (
                        <div className="space-y-1.5">
                          {entry.key && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Key:</span>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                {entry.key}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => protectedCopy(`${entry.id}-key`, entry.key!)}
                              >
                                {copiedId === `${entry.id}-key` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                              {isPasswordVisible ? entry.value : '••••••••••••'}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => togglePasswordVisibility(entry.id)}
                            >
                              {isPasswordVisible ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => protectedCopy(entry.id, entry.value)}
                            >
                              {copiedId === entry.id ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {entry.type === 'file' && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {entry.fileName}
                          </span>
                          {entry.fileSize && (
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(entry.fileSize)})
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => handleDownload(entry)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {entry.type !== 'file' && (
                          <DropdownMenuItem onClick={() => handleOpenEdit(entry)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {entry.type === 'file' && (
                          <DropdownMenuItem onClick={() => handleDownload(entry)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleOpenDelete(entry)}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {formData.type === 'password' ? 'Sensitive Data' : 'Text Note'}
            </DialogTitle>
            <DialogDescription>
              {formData.type === 'password'
                ? 'Store sensitive information like passwords or API keys'
                : 'Add a text note to your project vault'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                placeholder={formData.type === 'password' ? 'e.g., API Key, Admin Password' : 'e.g., Server Notes'}
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            {formData.type === 'password' && (
              <div className="space-y-2">
                <Label>Key</Label>
                <Input
                  placeholder="e.g., API_KEY, DB_PASSWORD"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>{formData.type === 'password' ? 'Value *' : 'Content *'}</Label>
              {formData.type === 'password' ? (
                <Input
                  type="text"
                  placeholder="Enter the sensitive value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              ) : (
                <Textarea
                  placeholder="Enter your notes..."
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  rows={4}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isSubmitting || !formData.label.trim() || !formData.value.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
            <DialogDescription>Update the vault entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            {formData.type === 'password' && (
              <div className="space-y-2">
                <Label>Key</Label>
                <Input
                  placeholder="e.g., API_KEY, DB_PASSWORD"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>{formData.type === 'password' ? 'Value *' : 'Content *'}</Label>
              {formData.type === 'password' ? (
                <Input
                  type="text"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              ) : (
                <Textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  rows={4}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isSubmitting || !formData.label.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedEntry?.label}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vault Passkey Dialog */}
      {hasPasskeyProtection && (
        <VaultPasskeyDialog
          open={isPasskeyDialogOpen}
          storedHash={settings!.vaultPasskey!}
          onVerified={handlePasskeyVerified}
          onCancel={handlePasskeyCancel}
        />
      )}
    </div>
  )
}
