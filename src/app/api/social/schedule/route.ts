import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { requireAuth, verifyAuth } from '@/lib/api-auth'
import * as store from '@/lib/server/meta/store'
import { AdminTimestamp } from '@/lib/server/meta/store'
import type { SocialMediaType, SocialPlatform, SocialPost } from '@/types'

// When a Market post that came from a campaign is removed, free its campaign post so
// the campaign can re-schedule it (otherwise it stays 'scheduled' with a dead link).
async function releaseCampaignPost(socialPostId: string): Promise<void> {
  const db = admin.firestore()
  const linked = await db.collection('campaignPosts').where('socialPostId', '==', socialPostId).get()
  if (linked.empty) return
  const batch = db.batch()
  const campaignIds = new Set<string>()
  linked.docs.forEach((d) => {
    batch.update(d.ref, { status: 'ready', socialPostId: null, scheduledAt: null, updatedAt: AdminTimestamp.now() })
    const cid = (d.data() as { campaignId?: string }).campaignId
    if (cid) campaignIds.add(cid)
  })
  await batch.commit()
  // Recompute each affected campaign's scheduled count + status.
  for (const cid of campaignIds) {
    const all = await db.collection('campaignPosts').where('campaignId', '==', cid).get()
    const schedCount = all.docs.filter((d) => (d.data() as { status?: string }).status === 'scheduled').length
    await db
      .collection('campaigns')
      .doc(cid)
      .update({ scheduledCount: schedCount, status: schedCount > 0 ? 'scheduled' : 'ready', updatedAt: AdminTimestamp.now() })
      .catch(() => {})
  }
}

function toMillis(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const ms = new Date(value).getTime()
    return Number.isNaN(ms) ? null : ms
  }
  return null
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const decoded = await verifyAuth(request)
    const uid = decoded?.uid || 'system'

    const body = await request.json()
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

    const ms = toMillis(body.scheduledAt)
    if (ms === null) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 })
    }
    if (ms <= Date.now()) {
      return NextResponse.json({ error: 'scheduledAt must be in the future' }, { status: 400 })
    }
    const ts = AdminTimestamp.fromMillis(ms) as unknown as SocialPost['scheduledAt']

    const id = await store.addPost({
      projectId,
      platforms,
      caption,
      mediaUrls,
      mediaType,
      status: 'scheduled',
      scheduledAt: ts,
      publishedAt: null,
      fbPostId: null,
      igMediaId: null,
      liPostId: null,
      error: null,
      attempts: 0,
      createdBy: uid,
    })

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    await verifyAuth(request)
    const body = await request.json()
    const id: string = body.id
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const post = await store.getPost(id)
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    if (post.status === 'published' || post.status === 'publishing') {
      return NextResponse.json({ error: 'Published posts cannot be edited' }, { status: 409 })
    }

    const patch: Partial<SocialPost> = {}
    if (typeof body.caption === 'string') patch.caption = body.caption
    if (Array.isArray(body.mediaUrls)) patch.mediaUrls = body.mediaUrls
    if (typeof body.mediaType === 'string') patch.mediaType = body.mediaType as SocialMediaType
    if (Array.isArray(body.platforms)) patch.platforms = body.platforms as SocialPlatform[]

    if (body.scheduledAt !== undefined) {
      const ms = toMillis(body.scheduledAt)
      if (ms === null) {
        return NextResponse.json({ error: 'Invalid scheduledAt' }, { status: 400 })
      }
      if (ms <= Date.now()) {
        return NextResponse.json({ error: 'scheduledAt must be in the future' }, { status: 400 })
      }
      patch.scheduledAt = AdminTimestamp.fromMillis(ms) as unknown as SocialPost['scheduledAt']
      // Setting a (future) time (re)schedules the post — promote draft/failed → scheduled.
      patch.status = 'scheduled'
      patch.error = null
    }

    await admin.firestore().collection('socialPosts').doc(id).update({ ...patch, updatedAt: AdminTimestamp.now() })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    await verifyAuth(request)
    let id: string | null = null
    let hard = false
    try {
      const body = await request.json()
      id = body?.id ?? null
      hard = body?.hard === true
    } catch {
      // no JSON body
    }
    if (!id) {
      id = request.nextUrl.searchParams.get('id')
    }
    if (!hard) {
      const h = request.nextUrl.searchParams.get('hard')
      hard = h === '1' || h === 'true'
    }
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // hard = permanently delete the post; otherwise just unschedule (revert to draft).
    if (hard) {
      await store.deletePost(id)
      // Post is gone from Market — release its campaign post for re-scheduling.
      await releaseCampaignPost(id).catch(() => {})
    } else {
      await store.setPostStatus(id, 'draft', { scheduledAt: null })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
