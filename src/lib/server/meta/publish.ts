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
export async function publishOne(
  post: SocialPost
): Promise<{ fbPostId: string | null; igMediaId: string | null; liPostId: string | null; published: string[]; failures: string[] }> {
  const creds = await getAccountCreds(post.projectId)
  const exec = <T>(fn: () => Promise<T>): Promise<T> => (creds ? metaContext.run(creds, fn) : fn())

  return exec(async () => {
    let fbPostId: string | null = post.fbPostId ?? null
    let igMediaId: string | null = post.igMediaId ?? null
    let liPostId: string | null = post.liPostId ?? null
    // Try each platform independently so one failure doesn't block the others, and
    // we can report exactly which platforms went live and which failed.
    const published: string[] = []
    const failures: string[] = []

    if (post.platforms.includes('fb') && !fbPostId) {
      try {
        const url = post.mediaUrls?.[0]
        if (post.mediaType === 'image' && url) { const r = await fbPages.publishPhoto(post.caption, url); fbPostId = r.post_id || r.id }
        else if (post.mediaType === 'video' && url) { const r = await fbPages.publishVideo(post.caption, url); fbPostId = r.id }
        else { const r = await fbPages.publishPost(post.caption); fbPostId = r.id }
        published.push('Facebook')
      } catch (e) {
        failures.push(`Facebook: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (post.platforms.includes('ig') && !igMediaId) {
      try {
        const url = post.mediaUrls?.[0]
        if (!url || post.mediaType === 'none') throw new MetaApiError(400, null, 'requires an image or video')
        const r = await ig.publishMedia({ caption: post.caption, mediaUrl: url, mediaType: post.mediaType === 'video' ? 'video' : 'image' })
        igMediaId = r.id
        published.push('Instagram')
      } catch (e) {
        failures.push(`Instagram: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (post.platforms.includes('li') && !liPostId) {
      try {
        const liCreds = await getLinkedInCreds(post.projectId)
        if (!liCreds) throw new Error('is not connected for this project (or the token expired — reconnect).')
        const url = post.mediaUrls?.[0]
        liPostId = await linkedin.publish(liCreds, {
          text: post.caption,
          mediaUrl: url,
          mediaType: post.mediaType === 'image' ? 'image' : 'none', // member video upload not yet supported → text-only
        })
        published.push('LinkedIn')
      } catch (e) {
        failures.push(`LinkedIn: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    const anyLive = !!(fbPostId || igMediaId || liPostId)
    const status = failures.length === 0 ? 'published' : 'failed'
    await store.setPostStatus(post.id, status, {
      fbPostId,
      igMediaId,
      liPostId,
      error: failures.length ? failures.join(' · ') : null,
      attempts: failures.length ? (post.attempts || 0) + 1 : post.attempts || 0,
      publishedAt: anyLive ? (AdminTimestamp.now() as unknown as SocialPost['publishedAt']) : post.publishedAt,
    })
    // Total failure (nothing went live) → throw so callers/cron treat it as failed.
    if (!anyLive) throw new Error(failures.join(' · ') || 'Publishing failed')
    return { fbPostId, igMediaId, liPostId, published, failures }
  })
}
