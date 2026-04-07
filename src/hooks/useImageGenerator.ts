'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { authFetch } from '@/lib/api-client'
import { ImageGeneration, ImageGenAspectRatio, AppSettings } from '@/types'
import { imageGenerations, mediaFiles, imageGenLogs } from '@/lib/firestore'
import { uploadBlob, deleteFile } from '@/lib/storage'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'react-toastify'

export interface GenerationError {
  title: string
  message: string
  type: 'quota' | 'auth' | 'not_found' | 'config' | 'moderation' | 'generic'
}

function parseError(status: number, message: string): GenerationError {
  if (message.includes('No API token') || message.includes('No model')) {
    return { title: 'Configuration required', message, type: 'config' }
  }
  if (status === 401 || message.includes('Invalid API token')) {
    return { title: 'Authentication failed', message, type: 'auth' }
  }
  if (status === 402) {
    return { title: 'Subscription expired', message, type: 'auth' }
  }
  if (status === 404) {
    return { title: 'Account not configured', message, type: 'not_found' }
  }
  if (message.includes('captcha provider') || message.includes('captcha-providers')) {
    return {
      title: 'Captcha configuration needed',
      message: 'Google is requiring a CAPTCHA challenge. You need to configure a captcha solver (like CapSolver or AntiCaptcha) in the Accounts tab → Captcha Providers.',
      type: 'config',
    }
  }
  if (message.includes('All accounts blocked') || message.includes('All accounts are rate limited')) {
    return {
      title: 'All accounts unavailable',
      message,
      type: 'quota',
    }
  }
  if (message.includes('reCAPTCHA evaluation failed') || (message.includes('reCAPTCHA') && !message.includes('captcha provider'))) {
    return {
      title: 'Account blocked by Google',
      message: 'Google is rejecting this account. Auto-switching to another account if available. If all accounts are blocked, disable the flagged account and wait a few hours or register a fresh one.',
      type: 'quota',
    }
  }
  if (message.includes('Resource has been exhausted') || message.includes('check quota')) {
    return {
      title: 'Google quota exhausted',
      message: 'This Google account has used up its daily quota for this model. Switch to a different model or wait for the quota to reset (usually a few hours).',
      type: 'quota',
    }
  }
  if (status === 429 || message.includes('DAILY_QUOTA') || message.includes('daily quota') || message.includes('Rate limit') || message.includes('THROTTLED')) {
    const isQuota = message.includes('DAILY_QUOTA') || message.includes('daily quota')
    return {
      title: isQuota ? 'Daily quota reached' : 'Rate limited',
      message: isQuota
        ? 'Daily quota reached for this model. Try a different model or wait a few hours.'
        : 'Your account is temporarily rate limited. Wait a few minutes before trying again, or try a different model. If this persists, the account may need a cooldown of a few hours.',
      type: 'quota',
    }
  }
  if (status === 500 && message.includes('moderation')) {
    return { title: 'Content blocked', message, type: 'moderation' }
  }
  if (status === 596) {
    return { title: 'Session expired', message, type: 'auth' }
  }
  return { title: 'Generation failed', message, type: 'generic' }
}

export function useImageGenerator() {
  const { user } = useAuth()
  const [generations, setGenerations] = useState<ImageGeneration[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<GenerationError | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!user) return
    try {
      const data = await imageGenerations.getAll(user.uid)
      setGenerations(data)

      // Backfill file sizes for images that don't have them
      const missing = data.filter(g => !g.fileSize)
      if (missing.length > 0) {
        const updates: { id: string; fileSize: number }[] = []
        await Promise.all(
          missing.map(async (gen) => {
            try {
              // Try HEAD first for efficiency
              let fileSize = 0
              const headRes = await fetch(gen.imageUrl, { method: 'HEAD' })
              const cl = headRes.headers.get('content-length')
              if (cl) {
                fileSize = parseInt(cl, 10)
              } else {
                // Fallback: fetch blob to get size
                const blobRes = await fetch(gen.imageUrl)
                const blob = await blobRes.blob()
                fileSize = blob.size
              }
              if (fileSize > 0) updates.push({ id: gen.id, fileSize })
            } catch {}
          })
        )
        if (updates.length > 0) {
          // Update UI
          setGenerations(prev => prev.map(g => {
            const u = updates.find(x => x.id === g.id)
            return u ? { ...g, fileSize: u.fileSize } : g
          }))
          // Persist to Firestore in background
          updates.forEach(u => {
            imageGenerations.update(u.id, { fileSize: u.fileSize }).catch(() => {})
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch image history:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const generate = useCallback(async (
    prompt: string,
    aspectRatio: ImageGenAspectRatio,
    count: number,
    settings: AppSettings | null,
    references?: string[]
  ) => {
    if (!user) return null

    if (!settings?.imageGenApiToken) {
      setError({ title: 'Configuration required', message: 'No API token configured. Add your useapi.net token in Image Generator settings.', type: 'config' })
      return null
    }
    if (!settings?.imageGenModel) {
      setError({ title: 'Configuration required', message: 'No model selected. Choose a model in Image Generator settings.', type: 'config' })
      return null
    }
    if (settings?.imageGenEnabled === false) {
      setError({ title: 'Image generation disabled', message: 'Image generation is turned off. Enable it in Image Generator settings.', type: 'config' })
      return null
    }

    setIsGenerating(true)
    setError(null)

    // Create abort controller for this request
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // API max is 4 per request — split into batches
      const totalCount = Math.min(Math.max(count, 1), 8)
      const batches: number[] = []
      let remaining = totalCount
      while (remaining > 0) {
        const batch = Math.min(remaining, 4)
        batches.push(batch)
        remaining -= batch
      }

      // Send batches sequentially
      const allImages: { url: string; seed?: number; mediaGenerationId?: string }[] = []
      for (const batchCount of batches) {
        const res = await authFetch('/api/ai/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate',
            prompt,
            aspectRatio,
            model: settings.imageGenModel,
            apiToken: settings.imageGenApiToken,
            count: batchCount,
            ...(references && references.length > 0 ? { references } : {}),
            ...(settings.imageGenDisabledEmails?.length ? { disabledEmails: settings.imageGenDisabledEmails } : {}),
            ...(settings.imageGenPreferredEmail ? { preferredEmail: settings.imageGenPreferredEmail } : {}),
          }),
          signal: controller.signal,
        })
        const result = await res.json()
        if (!result.success) {
          const emailInfo = result.usedEmail ? ` (${result.usedEmail})` : ''
          throw new Error(`${result.error}${emailInfo}`)
        }
        allImages.push(...(result.data.images as { url: string; seed?: number; mediaGenerationId?: string }[]))
      }

      const generatedImages = allImages

      // Show images immediately with temporary useapi.net URLs
      const tempGenerations = generatedImages.map((img, i) => ({
        id: `temp_${Date.now()}_${i}`,
        prompt,
        aspectRatio,
        model: settings.imageGenModel!,
        imageUrl: img.url,
        storagePath: '',
        mimeType: 'image/png',
        seed: img.seed,
        savedToMedia: false,
        userId: user.uid,
        createdAt: { toMillis: () => Date.now() } as ImageGeneration['createdAt'],
      } as ImageGeneration))

      setGenerations(prev => [...tempGenerations, ...prev])
      toast.success(`${tempGenerations.length} image${tempGenerations.length > 1 ? 's' : ''} generated`)

      // Log generation for persistent stats
      imageGenLogs.create({
        userId: user.uid,
        prompt,
        model: settings.imageGenModel!,
        aspectRatio,
        imageCount: generatedImages.length,
        status: 'success',
        email: settings.imageGenPreferredEmail || '',
      }).catch(() => {})

      // Persist to Firebase Storage + Firestore in background
      // (useapi.net URLs expire in ~24h, so we re-upload)
      Promise.all(
        generatedImages.map(async (img, i) => {
          try {
            const imgRes = await fetch(img.url)
            const blob = await imgRes.blob()
            const mimeType = blob.type || 'image/png'
            const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
            const fileId = `img_${Date.now()}_${i}`
            const storagePath = `ai-images/${user.uid}/${fileId}.${ext}`

            const imageUrl = await uploadBlob(blob, storagePath)
            const fileSize = blob.size

            const id = await imageGenerations.create({
              prompt,
              aspectRatio,
              model: settings.imageGenModel!,
              imageUrl,
              storagePath,
              mimeType,
              seed: img.seed,
              fileSize,
              savedToMedia: false,
              userId: user.uid,
            })

            // Silently update metadata — keep original imageUrl to prevent flash
            const tempId = tempGenerations[i].id
            setGenerations(prev => prev.map(g =>
              g.id === tempId ? {
                ...g,
                id,
                storagePath,
                mimeType,
                fileSize,
              } : g
            ))
          } catch (err) {
            console.error('Failed to persist image to storage:', err)
          }
        })
      )

      return tempGenerations
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.info('Generation cancelled')
        return null
      }
      const raw = err instanceof Error ? err.message : 'Failed to generate image'
      setError(parseError(0, raw))

      // Log failure for persistent stats
      imageGenLogs.create({
        userId: user.uid,
        prompt,
        model: settings.imageGenModel!,
        aspectRatio,
        imageCount: 0,
        status: 'failed',
        error: raw,
        email: settings.imageGenPreferredEmail || '',
      }).catch(() => {})

      return null
    } finally {
      abortRef.current = null
      setIsGenerating(false)
    }
  }, [user])

  const saveToMediaLibrary = useCallback(async (generation: ImageGeneration) => {
    if (!user) return
    try {
      const response = await fetch(generation.imageUrl)
      const blob = await response.blob()
      const fileName = `ai-generated-${Date.now()}.${generation.mimeType.split('/')[1] || 'png'}`

      const mediaFileId = await mediaFiles.create({
        name: fileName,
        displayName: `AI: ${generation.prompt.slice(0, 50)}`,
        mimeType: generation.mimeType,
        category: 'image',
        size: blob.size,
        url: generation.imageUrl,
        storagePath: generation.storagePath,
        thumbnailUrl: null,
        folderId: null,
        linkedProjects: [],
        linkedTasks: [],
        uploadedBy: user.uid,
        metadata: {
          source: 'ai-image-generator',
          prompt: generation.prompt,
          model: generation.model,
          aspectRatio: generation.aspectRatio,
        },
      })

      await imageGenerations.update(generation.id, { savedToMedia: true, mediaFileId })
      setGenerations(prev => prev.map(g => g.id === generation.id ? { ...g, savedToMedia: true, mediaFileId } : g))
      toast.success('Saved to Media Library')
    } catch (err) {
      console.error('Failed to save to media library:', err)
      toast.error('Failed to save to Media Library')
    }
  }, [user])

  const deleteGeneration = useCallback((id: string) => {
    const generation = generations.find(g => g.id === id)
    if (!generation) return

    // Remove from UI immediately
    setGenerations(prev => prev.filter(g => g.id !== id))

    // Delete from Firebase in background
    if (generation.storagePath) {
      deleteFile(generation.storagePath).catch(() => {})
    }
    if (!generation.id.startsWith('temp_')) {
      imageGenerations.delete(id).catch(err => {
        console.error('Failed to delete generation:', err)
      })
    }
  }, [generations])

  const clearError = useCallback(() => setError(null), [])

  const cancelGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  return {
    generations,
    isGenerating,
    isLoading,
    error,
    clearError,
    generate,
    cancelGeneration,
    saveToMediaLibrary,
    deleteGeneration,
    fetchHistory,
  }
}
