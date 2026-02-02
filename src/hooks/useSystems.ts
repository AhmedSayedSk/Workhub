'use client'

import { useState, useEffect, useCallback } from 'react'
import { systems } from '@/lib/firestore'
import { System, SystemInput } from '@/types'
import { useToast } from './useToast'

export function useSystems(organizationId?: string) {
  const [data, setData] = useState<System[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  const fetchSystems = useCallback(async () => {
    try {
      setLoading(true)
      const result = await systems.getAll(organizationId)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
      toast({
        title: 'Error',
        description: 'Failed to fetch systems',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [organizationId, toast])

  useEffect(() => {
    fetchSystems()
  }, [fetchSystems])

  const createSystem = async (input: Omit<SystemInput, 'organizationId'>) => {
    try {
      const id = await systems.create({
        ...input,
        organizationId: organizationId || 'default',
      })
      await fetchSystems()
      toast({
        title: 'Success',
        description: 'System created successfully',
      })
      return id
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create system',
        variant: 'destructive',
      })
      throw err
    }
  }

  const updateSystem = async (id: string, input: Partial<SystemInput>) => {
    try {
      await systems.update(id, input)
      await fetchSystems()
      toast({
        title: 'Success',
        description: 'System updated successfully',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update system',
        variant: 'destructive',
      })
      throw err
    }
  }

  const deleteSystem = async (id: string) => {
    try {
      await systems.delete(id)
      await fetchSystems()
      toast({
        title: 'Success',
        description: 'System deleted successfully',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete system',
        variant: 'destructive',
      })
      throw err
    }
  }

  return {
    systems: data,
    loading,
    error,
    refetch: fetchSystems,
    createSystem,
    updateSystem,
    deleteSystem,
  }
}
