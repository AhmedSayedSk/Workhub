'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '@/hooks/useAuth'
import { authFetch } from '@/lib/api-client'
import { campaigns as campaignsApi, campaignPosts as postsApi } from '@/lib/firestore'
import { uploadSocialMedia } from '@/lib/storage'
import { Timestamp } from 'firebase/firestore'
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
}

interface PlannedPost {
  caption: string
  hashtags: string[]
  imagePrompt: string
}

const DAY_MS = 86_400_000

// Slot for post #i: startDate@postTime + i*cadence days, but never in the past.
function slotForOrder(brief: CampaignBrief, order: number): number {
  const base = new Date(`${brief.startDate}T${(brief.postTime || '18:00')}:00`).getTime()
  const start = Number.isNaN(base) ? Date.now() + 5 * 60_000 : base
  const floor = Date.now() + 5 * 60_000
  return Math.max(start, floor) + order * Math.max(1, brief.cadenceDays || 1) * DAY_MS
}

export function useCampaigns(projectId: string | null) {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [posts, setPosts] = useState<CampaignPost[]>([])
  const [planning, setPlanning] = useState(false)
  const [schedulingAll, setSchedulingAll] = useState(false)
  const [imagePostIds, setImagePostIds] = useState<Set<string>>(new Set())

  const activeCampaign = campaigns.find((c) => c.id === activeId) || null

  // Load campaigns for the selected project.
  const loadCampaigns = useCallback(async () => {
    if (!projectId) {
      setCampaigns([])
      return
    }
    setLoading(true)
    try {
      setCampaigns(await campaignsApi.getAllForProject(projectId))
    } catch (e) {
      console.error('load campaigns', e)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadCampaigns()
    setActiveId(null)
    setPosts([])
  }, [loadCampaigns])

  // Load posts whenever the active campaign changes.
  const loadPosts = useCallback(async (campaignId: string) => {
    try {
      setPosts(await postsApi.getAllForCampaign(campaignId))
    } catch (e) {
      console.error('load posts', e)
    }
  }, [])

  const selectCampaign = useCallback((id: string | null) => {
    setActiveId(id)
    setPosts([])
    if (id) loadPosts(id)
  }, [loadPosts])

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
        status: 'draft',
        createdBy: user.uid,
      })
      await loadCampaigns()
      setActiveId(id)
      setPosts([])
      return { id, projectId, ...input, status: 'draft', createdBy: user.uid, createdAt: Timestamp.now() }
    } catch (e) {
      console.error('create campaign', e)
      toast.error('Failed to create campaign')
      return null
    }
  }, [user, projectId, loadCampaigns])

  const deleteCampaign = useCallback(async (id: string) => {
    try {
      const ps = await postsApi.getAllForCampaign(id)
      await Promise.all(ps.map((p) => postsApi.delete(p.id)))
      await campaignsApi.delete(id)
      if (activeId === id) selectCampaign(null)
      await loadCampaigns()
    } catch (e) {
      console.error('delete campaign', e)
      toast.error('Failed to delete campaign')
    }
  }, [activeId, selectCampaign, loadCampaigns])

  // Generate the post plan (Gemini) and persist each as a draft post.
  const generatePlan = useCallback(async (context: string) => {
    if (!activeCampaign) return
    setPlanning(true)
    try {
      const res = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'campaign_plan',
          data: {
            context,
            brandName: activeCampaign.brand.name,
            goal: activeCampaign.brief.goal,
            audience: activeCampaign.brief.audience,
            tone: activeCampaign.brief.tone,
            count: activeCampaign.brief.count,
            language: activeCampaign.language,
          },
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Plan failed')
      const planned: PlannedPost[] = json.data?.posts || []
      if (planned.length === 0) throw new Error('No posts were generated')

      // Replace any existing draft posts.
      const existing = await postsApi.getAllForCampaign(activeCampaign.id)
      await Promise.all(existing.map((p) => postsApi.delete(p.id)))

      await Promise.all(
        planned.map((p, i) =>
          postsApi.create({
            campaignId: activeCampaign.id,
            order: i,
            caption: p.caption,
            hashtags: p.hashtags,
            imagePrompt: p.imagePrompt,
            aspect: 'portrait',
            imageUrl: null,
            status: 'planned',
            socialPostId: null,
            scheduledAt: null,
          })
        )
      )
      await campaignsApi.update(activeCampaign.id, { status: 'planning' })
      await loadCampaigns()
      await loadPosts(activeCampaign.id)
      toast.success(`Planned ${planned.length} posts`)
    } catch (e) {
      console.error('generate plan', e)
      toast.error(e instanceof Error ? e.message : 'Failed to generate plan')
    } finally {
      setPlanning(false)
    }
  }, [activeCampaign, loadCampaigns, loadPosts])

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
    if (!user || !projectId) return
    setImagePostIds((prev) => new Set(prev).add(post.id))
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: 'generating' } : p)))
    try {
      const res = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          prompt: post.imagePrompt,
          aspectRatio: post.aspect,
          model: 'nano-banana-pro',
          count: 1,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Image generation failed')
      const img = (json.data?.images || [])[0]
      if (!img?.url) throw new Error('No image returned')

      // Re-host on Firebase Storage (useapi URLs expire; FB/IG need a stable URL).
      const blob = await (await fetch(img.url)).blob()
      const file = new File([blob], `campaign_${post.id}.png`, { type: blob.type || 'image/png' })
      const imageUrl = await uploadSocialMedia(file, projectId)

      await postsApi.update(post.id, { imageUrl, status: 'ready' })
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, imageUrl, status: 'ready' } : p)))
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
  }, [user, projectId])

  // Generate images for every post that has none yet (sequential — image API is heavy).
  const generateAllImages = useCallback(async () => {
    const targets = posts.filter((p) => !p.imageUrl)
    for (const p of targets) {
      await generateImage(p)
    }
  }, [posts, generateImage])

  // Hand every ready post to the existing social scheduler at its computed slot.
  const scheduleAll = useCallback(async () => {
    if (!activeCampaign || !projectId) return
    const ready = posts.filter((p) => p.imageUrl && p.status !== 'scheduled')
    if (ready.length === 0) {
      toast.error('No posts with images are ready to schedule')
      return
    }
    setSchedulingAll(true)
    let ok = 0
    try {
      for (const post of ready) {
        const scheduledAt = slotForOrder(activeCampaign.brief, post.order)
        const caption = [post.caption, post.hashtags.map((h) => `#${h}`).join(' ')]
          .filter(Boolean)
          .join('\n\n')
        try {
          const res = await authFetch('/api/social/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
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
          ok++
        } catch (e) {
          console.error('schedule post', e)
        }
      }
      await campaignsApi.update(activeCampaign.id, { status: ok === ready.length ? 'scheduled' : 'ready' })
      await loadCampaigns()
      await loadPosts(activeCampaign.id)
      toast.success(`Scheduled ${ok}/${ready.length} posts`)
    } finally {
      setSchedulingAll(false)
    }
  }, [activeCampaign, projectId, posts, loadCampaigns, loadPosts])

  return {
    campaigns,
    loading,
    activeCampaign,
    posts,
    planning,
    schedulingAll,
    imagePostIds,
    selectCampaign,
    createCampaign,
    deleteCampaign,
    generatePlan,
    updatePost,
    generateImage,
    generateAllImages,
    scheduleAll,
    reload: loadCampaigns,
  }
}
