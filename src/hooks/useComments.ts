'use client'

import { useState, useEffect, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { taskComments, projectLogs } from '@/lib/firestore'
import { TaskComment, TaskCommentInput, CommentParentType } from '@/types'
import { deleteFile } from '@/lib/storage'
import { useToast } from './useToast'

export function useComments(parentId?: string, parentType?: CommentParentType, projectId?: string, contextLabel?: string) {
  const [data, setData] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchComments = useCallback(async () => {
    if (!parentId || !parentType) {
      setData([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const result = await taskComments.getByParent(parentId, parentType)
      setData(result)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch comments',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [parentId, parentType, toast])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const addComment = async (input: TaskCommentInput) => {
    const optimisticComment: TaskComment = {
      id: `temp-${Date.now()}`,
      parentId: input.parentId,
      parentType: input.parentType,
      text: input.text,
      authorId: input.authorId,
      authorName: input.authorName,
      audioUrl: input.audioUrl,
      audioDuration: input.audioDuration,
      createdAt: Timestamp.now(),
    }
    setData((prev) => [...prev, optimisticComment])

    try {
      const id = await taskComments.create(input)
      setData((prev) =>
        prev.map((c) => (c.id === optimisticComment.id ? { ...c, id } : c))
      )
      if (projectId) {
        const commentPreview = input.text
          ? input.text.length > 120 ? input.text.slice(0, 120) + '...' : input.text
          : 'Voice message'
        projectLogs.create({
          projectId,
          action: 'comment_added',
          changes: [
            { field: 'comment_on', oldValue: null, newValue: contextLabel || parentType || 'comment' },
            { field: 'comment_text', oldValue: null, newValue: commentPreview },
          ],
        }).catch(() => {})
      }
    } catch {
      setData((prev) => prev.filter((c) => c.id !== optimisticComment.id))
      toast({ title: 'Error', description: 'Failed to add comment', variant: 'destructive' })
    }
  }

  const deleteComment = async (id: string, audioStoragePath?: string) => {
    const previousData = data
    const deletedComment = data.find((c) => c.id === id)
    setData((prev) => prev.filter((c) => c.id !== id))

    try {
      await taskComments.delete(id)
      if (audioStoragePath) {
        try {
          await deleteFile(audioStoragePath)
        } catch {
          // Audio file may already be deleted — not critical
        }
      }
      if (projectId) {
        const commentPreview = deletedComment?.text
          ? deletedComment.text.length > 120 ? deletedComment.text.slice(0, 120) + '...' : deletedComment.text
          : 'Voice message'
        projectLogs.create({
          projectId,
          action: 'comment_deleted',
          changes: [
            { field: 'comment_on', oldValue: null, newValue: contextLabel || parentType || 'comment' },
            { field: 'comment_text', oldValue: commentPreview, newValue: null },
          ],
        }).catch(() => {})
      }
    } catch {
      setData(previousData)
      toast({ title: 'Error', description: 'Failed to delete comment', variant: 'destructive' })
    }
  }

  return {
    comments: data,
    loading,
    addComment,
    deleteComment,
    refetch: fetchComments,
  }
}

export function useCommentCounts(parentIds: string[], parentType: CommentParentType, refreshTrigger?: number) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    if (parentIds.length === 0) {
      setCounts({})
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const allComments = await taskComments.getByParentIds(parentIds, parentType)

      const newCounts: Record<string, number> = {}
      allComments.forEach((comment) => {
        newCounts[comment.parentId] = (newCounts[comment.parentId] || 0) + 1
      })

      setCounts(newCounts)
    } catch (error) {
      console.error('Failed to fetch comment counts:', error)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentIds.join(','), parentType, refreshTrigger])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  return { counts, loading, refetch: fetchCounts }
}
