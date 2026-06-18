import 'server-only'
import { fbPages, ig, MetaApiError } from '@/lib/server/meta'
import { metaContext } from './client'
import { getAccountCreds } from './accounts'
import * as store from './store'
import { AdminTimestamp } from './store'
import type { SocialPost } from '@/types'

/**
 * Publish an already-persisted post across its platforms; updates its status.
 * - Uses the project's Meta account (socialAccounts/{projectId}) when configured,
 *   otherwise the global env credentials.
 * - Idempotent: a platform that already has an id (fbPostId / igMediaId) is skipped,
 *   so re-runs and migrated posts never double-post.
 */
export async function publishOne(post: SocialPost): Promise<{ fbPostId: string | null; igMediaId: string | null }> {
  const creds = await getAccountCreds(post.projectId)
  const exec = <T>(fn: () => Promise<T>): Promise<T> => (creds ? metaContext.run(creds, fn) : fn())

  return exec(async () => {
    let fbPostId: string | null = post.fbPostId ?? null
    let igMediaId: string | null = post.igMediaId ?? null
    try {
      if (post.platforms.includes('fb') && !fbPostId) {
        const url = post.mediaUrls?.[0]
        if (post.mediaType === 'image' && url) { const r = await fbPages.publishPhoto(post.caption, url); fbPostId = r.post_id || r.id }
        else if (post.mediaType === 'video' && url) { const r = await fbPages.publishVideo(post.caption, url); fbPostId = r.id }
        else { const r = await fbPages.publishPost(post.caption); fbPostId = r.id }
      }
      if (post.platforms.includes('ig') && !igMediaId) {
        const url = post.mediaUrls?.[0]
        if (!url || post.mediaType === 'none') throw new MetaApiError(400, null, 'Instagram requires an image or video')
        const r = await ig.publishMedia({ caption: post.caption, mediaUrl: url, mediaType: post.mediaType === 'video' ? 'video' : 'image' })
        igMediaId = r.id
      }
      await store.setPostStatus(post.id, 'published', { fbPostId, igMediaId, publishedAt: AdminTimestamp.now() as unknown as SocialPost['publishedAt'] })
      return { fbPostId, igMediaId }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // persist any platform that DID succeed so a retry skips it (idempotency)
      await store.setPostStatus(post.id, 'failed', { error: msg, attempts: (post.attempts || 0) + 1, fbPostId, igMediaId })
      throw e
    }
  })
}
