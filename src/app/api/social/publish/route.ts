import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, verifyAuth } from '@/lib/api-auth'
import { MetaApiError } from '@/lib/server/meta'
import * as store from '@/lib/server/meta/store'
import { publishOne } from '@/lib/server/meta/publish'
import type { SocialMediaType, SocialPlatform } from '@/types'

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const decoded = await verifyAuth(request)
    const uid = decoded?.uid || 'system'

    const body = await request.json()

    // "Publish now" on an already-persisted post (e.g. a scheduled post): publish by id.
    if (body.id) {
      const existing = await store.getPost(body.id)
      if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      if (existing.status === 'published') return NextResponse.json({ error: 'Post is already published' }, { status: 409 })
      await store.setPostStatus(body.id, 'publishing')
      const fresh = await store.getPost(body.id)
      const result = await publishOne(fresh!)
      return NextResponse.json({ ok: true, id: body.id, ...result })
    }

    const projectId: string = body.projectId
    const platforms: SocialPlatform[] = body.platforms
    const caption: string = body.caption ?? ''
    const mediaUrls: string[] = body.mediaUrls ?? []
    const mediaType: SocialMediaType = body.mediaType ?? 'none'

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: 'At least one platform is required' }, { status: 400 })
    }
    if (platforms.includes('ig') && (mediaType === 'none' || !mediaUrls[0])) {
      return NextResponse.json({ error: 'Instagram requires an image or video' }, { status: 400 })
    }

    const id = await store.addPost({
      projectId,
      platforms,
      caption,
      mediaUrls,
      mediaType,
      status: 'publishing',
      scheduledAt: null,
      publishedAt: null,
      fbPostId: null,
      igMediaId: null,
      error: null,
      attempts: 0,
      createdBy: uid,
    })

    const post = await store.getPost(id)
    const result = await publishOne(post!)

    return NextResponse.json({ ok: true, id, ...result })
  } catch (error) {
    const msg = error instanceof MetaApiError || error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
