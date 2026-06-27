'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '@/hooks/useAuth'
import { authFetch } from '@/lib/api-client'
import { campaigns as campaignsApi, campaignPosts as postsApi } from '@/lib/firestore'
import { uploadSocialMedia, optimizeImage } from '@/lib/storage'
import { buildImagePrompt } from '@/lib/campaignStyles'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, Timestamp } from 'firebase/firestore'
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
  consistentIdentity: boolean
}

const DAY_MS = 86_400_000

function slotForOrder(brief: CampaignBrief, order: number): number {
  const base = new Date(`${brief.startDate}T${brief.postTime || '18:00'}:00`).getTime()
  const start = Number.isNaN(base) ? Date.now() + 5 * 60_000 : base
  const floor = Date.now() + 5 * 60_000
  return Math.max(start, floor) + order * Math.max(1, brief.cadenceDays || 1) * DAY_MS
}

export function useCampaigns() {
  const { user } = useAuth()
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([])
  const [allPosts, setAllPosts] = useState<CampaignPost[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [schedulingAll, setSchedulingAll] = useState(false)
  const [imagePostIds, setImagePostIds] = useState<Set<string>>(new Set())
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({})

  // Live: every campaign + every post (small dataset). Drives the overview,
  // per-campaign image previews, and live background-status updates.
  useEffect(() => {
    const unsubC = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Campaign[]
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      setAllCampaigns(list)
    })
    const unsubP = onSnapshot(collection(db, 'campaignPosts'), (snap) => {
      setAllPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CampaignPost[])
    })
    return () => { unsubC(); unsubP() }
  }, [])

  const activeCampaign = useMemo(() => allCampaigns.find((c) => c.id === activeId) || null, [allCampaigns, activeId])
  const posts = useMemo(
    () => allPosts.filter((p) => p.campaignId === activeId).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [allPosts, activeId]
  )
  // campaignId -> ordered image thumbnails (for overview previews)
  const postThumbs = useMemo(() => {
    const map: Record<string, { order: number; url: string }[]> = {}
    for (const p of allPosts) {
      const url = p.thumbnailUrl || p.imageUrl
      if (url) (map[p.campaignId] ||= []).push({ order: p.order || 0, url })
    }
    const out: Record<string, string[]> = {}
    for (const k of Object.keys(map)) out[k] = map[k].sort((a, b) => a.order - b.order).map((x) => x.url)
    return out
  }, [allPosts])

  const planning = activeCampaign?.status === 'planning'

  const selectCampaign = useCallback((id: string | null) => setActiveId(id), [])
  const openCampaign = useCallback((camp: Campaign) => setActiveId(camp.id), [])

  const createCampaign = useCallback(async (projectId: string, input: NewCampaignInput): Promise<Campaign | null> => {
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
        consistentIdentity: input.consistentIdentity,
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
  }, [user])

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

  // Trigger background planning on the server — returns immediately.
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
    try {
      await postsApi.update(postId, patch)
    } catch (e) {
      console.error('update post', e)
    }
  }, [])

  // Core: generate one image, host it (+ a thumbnail), store the URLs. Returns an
  // error message (or null on success) WITHOUT toasting — callers decide how to surface.
  const runImage = useCallback(async (post: CampaignPost): Promise<string | null> => {
    const pid = activeCampaign?.projectId
    if (!user || !pid) return 'No project for this campaign'
    setImagePostIds((prev) => new Set(prev).add(post.id))
    setImageErrors((prev) => {
      if (!prev[post.id]) return prev
      const n = { ...prev }
      delete n[post.id]
      return n
    })
    try {
      const fullPrompt = buildImagePrompt(post.imagePrompt, activeCampaign?.style, activeCampaign?.brand?.colors, activeCampaign?.language, activeCampaign?.artDirection)
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

      let thumbnailUrl: string | null = null
      try {
        const { blob: tb } = await optimizeImage(file, { maxWidth: 480, maxHeight: 480, quality: 0.7 })
        const ext = tb.type.includes('webp') ? 'webp' : tb.type.includes('png') ? 'png' : 'jpg'
        const tf = new File([tb], `campaign_${post.id}_thumb.${ext}`, { type: tb.type || 'image/jpeg' })
        thumbnailUrl = await uploadSocialMedia(tf, pid)
      } catch (e) {
        console.error('thumbnail', e)
      }

      await postsApi.update(post.id, { imageUrl, thumbnailUrl, model: json.data?.model || 'nano-banana-pro', status: 'ready' })
      return null
    } catch (e) {
      console.error('generate image', e)
      const msg = e instanceof Error ? e.message : 'Failed to generate image'
      setImageErrors((prev) => ({ ...prev, [post.id]: msg }))
      return msg
    } finally {
      setImagePostIds((prev) => {
        const next = new Set(prev)
        next.delete(post.id)
        return next
      })
    }
  }, [user, activeCampaign])

  // Single post (e.g. Regenerate) — one toast.
  const generateImage = useCallback(async (post: CampaignPost) => {
    const err = await runImage(post)
    if (err) toast.error(err)
  }, [runImage])

  // Bulk: run all in parallel, then ONE summary toast (no 6-way toast spam).
  const generateAllImages = useCallback(async () => {
    const targets = posts.filter((p) => p.status !== 'scheduled')
    if (targets.length === 0) return
    const results = await Promise.all(targets.map((p) => runImage(p)))
    const errs = results.filter((e): e is string => !!e)
    if (errs.length === 0) toast.success(`Generated ${targets.length} image${targets.length > 1 ? 's' : ''}`)
    else if (errs.length === targets.length) toast.error(errs[0])
    else toast.info(`${targets.length - errs.length}/${targets.length} generated · ${errs[0]}`)
  }, [posts, runImage])

  const slotFor = useCallback(
    (order: number): number | null => (activeCampaign ? slotForOrder(activeCampaign.brief, order) : null),
    [activeCampaign]
  )

  const scheduleAll = useCallback(async (onlyIds?: string[]) => {
    const pid = activeCampaign?.projectId
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
  }, [activeCampaign, posts])

  return {
    allCampaigns,
    activeCampaign,
    posts,
    postThumbs,
    planning,
    schedulingAll,
    imagePostIds,
    imageErrors,
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
