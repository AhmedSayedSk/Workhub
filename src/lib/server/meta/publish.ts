import 'server-only'
import { fbPages, ig, MetaApiError } from '@/lib/server/meta'
import * as store from './store'
import { AdminTimestamp } from './store'
import type { SocialPost } from '@/types'

/** Publish an already-persisted post across its platforms; updates its status. */
export async function publishOne(post: SocialPost): Promise<{ fbPostId: string | null; igMediaId: string | null }> {
  let fbPostId: string | null = null
  let igMediaId: string | null = null
  try {
    if (post.platforms.includes('fb')) {
      const url = post.mediaUrls?.[0]
      if (post.mediaType === 'image' && url) { const r = await fbPages.publishPhoto(post.caption, url); fbPostId = r.post_id || r.id }
      else if (post.mediaType === 'video' && url) { const r = await fbPages.publishVideo(post.caption, url); fbPostId = r.id }
      else { const r = await fbPages.publishPost(post.caption); fbPostId = r.id }
    }
    if (post.platforms.includes('ig')) {
      const url = post.mediaUrls?.[0]
      if (!url || post.mediaType === 'none') throw new MetaApiError(400, null, 'Instagram requires an image or video')
      const r = await ig.publishMedia({ caption: post.caption, mediaUrl: url, mediaType: post.mediaType === 'video' ? 'video' : 'image' })
      igMediaId = r.id
    }
    await store.setPostStatus(post.id, 'published', { fbPostId, igMediaId, publishedAt: AdminTimestamp.now() as unknown as SocialPost['publishedAt'] })
    return { fbPostId, igMediaId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await store.setPostStatus(post.id, 'failed', { error: msg, attempts: (post.attempts || 0) + 1 })
    throw e
  }
}
