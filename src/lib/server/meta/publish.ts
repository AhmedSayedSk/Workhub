import 'server-only'
import { fbPages, ig, MetaApiError } from '@/lib/server/meta'
import { metaContext } from './client'
import { getAccountCreds } from './accounts'
import * as linkedin from '@/lib/server/linkedin/posts'
import { getLinkedInCreds } from '@/lib/server/linkedin/accounts'
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
export async function publishOne(post: SocialPost): Promise<{ fbPostId: string | null; igMediaId: string | null; liPostId: string | null }> {
  const creds = await getAccountCreds(post.projectId)
  const exec = <T>(fn: () => Promise<T>): Promise<T> => (creds ? metaContext.run(creds, fn) : fn())

  return exec(async () => {
    let fbPostId: string | null = post.fbPostId ?? null
    let igMediaId: string | null = post.igMediaId ?? null
    let liPostId: string | null = post.liPostId ?? null
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
      if (post.platforms.includes('li') && !liPostId) {
        const liCreds = await getLinkedInCreds(post.projectId)
        if (!liCreds) throw new MetaApiError(400, null, 'LinkedIn is not connected for this project (or the token expired — reconnect).')
        const url = post.mediaUrls?.[0]
        liPostId = await linkedin.publish(liCreds, {
          text: post.caption,
          mediaUrl: url,
          mediaType: post.mediaType === 'image' ? 'image' : 'none', // member video upload not yet supported → text-only
        })
      }
      await store.setPostStatus(post.id, 'published', { fbPostId, igMediaId, liPostId, publishedAt: AdminTimestamp.now() as unknown as SocialPost['publishedAt'] })
      return { fbPostId, igMediaId, liPostId }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // persist any platform that DID succeed so a retry skips it (idempotency)
      await store.setPostStatus(post.id, 'failed', { error: msg, attempts: (post.attempts || 0) + 1, fbPostId, igMediaId, liPostId })
      throw e
    }
  })
}
