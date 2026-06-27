'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '@/hooks/useAuth'
import { authFetch } from '@/lib/api-client'
import { campaigns as campaignsApi, campaignPosts as postsApi } from '@/lib/firestore'
import { uploadSocialMedia } from '@/lib/storage'
import { buildImagePrompt } from '@/lib/campaignStyles'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore'
import type {
  Campaign,
  CampaignPost,
  CampaignBrief,
  CampaignBrand,
  CampaignLanguage,
  SocialPlatform,
} from '@/types'

export interface NewCampaignInput {
  name: string
  brief: CampaignBrief
  brand: CampaignBrand
  language: CampaignLanguage
  platforms: SocialPlatform[]
  style: string
}

const DAY_MS = 86_400_000

// Slot for post #i: startDate@postTime + i*cadence days, but never in the past.
function slotForOrder(brief: CampaignBrief, order: number): number {
  const base = new Date(`${brief.startDate}T${brief.postTime || '18:00'}:00`).getTime()
  const start = Number.isNaN(base) ? Date.now() + 5 * 60_000 : base
  const floor = Date.now() + 5 * 60_000
  return Math.max(start, floor) + order * Math.max(1, brief.cadenceDays || 1) * DAY_MS
}

export function useCampaigns(projectId: string | null) {
  const { user } = useAuth()
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [posts, setPosts] = useState<CampaignPost[]>([])
  const [schedulingAll, setSchedulingAll] = useState(false)
  const [imagePostIds, setImagePostIds] = useState<Set<string>>(new Set())

  // Live: every campaign in the system (small dataset). Drives the overview AND
  // reflects background status changes (planning → ready) everywhere, live.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Campaign[]
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      setAllCampaigns(list)
    })
    return () => unsub()
  }, [])

  // Live: the active campaign's posts (so background plan/image writes appear).
  useEffect(() => {
    if (!activeId) {
      setPosts([])
      return
    }
    const q = query(collection(db, 'campaignPosts'), where('campaignId', '==', activeId))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CampaignPost[]
      list.sort((a, b) => (a.order || 0) - (b.order || 0))
      setPosts(list)
    })
    return () => unsub()
  }, [activeId])

  const activeCampaign = useMemo(
    () => allCampaigns.find((c) => c.id === activeId) || null,
    [allCampaigns, activeId]
  )
  const campaigns = useMemo(
    () => (projectId ? allCampaigns.filter((c) => c.projectId === projectId) : []),
    [allCampaigns, projectId]
  )
  const loading = false
  const planning = activeCampaign?.status === 'planning'

  const selectCampaign = useCallback((id: string | null) => setActiveId(id), [])
  const openCampaign = useCallback((camp: Campaign) => setActiveId(camp.id), [])

  const createCampaign = useCallback(async (input: NewCampaignInput): Promise<Campaign | null> => {
    if (!user || !projectId) return null
    try {
      const id = await campaignsApi.create({
        projectId,
        name: input.name,
        brief: input.brief,
        brand: input.brand,
        language: input.language,
        platforms: input.platforms,
        style: input.style,
        status: 'draft',
        postCount: 0,
        scheduledCount: 0,
        createdBy: user.uid,
      })
      setActiveId(id)
      return { id, projectId, ...input, status: 'draft', createdBy: user.uid, createdAt: Timestamp.now() }
    } catch (e) {
      console.error('create campaign', e)
      toast.error('Failed to create campaign')
      return null
    }
  }, [user, projectId])

  const deleteCampaign = useCallback(async (id: string) => {
    try {
      const ps = await postsApi.getAllForCampaign(id)
      await Promise.all(ps.map((p) => postsApi.delete(p.id)))
      await campaignsApi.delete(id)
      if (activeId === id) setActiveId(null)
    } catch (e) {
      console.error('delete campaign', e)
      toast.error('Failed to delete campaign')
    }
  }, [activeId])

  // Trigger background planning on the server — returns immediately. The campaign
  // status flips to 'planning' and the posts stream in via the listener.
  const generatePlan = useCallback(async () => {
    if (!activeId) return
    try {
      const res = await authFetch('/api/campaigns/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: activeId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to start planning')
      }
      toast.info('Planning started — runs in the background')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start planning')
    }
  }, [activeId])

  const updatePost = useCallback(async (postId: string, patch: Partial<CampaignPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)))
    try {
      await postsApi.update(postId, patch)
    } catch (e) {
      console.error('update post', e)
    }
  }, [])

  // Generate an image for one post, host it for FB/IG, store the URL.
  const generateImage = useCallback(async (post: CampaignPost) => {
    const pid = activeCampaign?.projectId ?? projectId
    if (!user || !pid) return
    setImagePostIds((prev) => new Set(prev).add(post.id))
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: 'generating' } : p)))
    try {
      // Apply the campaign's style + brand colors to every image for a consistent identity.
      const fullPrompt = buildImagePrompt(post.imagePrompt, activeCampaign?.style, activeCampaign?.brand?.colors)
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt: fullPrompt, aspectRatio: post.aspect, model: 'nano-banana-pro', count: 1 }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Image generation failed')
      const img = (json.data?.images || [])[0]
      if (!img?.url) throw new Error('No image returned')

      const blob = await (await fetch(img.url)).blob()
      const file = new File([blob], `campaign_${post.id}.png`, { type: blob.type || 'image/png' })
      const imageUrl = await uploadSocialMedia(file, pid)

      await postsApi.update(post.id, { imageUrl, status: 'ready' })
    } catch (e) {
      console.error('generate image', e)
      toast.error(e instanceof Error ? e.message : 'Failed to generate image')
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: 'approved' } : p)))
    } finally {
      setImagePostIds((prev) => {
        const next = new Set(prev)
        next.delete(post.id)
        return next
      })
    }
  }, [user, projectId, activeCampaign])

  // Generate an image for EVERY post (skip only already-scheduled/locked ones).
  const generateAllImages = useCallback(async () => {
    const targets = posts.filter((p) => p.status !== 'scheduled')
    for (const p of targets) {
      await generateImage(p)
    }
  }, [posts, generateImage])

  const slotFor = useCallback(
    (order: number): number | null => (activeCampaign ? slotForOrder(activeCampaign.brief, order) : null),
    [activeCampaign]
  )

  // Hand selected ready posts to the existing social scheduler at their slots.
  const scheduleAll = useCallback(async (onlyIds?: string[]) => {
    const pid = activeCampaign?.projectId ?? projectId
    if (!activeCampaign || !pid) return
    let ready = posts.filter((p) => p.imageUrl && p.status !== 'scheduled')
    if (onlyIds) ready = ready.filter((p) => onlyIds.includes(p.id))
    if (ready.length === 0) {
      toast.error('No posts with images are ready to schedule')
      return
    }
    setSchedulingAll(true)
    let okCount = 0
    try {
      for (const post of ready) {
        const scheduledAt = slotForOrder(activeCampaign.brief, post.order)
        const caption = [post.caption, post.hashtags.map((h) => `#${h}`).join(' ')].filter(Boolean).join('\n\n')
        try {
          const res = await authFetch('/api/social/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: pid,
              platforms: activeCampaign.platforms,
              caption,
              mediaUrls: [post.imageUrl],
              mediaType: 'image',
              scheduledAt,
            }),
          })
          const json = await res.json()
          if (!json.ok) throw new Error(json.error || 'Schedule failed')
          await postsApi.update(post.id, {
            status: 'scheduled',
            socialPostId: json.id,
            scheduledAt: Timestamp.fromMillis(scheduledAt),
          })
          okCount++
        } catch (e) {
          console.error('schedule post', e)
        }
      }
      const withImages = posts.filter((p) => p.imageUrl).length
      const newScheduled = posts.filter((p) => p.status === 'scheduled').length + okCount
      await campaignsApi.update(activeCampaign.id, {
        status: newScheduled >= withImages ? 'scheduled' : 'ready',
        scheduledCount: newScheduled,
      })
      toast.success(`Scheduled ${okCount}/${ready.length} posts`)
    } finally {
      setSchedulingAll(false)
    }
  }, [activeCampaign, projectId, posts])

  return {
    allCampaigns,
    campaigns,
    loading,
    activeCampaign,
    posts,
    planning,
    schedulingAll,
    imagePostIds,
    selectCampaign,
    openCampaign,
    createCampaign,
    deleteCampaign,
    generatePlan,
    updatePost,
    generateImage,
    generateAllImages,
    slotFor,
    scheduleAll,
  }
}
