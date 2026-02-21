'use client'

import { useState, useEffect, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { members as membersApi } from '@/lib/firestore'
import { Member, MemberInput } from '@/types'
import { useToast } from './useToast'

export function useMembers() {
  const [data, setData] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true)
      const result = await membersApi.getAll()
      setData(result)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch team members',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const createMember = async (input: MemberInput) => {
    try {
      const id = await membersApi.create(input)
      const newMember: Member = {
        id,
        ...input,
        createdAt: Timestamp.now(),
      }
      setData((prev) => [newMember, ...prev])
      toast({
        description: 'Member added',
        variant: 'success',
      })
      return id
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add member',
        variant: 'destructive',
      })
      throw new Error('Failed to add member')
    }
  }

  const updateMember = async (id: string, input: Partial<MemberInput>) => {
    const previous = data
    setData((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...input } : m))
    )

    try {
      await membersApi.update(id, input)
      toast({
        description: 'Member updated',
        variant: 'success',
      })
    } catch {
      setData(previous)
      toast({
        title: 'Error',
        description: 'Failed to update member',
        variant: 'destructive',
      })
      throw new Error('Failed to update member')
    }
  }

  const deleteMember = async (id: string) => {
    const previous = data
    setData((prev) => prev.filter((m) => m.id !== id))

    try {
      await membersApi.delete(id)
      toast({
        description: 'Member removed',
        variant: 'success',
      })
    } catch {
      setData(previous)
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'destructive',
      })
      throw new Error('Failed to remove member')
    }
  }

  return {
    members: data,
    loading,
    refetch: fetchMembers,
    createMember,
    updateMember,
    deleteMember,
  }
}
