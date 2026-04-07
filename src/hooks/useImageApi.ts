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

export interface UploadedAsset {
  mediaGenerationId: string
  mediaGenerationIds: Record<string, string> // email → mediaGenerationId
  thumbnailDataUrl: string
  name: string
  uploadedAt: number
}

export function useImageApi(apiToken: string | null | undefined) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [jobs, setJobs] = useState<JobStats | null>(null)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    if (!apiToken) return
    setLoadingAccounts(true)
    try {
      const res = await authFetch(`/api/ai/image?action=accounts&token=${encodeURIComponent(apiToken)}`)
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
  }, [apiToken])

  const registerAccount = useCallback(async (cookies: string): Promise<{ success: boolean; error?: string }> => {
    if (!apiToken) return { success: false, error: 'No API token' }
    setRegistering(true)
    try {
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register_account', apiToken, cookies }),
      })
      const result = await res.json()
      if (!result.success) {
        let error = result.error || 'Registration failed'
        // Parse common useapi.net registration errors into friendly messages
        if (error.includes('OAuth stuck on login')) {
          error = 'Google rejected these cookies — the session may be expired or invalidated.\n\nTo fix:\n1. Open a fresh/incognito browser\n2. Go to labs.google/fx/tools/flow and sign in\n3. Check "Don\'t ask again on this device" on 2FA\n4. Go to myaccount.google.com\n5. Copy ALL cookies from accounts.google.com\n6. Paste here and try again'
        } else if (error.includes('Failed to validate cookies')) {
          const innerMatch = error.match(/"error"\s*:\s*"([^"]{5,200})"/)
          if (innerMatch?.[1]?.includes('OAuth stuck')) {
            error = 'Google rejected these cookies — the session may be expired.\n\nSign in fresh at labs.google/fx/tools/flow and copy new cookies.'
          } else {
            error = innerMatch?.[1] || 'Failed to validate cookies. Try copying fresh cookies from a new sign-in.'
          }
        } else if (error.includes('captcha') || error.includes('CAPTCHA')) {
          error = 'Google captcha challenge detected. Try using Firefox or Opera, or wait a few minutes and try again.'
        } else if (error.includes('session') && error.includes('expired')) {
          error = 'Google session expired. Sign in again at labs.google/fx/tools/flow and copy fresh cookies.'
        }
        // Truncate very long errors
        if (error.length > 300) error = error.slice(0, 300) + '...'
        return { success: false, error }
      }
      toast.success(res.status === 200 ? 'Session refreshed successfully' : 'Google account registered successfully')
      await fetchAccounts()
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      return { success: false, error: msg }
    } finally {
      setRegistering(false)
    }
  }, [apiToken, fetchAccounts])

  const deleteAccount = useCallback(async (email: string) => {
    if (!apiToken) return false
    setDeletingEmail(email)
    try {
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_account', apiToken, email }),
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
  }, [apiToken])

  const fetchCaptchaProviders = useCallback(async () => {
    if (!apiToken) return null
    try {
      const res = await authFetch(`/api/ai/image?action=captcha-providers&token=${encodeURIComponent(apiToken)}`)
      const result = await res.json()
      if (!result.success) return null
      return result.data as Record<string, string>
    } catch {
      return null
    }
  }, [apiToken])

  const setCaptchaProviders = useCallback(async (providers: Record<string, string>) => {
    if (!apiToken) return false
    try {
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_captcha_providers', apiToken, providers }),
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
  }, [apiToken])

  const fetchJobs = useCallback(async () => {
    if (!apiToken) return
    setLoadingJobs(true)
    try {
      const res = await authFetch(`/api/ai/image?action=jobs&token=${encodeURIComponent(apiToken)}&options=history`)
      const result = await res.json()
      if (!result.success) throw new Error(result.error)
      setJobs(result.data)
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }, [apiToken])

  const upscaleImage = useCallback(async (mediaGenerationId: string, resolution: '2k' | '4k' = '2k') => {
    if (!apiToken) return null
    try {
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upscale', apiToken, mediaGenerationId, resolution }),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || 'Upscale failed')
        return null
      }
      toast.success('Image upscaled')
      return result.data.encodedImage as string
    } catch (err) {
      toast.error('Upscale failed')
      return null
    }
  }, [apiToken])

  const uploadAsset = useCallback(async (dataUrl: string, fileName: string): Promise<UploadedAsset | null> => {
    if (!apiToken) return null
    try {
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload_asset', apiToken, asset: dataUrl }),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || 'Failed to upload reference image')
        return null
      }
      const mediaGenId = result.data?.mediaGenerationId?.mediaGenerationId
        || result.data?.mediaGenerationId
      if (!mediaGenId) {
        console.error('Unexpected asset upload response:', result.data)
        toast.error('Failed to get asset reference')
        return null
      }
      return {
        mediaGenerationId: mediaGenId as string,
        mediaGenerationIds: (result.perAccount || {}) as Record<string, string>,
        thumbnailDataUrl: dataUrl,
        name: fileName,
        uploadedAt: Date.now(),
      }
    } catch {
      toast.error('Failed to upload reference image')
      return null
    }
  }, [apiToken])

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
    upscaleImage,
    uploadAsset,
  }
}
