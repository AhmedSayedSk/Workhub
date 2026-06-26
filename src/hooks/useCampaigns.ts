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
// Exported shape used by both the scheduler and the preview so the times match.
function slotForOrder(brief: CampaignBrief, order: number): number {
  const base = new Date(`${brief.startDate}T${brief.postTime || '18:00'}:00`).getTime()
  const start = Number.isNaN(base) ? Date.now() + 5 * 60_000 : base
  const floor = Date.now() + 5 * 60_000
  return Math.max(start, floor) + order * Math.max(1, brief.cadenceDays || 1) * DAY_MS
}

export function useCampaigns(projectId: string | null) {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null)
  const [posts, setPosts] = useState<CampaignPost[]>([])
  const [planning, setPlanning] = useState(false)
  const [schedulingAll, setSchedulingAll] = useState(false)
  const [imagePostIds, setImagePostIds] = useState<Set<string>>(new Set())

  // Load the selected project's campaigns (the setup-view list).
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

  // Switching the project picker resets the active campaign + list.
  useEffect(() => {
    loadCampaigns()
    setActiveCampaign(null)
    setPosts([])
  }, [loadCampaigns])

  const loadPosts = useCallback(async (campaignId: string) => {
    try {
      setPosts(await postsApi.getAllForCampaign(campaignId))
    } catch (e) {
      console.error('load posts', e)
    }
  }, [])

  // Open a campaign from the current project's list.
  const selectCampaign = useCallback((id: string | null) => {
    if (!id) {
      setActiveCampaign(null)
      setPosts([])
      return
    }
    const found = campaigns.find((c) => c.id === id) || null
    setActiveCampaign(found)
    setPosts([])
    if (found) loadPosts(found.id)
  }, [campaigns, loadPosts])

  // Open any campaign (possibly from another project) by full object.
  const openCampaign = useCallback((camp: Campaign) => {
    setActiveCampaign(camp)
    setPosts([])
    loadPosts(camp.id)
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
      const camp: Campaign = { id, projectId, ...input, status: 'draft', createdBy: user.uid, createdAt: Timestamp.now() }
      await loadCampaigns()
      setActiveCampaign(camp)
      setPosts([])
      return camp
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
      if (activeCampaign?.id === id) {
        setActiveCampaign(null)
        setPosts([])
      }
      await loadCampaigns()
    } catch (e) {
      console.error('delete campaign', e)
      toast.error('Failed to delete campaign')
    }
  }, [activeCampaign, loadCampaigns])

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
    const pid = activeCampaign?.projectId ?? projectId
    if (!user || !pid) return
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

      const blob = await (await fetch(img.url)).blob()
      const file = new File([blob], `campaign_${post.id}.png`, { type: blob.type || 'image/png' })
      const imageUrl = await uploadSocialMedia(file, pid)

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
  }, [user, projectId, activeCampaign])

  const generateAllImages = useCallback(async () => {
    const targets = posts.filter((p) => !p.imageUrl)
    for (const p of targets) {
      await generateImage(p)
    }
  }, [posts, generateImage])

  // Compute the real post time for a given order (for the preview).
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
        const caption = [post.caption, post.hashtags.map((h) => `#${h}`).join(' ')]
          .filter(Boolean)
          .join('\n\n')
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
      const allReadyNow = posts.filter((p) => p.imageUrl).length
      await campaignsApi.update(activeCampaign.id, { status: okCount >= allReadyNow ? 'scheduled' : 'ready' })
      await loadPosts(activeCampaign.id)
      toast.success(`Scheduled ${okCount}/${ready.length} posts`)
    } finally {
      setSchedulingAll(false)
    }
  }, [activeCampaign, projectId, posts, loadPosts])

  return {
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
    reload: loadCampaigns,
  }
}
