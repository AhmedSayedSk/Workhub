'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { authFetch } from '@/lib/api-client'
import { ImageGeneration, ImageGenAspectRatio, AppSettings } from '@/types'
import { normalizeModel } from '@/lib/imageModels'
import { imageGenerations, mediaFiles, imageGenLogs } from '@/lib/firestore'
import { uploadBlob, deleteFile } from '@/lib/storage'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'react-toastify'

export interface GenerationError {
  title: string
  message: string
  type: 'quota' | 'auth' | 'not_found' | 'config' | 'moderation' | 'generic'
}

// The server returns flat, neutral messages (see `@/lib/imageGen`). This maps
// them onto the shape the page already renders — no vendor names, no account
// identities, no re-parsing of anything upstream.
function parseError(message: string): GenerationError {
  const m = message.toLowerCase()
  if (m.includes('not configured') || m.includes('turned off') || m.includes('credential')) {
    return { title: 'Configuration required', message, type: 'config' }
  }
  if (m.includes('busy') || m.includes('quota')) {
    return { title: 'Service busy', message, type: 'quota' }
  }
  if (m.includes('different prompt') || m.includes('too long') || m.includes('prompt is required')) {
    return { title: 'Prompt rejected', message, type: 'moderation' }
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
    references?: string[],
    sessionId?: string
  ) => {
    if (!user) return null

    if (settings?.imageGenEnabled === false) {
      setError({ title: 'Image generation disabled', message: 'Image generation is turned off. Enable it in Image Generator settings.', type: 'config' })
      return null
    }

    // The credential is held by the server; nothing here holds or sends one.
    const model = normalizeModel(settings?.imageGenModel)

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
      const allImages: { url: string; seed?: number; id?: string }[] = []
      for (const batchCount of batches) {
        const res = await authFetch('/api/ai/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate',
            prompt,
            aspectRatio,
            model,
            count: batchCount,
            ...(references && references.length > 0 ? { references } : {}),
          }),
          signal: controller.signal,
        })
        const result = await res.json()
        if (!result.success) throw new Error(result.error || 'Failed to generate image')
        allImages.push(...(result.data.images as { url: string; seed?: number; id?: string }[]))
      }

      const generatedImages = allImages

      // Show the hosted URLs immediately; they are copied to Storage below.
      const tempGenerations = generatedImages.map((img, i) => ({
        id: `temp_${Date.now()}_${i}`,
        prompt,
        aspectRatio,
        model,
        imageUrl: img.url,
        storagePath: '',
        mimeType: 'image/png',
        seed: img.seed,
        savedToMedia: false,
        userId: user.uid,
        sessionId,
        createdAt: { toMillis: () => Date.now() } as ImageGeneration['createdAt'],
      } as ImageGeneration))

      setGenerations(prev => [...tempGenerations, ...prev])
      toast.success(`${tempGenerations.length} image${tempGenerations.length > 1 ? 's' : ''} generated`)

      // Log generation for persistent stats
      imageGenLogs.create({
        userId: user.uid,
        prompt,
        model,
        aspectRatio,
        imageCount: generatedImages.length,
        status: 'success',
        email: '',
      }).catch(() => {})

      // Persist to Firebase Storage + Firestore in the background. Still
      // required: the image service deletes hosted files after a retention
      // window, so a generation kept in history needs our own copy.
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
              model,
              imageUrl,
              storagePath,
              mimeType,
              seed: img.seed,
              fileSize,
              savedToMedia: false,
              userId: user.uid,
              ...(sessionId ? { sessionId } : {}),
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
      setError(parseError(raw))

      // Log failure for persistent stats
      imageGenLogs.create({
        userId: user.uid,
        prompt,
        model,
        aspectRatio,
        imageCount: 0,
        status: 'failed',
        error: raw,
        email: '',
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
