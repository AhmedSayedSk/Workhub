'use client'

import { useState, useCallback } from 'react'
import { authFetch } from '@/lib/api-client'
import { toast } from 'react-toastify'

export interface ConnectedAccount {
  email: string
  health: string
  error?: string
  created: string
  sessionExpires: string
  projectId: string
  projectTitle: string
  nextRefresh: string
}

export interface JobStats {
  emails: string[]
  images: {
    summary: Record<string, {
      executing: number
      completed: number
      failed: number
      rateLimited: number
      avgResponseTime: number
      score: number
    }>
    executing: Record<string, { email: string; timestamp: number; elapsed: string }>
    history: Record<string, { email: string; timestamp: number; httpStatus: number; responseTime: number }>
  }
}

// Account management for the legacy integration. The credential lives on the
// server: nothing in this hook holds, reads or sends one, and no request may
// carry a token in its body or its query string.
export function useImageApi(managed = false) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [jobs, setJobs] = useState<JobStats | null>(null)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    if (!managed) return
    setLoadingAccounts(true)
    try {
      const res = await authFetch('/api/ai/image?action=accounts')
      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      const parsed: ConnectedAccount[] = Object.entries(result.data).map(([email, info]: [string, unknown]) => {
        const acc = info as Record<string, unknown>
        const sessionData = acc.sessionData as Record<string, unknown> | undefined
        const project = acc.project as Record<string, unknown> | undefined
        const nextRefresh = acc.nextRefresh as Record<string, unknown> | undefined
        return {
          email,
          health: (acc.health as string) || 'Unknown',
          error: acc.error as string | undefined,
          created: acc.created as string || '',
          sessionExpires: (sessionData?.expires as string) || '',
          projectId: (project?.projectId as string) || '',
          projectTitle: (project?.projectTitle as string) || '',
          nextRefresh: (nextRefresh?.scheduledFor as string) || '',
        }
      })
      setAccounts(parsed)
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
      toast.error('Failed to load accounts')
    } finally {
      setLoadingAccounts(false)
    }
  }, [managed])

  const registerAccount = useCallback(async (cookies: string): Promise<{ success: boolean; error?: string }> => {
    if (!managed) return { success: false, error: 'Account management is not configured on this server.' }
    setRegistering(true)
    try {
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register_account', cookies }),
      })
      const result = await res.json()
      if (!result.success) {
        // The server already classifies the failure into a fixed, neutral
        // message — nothing upstream is relayed, so nothing is re-parsed here.
        const error = (result.error as string) || 'Registration failed'
        return { success: false, error }
      }
      toast.success('Account session saved')
      await fetchAccounts()
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      return { success: false, error: msg }
    } finally {
      setRegistering(false)
    }
  }, [managed, fetchAccounts])

  const deleteAccount = useCallback(async (email: string) => {
    if (!managed) return false
    setDeletingEmail(email)
    try {
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_account', email }),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || 'Failed to delete account')
        return false
      }
      toast.success(`Account ${email} removed`)
      setAccounts(prev => prev.filter(a => a.email !== email))
      return true
    } catch (err) {
      toast.error('Failed to delete account')
      return false
    } finally {
      setDeletingEmail(null)
    }
  }, [managed])

  const fetchCaptchaProviders = useCallback(async () => {
    if (!managed) return null
    try {
      const res = await authFetch('/api/ai/image?action=captcha-providers')
      const result = await res.json()
      if (!result.success) return null
      return result.data as Record<string, string>
    } catch {
      return null
    }
  }, [managed])

  const setCaptchaProviders = useCallback(async (providers: Record<string, string>) => {
    if (!managed) return false
    try {
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_captcha_providers', providers }),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || 'Failed to configure captcha provider')
        return false
      }
      toast.success('Captcha provider configured')
      return true
    } catch {
      toast.error('Failed to configure captcha provider')
      return false
    }
  }, [managed])

  const fetchJobs = useCallback(async () => {
    if (!managed) return
    setLoadingJobs(true)
    try {
      const res = await authFetch('/api/ai/image?action=jobs&options=history')
      const result = await res.json()
      if (!result.success) throw new Error(result.error)
      setJobs(result.data)
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }, [managed])

  return {
    accounts,
    jobs,
    loadingAccounts,
    loadingJobs,
    registering,
    deletingEmail,
    fetchAccounts,
    registerAccount,
    deleteAccount,
    fetchJobs,
    fetchCaptchaProviders,
    setCaptchaProviders,
  }
}
