'use client'

import { useState, useEffect, useCallback } from 'react'
import { projectNotes, audit } from '@/lib/firestore'
import { ProjectNote, ProjectNoteInput } from '@/types'
import { toast } from 'react-toastify'
import { useAuth } from '@/hooks/useAuth'

export function useProjectNotes(projectId: string) {
  const [notes, setNotes] = useState<ProjectNote[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true)
      const result = await projectNotes.getByProject(projectId)
      setNotes(result)
    } catch {
      // Silently fail on fetch
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      fetchNotes()
    }
  }, [projectId, fetchNotes])

  const createNote = useCallback(async (data: ProjectNoteInput) => {
    try {
      const id = await projectNotes.create(data)
      audit({ type: 'note', action: 'created', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId: data.projectId, targetId: id, targetName: data.title })
      await fetchNotes()
      toast.info('Note created')
    } catch {
      toast.error('Failed to create note')
    }
  }, [fetchNotes, user])

  const updateNote = useCallback(async (id: string, data: Partial<ProjectNoteInput>) => {
    try {
      await projectNotes.update(id, data)
      const existing = notes.find(n => n.id === id)
      audit({ type: 'note', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId: existing?.projectId || projectId, targetId: id, targetName: data.title || existing?.title })
      await fetchNotes()
      toast.info('Note updated')
    } catch {
      toast.error('Failed to update note')
    }
  }, [fetchNotes, notes, projectId, user])

  const deleteNote = useCallback(async (id: string) => {
    const previous = notes
    const existing = notes.find(n => n.id === id)
    setNotes(prev => prev.filter(n => n.id !== id))
    try {
      await projectNotes.delete(id)
      audit({ type: 'note', action: 'deleted', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId: existing?.projectId || projectId, targetId: id, targetName: existing?.title })
      toast.info('Note deleted')
    } catch {
      setNotes(previous)
      toast.error('Failed to delete note')
    }
  }, [notes, projectId, user])

  const togglePin = useCallback(async (id: string) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    try {
      await projectNotes.update(id, { pinned: !note.pinned })
      await fetchNotes()
    } catch {
      toast.error('Failed to update note')
    }
  }, [notes, fetchNotes])

  return { notes, loading, createNote, updateNote, deleteNote, togglePin, refetch: fetchNotes }
}
