'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from './useAuth'
import { useSettings } from './useSettings'
import { memberPermissions, DEFAULT_PROJECT_PERMISSIONS, DEFAULT_MODULE_PERMISSIONS } from '@/lib/firestore'
import { ProjectPermissions, ModulePermissions, MemberPermission } from '@/types'

/**
 * Hook to check project-level permissions for the current user.
 * Owner always has full access.
 */
export function useProjectPermissions(projectId?: string) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [perms, setPerms] = useState<ProjectPermissions>(DEFAULT_PROJECT_PERMISSIONS)
  const [loading, setLoading] = useState(true)

  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)

  useEffect(() => {
    if (!user?.uid || !projectId) {
      setLoading(false)
      return
    }

    // Owner has all permissions
    if (isAppOwner) {
      const allTrue = Object.fromEntries(
        Object.keys(DEFAULT_PROJECT_PERMISSIONS).map((k) => [k, true])
      ) as unknown as ProjectPermissions
      setPerms(allTrue)
      setLoading(false)
      return
    }

    // Fetch member permissions
    memberPermissions.getForProject(user.uid, projectId).then((doc) => {
      setPerms(doc?.permissions || DEFAULT_PROJECT_PERMISSIONS)
      setLoading(false)
    }).catch(() => {
      setPerms(DEFAULT_PROJECT_PERMISSIONS)
      setLoading(false)
    })
  }, [user?.uid, projectId, isAppOwner])

  const can = useCallback(
    (permission: keyof ProjectPermissions): boolean => {
      if (isAppOwner) return true
      return perms[permission] ?? false
    },
    [perms, isAppOwner]
  )

  return { can, permissions: perms, loading, isAppOwner }
}

/**
 * Hook to check module-level (global) permissions for the current user.
 * Owner always has full access.
 */
export function useModulePermissions() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [perms, setPerms] = useState<ModulePermissions>(DEFAULT_MODULE_PERMISSIONS)
  const [loading, setLoading] = useState(true)

  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false)
      return
    }

    if (isAppOwner) {
      const allTrue = Object.fromEntries(
        Object.keys(DEFAULT_MODULE_PERMISSIONS).map((k) => [k, true])
      ) as unknown as ModulePermissions
      setPerms(allTrue)
      setLoading(false)
      return
    }

    memberPermissions.getGlobal(user.uid).then((doc) => {
      setPerms(doc?.modules || DEFAULT_MODULE_PERMISSIONS)
      setLoading(false)
    }).catch(() => {
      setPerms(DEFAULT_MODULE_PERMISSIONS)
      setLoading(false)
    })
  }, [user?.uid, isAppOwner])

  const canModule = useCallback(
    (permission: keyof ModulePermissions): boolean => {
      if (isAppOwner) return true
      return perms[permission] ?? false
    },
    [perms, isAppOwner]
  )

  return { canModule, modules: perms, loading, isAppOwner }
}
