'use client'

import { useState, useEffect, useCallback } from 'react'
import { vaultEntries, projectLogs, audit } from '@/lib/firestore'
import { VaultEntry, VaultEntryInput, VaultEntryType } from '@/types'
import { useToast } from './useToast'
import { useAuth } from './useAuth'

interface UseProjectVaultOptions {
  projectId: string
}

export function useProjectVault({ projectId }: UseProjectVaultOptions) {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user } = useAuth()

  const fetchEntries = useCallback(async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const data = await vaultEntries.getByProject(projectId)
      setEntries(data)
    } catch (error) {
      console.error('Failed to fetch vault entries:', error)
      toast({
        title: 'Error',
        description: 'Failed to load vault entries',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const createEntry = useCallback(
    async (data: Omit<VaultEntryInput, 'projectId'>) => {
      try {
        await vaultEntries.create({
          ...data,
          projectId,
        })
        audit({ type: 'vault', action: 'created', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, targetName: data.label })
        await fetchEntries()
        toast({
          description: 'Entry added to vault',
          variant: 'success',
        })
        projectLogs.create({
          projectId,
          action: 'vault_entry_added',
          changes: [{ field: 'vault', oldValue: null, newValue: data.label }],
        }).catch(() => {})
      } catch (error) {
        console.error('Failed to create vault entry:', error)
        toast({
          title: 'Error',
          description: 'Failed to add entry',
          variant: 'destructive',
        })
        throw error
      }
    },
    [projectId, fetchEntries, toast]
  )

  const updateEntry = useCallback(
    async (id: string, data: Partial<VaultEntryInput>) => {
      try {
        await vaultEntries.update(id, data)
        audit({ type: 'vault', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, targetId: id })
        await fetchEntries()
        toast({
          description: 'Entry updated',
          variant: 'success',
        })
      } catch (error) {
        console.error('Failed to update vault entry:', error)
        toast({
          title: 'Error',
          description: 'Failed to update entry',
          variant: 'destructive',
        })
        throw error
      }
    },
    [fetchEntries, toast]
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id)
      try {
        // If it's a file entry, we should also delete from storage
        // But we'll handle that in the component level
        await vaultEntries.delete(id)
        audit({ type: 'vault', action: 'deleted', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, targetId: id, targetName: entry?.label })
        await fetchEntries()
        toast({
          description: 'Entry deleted',
          variant: 'success',
        })
        if (entry) {
          projectLogs.create({
            projectId,
            action: 'vault_entry_deleted',
            changes: [{ field: 'vault', oldValue: entry.label, newValue: null }],
          }).catch(() => {})
        }

        return entry?.storagePath || null
      } catch (error) {
        console.error('Failed to delete vault entry:', error)
        toast({
          title: 'Error',
          description: 'Failed to delete entry',
          variant: 'destructive',
        })
        throw error
      }
    },
    [entries, fetchEntries, toast]
  )

  return {
    entries,
    loading,
    createEntry,
    updateEntry,
    deleteEntry,
    refetch: fetchEntries,
  }
}
