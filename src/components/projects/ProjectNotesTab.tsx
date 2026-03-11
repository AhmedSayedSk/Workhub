'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { useProjectNotes } from '@/hooks/useProjectNotes'
import { useAuth } from '@/hooks/useAuth'
import { NoteColor, ProjectNote } from '@/types'
import { formatRelativeTime } from '@/lib/utils'
import {
  Plus,
  Pin,
  PinOff,
  MoreVertical,
  Pencil,
  Trash2,
  StickyNote,
  Loader2,
  Check,
  X,
} from 'lucide-react'

const NOTE_COLORS: { value: NoteColor; label: string; bg: string; border: string }[] = [
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/30' },
  { value: 'green', label: 'Green', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-50 dark:bg-pink-500/10', border: 'border-pink-200 dark:border-pink-500/30' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/30' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30' },
]

const COLOR_DOT: Record<NoteColor, string> = {
  yellow: 'bg-yellow-400',
  green: 'bg-green-400',
  blue: 'bg-blue-400',
  pink: 'bg-pink-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
}

interface ProjectNotesTabProps {
  projectId: string
}

export function ProjectNotesTab({ projectId }: ProjectNotesTabProps) {
  const { notes, loading, createNote, updateNote, deleteNote, togglePin } = useProjectNotes(projectId)
  const { user } = useAuth()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<ProjectNote | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectNote | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    content: '',
    color: 'yellow' as NoteColor,
    pinned: false,
    tags: '',
  })

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach(n => n.tags?.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [notes])

  const filteredNotes = useMemo(() => {
    if (!selectedTag) return notes
    return notes.filter(n => n.tags?.includes(selectedTag))
  }, [notes, selectedTag])

  const openCreate = () => {
    setEditingNote(null)
    setForm({ title: '', content: '', color: 'yellow', pinned: false, tags: '' })
    setIsDialogOpen(true)
  }

  const openEdit = (note: ProjectNote) => {
    setEditingNote(note)
    setForm({
      title: note.title,
      content: note.content,
      color: note.color,
      pinned: note.pinned,
      tags: note.tags?.join(', ') || '',
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    setIsSubmitting(true)
    try {
      const tags = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      if (editingNote) {
        await updateNote(editingNote.id, {
          title: form.title,
          content: form.content,
          color: form.color,
          pinned: form.pinned,
          tags,
        })
      } else {
        await createNote({
          projectId,
          title: form.title,
          content: form.content,
          color: form.color,
          pinned: form.pinned,
          tags,
          authorId: user?.uid || '',
          authorName: user?.displayName || 'Unknown',
        })
      }
      setIsDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteNote(deleteTarget.id)
    setDeleteTarget(null)
  }

  const getColorConfig = (color: NoteColor) =>
    NOTE_COLORS.find(c => c.value === color) || NOTE_COLORS[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {allTags.length > 0 && (
            <>
              <Badge
                variant={selectedTag === null ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedTag(null)}
              >
                All
              </Badge>
              {allTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </>
          )}
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="mb-1">No notes yet</p>
          <p className="text-sm mb-4">Create notes to keep track of important information</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map(note => {
            const colorCfg = getColorConfig(note.color)
            return (
              <div
                key={note.id}
                className={`rounded-lg border p-4 cursor-pointer transition-shadow hover:shadow-md ${colorCfg.bg} ${colorCfg.border}`}
                onClick={() => openEdit(note)}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {note.pinned && <Pin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <h4 className="font-semibold text-sm truncate">{note.title}</h4>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => togglePin(note.id)}>
                        {note.pinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                        {note.pinned ? 'Unpin' : 'Pin'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(note)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(note)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Content preview */}
                {note.content && (
                  <div className="text-sm text-muted-foreground line-clamp-4 mb-3 prose-sm">
                    <MarkdownContent content={note.content} />
                  </div>
                )}

                {/* Footer: tags + meta */}
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <div className="flex items-center gap-1 flex-wrap min-w-0">
                    {note.tags?.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {note.tags && note.tags.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{note.tags.length - 3}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(note.updatedAt)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'New Note'}</DialogTitle>
            <DialogDescription>
              {editingNote ? 'Update your note' : 'Create a new note for this project'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title *</Label>
              <Input
                id="note-title"
                placeholder="Note title..."
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <RichTextEditor
                content={form.content}
                onChange={content => setForm({ ...form, content })}
                placeholder="Write your note..."
                minHeight="150px"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                {NOTE_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${COLOR_DOT[c.value]}`}
                    style={{
                      boxShadow: form.color === c.value
                        ? `0 0 0 2px var(--background), 0 0 0 4px currentColor`
                        : 'none',
                    }}
                    onClick={() => setForm({ ...form, color: c.value })}
                    title={c.label}
                  >
                    {form.color === c.value && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="note-pinned"
                checked={form.pinned}
                onCheckedChange={pinned => setForm({ ...form, pinned })}
              />
              <Label htmlFor="note-pinned" className="cursor-pointer">Pin to top</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note-tags">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
              <Input
                id="note-tags"
                placeholder="e.g., design, urgent, idea"
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !form.title.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingNote ? 'Save Changes' : 'Create Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null) }}
        title="Delete Note"
        description={<>Are you sure you want to delete <span className="font-semibold">{deleteTarget?.title}</span>? This action cannot be undone.</>}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
