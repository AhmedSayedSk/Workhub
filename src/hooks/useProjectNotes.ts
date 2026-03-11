'use client'

import { useState, useEffect, useCallback } from 'react'
import { projectNotes } from '@/lib/firestore'
import { ProjectNote, ProjectNoteInput } from '@/types'
import { toast } from 'react-toastify'

export function useProjectNotes(projectId: string) {
  const [notes, setNotes] = useState<ProjectNote[]>([])
  const [loading, setLoading] = useState(true)

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
      await projectNotes.create(data)
      await fetchNotes()
      toast.info('Note created')
    } catch {
      toast.error('Failed to create note')
    }
  }, [fetchNotes])

  const updateNote = useCallback(async (id: string, data: Partial<ProjectNoteInput>) => {
    try {
      await projectNotes.update(id, data)
      await fetchNotes()
      toast.info('Note updated')
    } catch {
      toast.error('Failed to update note')
    }
  }, [fetchNotes])

  const deleteNote = useCallback(async (id: string) => {
    const previous = notes
    setNotes(prev => prev.filter(n => n.id !== id))
    try {
      await projectNotes.delete(id)
      toast.info('Note deleted')
    } catch {
      setNotes(previous)
      toast.error('Failed to delete note')
    }
  }, [notes])

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
