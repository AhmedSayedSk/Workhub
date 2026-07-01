import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { requireAuth, verifyAuth } from '@/lib/api-auth'
import * as store from '@/lib/server/meta/store'
import { AdminTimestamp } from '@/lib/server/meta/store'
import { getAccountCreds } from '@/lib/server/meta/accounts'
import { metaContext } from '@/lib/server/meta/client'
import { graphFetch, MetaApiError } from '@/lib/server/meta'
import { getLinkedInCreds } from '@/lib/server/linkedin/accounts'
import { liFetch } from '@/lib/server/linkedin/client'
import type { SocialPlatform, SocialPost } from '@/types'

/**
 * Remove an already-published post from the selected platforms (deletes it on the
 * platform when supported, then clears our stored id). Reverts the post to draft
 * once it's no longer live anywhere.
 */
export async function POST(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    await verifyAuth(request)
    const body = await request.json()
    const id: string = body.id
    const platforms: SocialPlatform[] = Array.isArray(body.platforms) ? body.platforms : []
    if (!id || platforms.length === 0) {
      return NextResponse.json({ error: 'id and platforms are required' }, { status: 400 })
    }

    const post = await store.getPost(id)
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    const results: Record<string, string> = {}
    const patch: Partial<SocialPost> = {}
    let fbPostId = post.fbPostId
    let igMediaId = post.igMediaId
    let liPostId = post.liPostId

    // Facebook / Instagram share the Meta account context.
    if ((platforms.includes('fb') && fbPostId) || (platforms.includes('ig') && igMediaId)) {
      const creds = await getAccountCreds(post.projectId)
      const run = <T>(fn: () => Promise<T>): Promise<T> => (creds ? metaContext.run(creds, fn) : fn())

      if (platforms.includes('fb') && fbPostId) {
        try {
          await run(() => graphFetch(fbPostId as string, { method: 'DELETE' }))
          patch.fbPostId = null
          fbPostId = null
          results.fb = 'removed'
        } catch (e) {
          // Already gone on Facebook (deleted manually / no longer accessible) → treat as success (idempotent).
          const gone = e instanceof MetaApiError && ((e.body as any)?.error?.code === 100 || /does not exist|Unsupported delete request/i.test(e.message))
          if (gone) {
            patch.fbPostId = null
            fbPostId = null
            results.fb = 'already removed'
          } else {
            results.fb = e instanceof Error ? e.message : 'Failed to remove from Facebook'
          }
        }
      }
      if (platforms.includes('ig') && igMediaId) {
        try {
          await run(() => graphFetch(igMediaId as string, { method: 'DELETE' }))
          patch.igMediaId = null
          igMediaId = null
          results.ig = 'removed'
        } catch {
          // Meta's API can't delete published IG media. Since the user explicitly asked to
          // remove it, clear our tracking and tell them to delete it in the app.
          patch.igMediaId = null
          igMediaId = null
          results.ig = 'Instagram media must be deleted in the app — cleared from WorkHub tracking.'
        }
      }
    }

    // LinkedIn.
    if (platforms.includes('li') && liPostId) {
      const liCreds = await getLinkedInCreds(post.projectId)
      if (!liCreds) {
        results.li = 'LinkedIn not connected'
      } else {
        try {
          const res = await liFetch(liCreds.token, `/rest/posts/${encodeURIComponent(liPostId)}`, { method: 'DELETE' })
          if (res.ok || res.status === 204) {
            patch.liPostId = null
            liPostId = null
            results.li = 'removed'
          } else if (res.status === 404) {
            // Already gone on LinkedIn (deleted manually) → treat as success (idempotent).
            patch.liPostId = null
            liPostId = null
            results.li = 'already removed'
          } else {
            const t = await res.text().catch(() => '')
            results.li = `Failed (${res.status}) ${t.slice(0, 140)}`
          }
        } catch (e) {
          results.li = e instanceof Error ? e.message : 'Failed to remove from LinkedIn'
        }
      }
    }

    // No longer live anywhere → revert to draft.
    if (!fbPostId && !igMediaId && !liPostId) {
      patch.status = 'draft'
      patch.publishedAt = null
    }

    await admin.firestore().collection('socialPosts').doc(id).update({ ...patch, updatedAt: AdminTimestamp.now() })

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
