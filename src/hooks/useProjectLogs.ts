'use client'

import { useState, useEffect, useCallback } from 'react'
import { projectLogs } from '@/lib/firestore'
import { ProjectLog } from '@/types'
import { useToast } from './useToast'

export function useProjectLogs(projectId: string) {
  const [logs, setLogs] = useState<ProjectLog[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const result = await projectLogs.getByProject(projectId)
      setLogs(result)
    } catch {
      // Silently fail - logs are non-critical
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      fetchLogs()
    }
  }, [projectId, fetchLogs])

  const deleteLog = useCallback(async (logId: string) => {
    const previousLogs = logs
    setLogs(prev => prev.filter(l => l.id !== logId))

    try {
      await projectLogs.delete(logId)
    } catch {
      setLogs(previousLogs)
      toast({
        title: 'Error',
        description: 'Failed to delete activity log',
        variant: 'destructive',
      })
    }
  }, [logs, toast])

  return { logs, loading, refetch: fetchLogs, deleteLog }
}
