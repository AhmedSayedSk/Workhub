'use client'

import { useState, useEffect, useCallback } from 'react'
import { taskComments } from '@/lib/firestore'
import { TaskComment, TaskCommentInput, CommentParentType } from '@/types'
import { deleteFile } from '@/lib/storage'
import { useToast } from './useToast'

export function useComments(parentId?: string, parentType?: CommentParentType) {
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
    try {
      await taskComments.create(input)
      await fetchComments()
    } catch {
      toast({ title: 'Error', description: 'Failed to add comment', variant: 'destructive' })
    }
  }

  const deleteComment = async (id: string, audioStoragePath?: string) => {
    const previousData = data
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
