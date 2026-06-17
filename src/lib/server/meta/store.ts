import 'server-only'
import * as admin from 'firebase-admin'
import '@/lib/api-auth' // side-effect: ensures admin app initialized
import type { SocialPost, SocialPostInput, SocialPostStatus, SocialInsight, InsightScope } from '@/types'

const db = () => admin.firestore()
export const AdminTimestamp = admin.firestore.Timestamp

export async function getPost(id: string): Promise<SocialPost | null> {
  const snap = await db().collection('socialPosts').doc(id).get()
  return snap.exists ? ({ id: snap.id, ...(snap.data() as object) } as SocialPost) : null
}
export async function addPost(input: SocialPostInput): Promise<string> {
  const now = AdminTimestamp.now()
  const ref = await db().collection('socialPosts').add({ ...input, createdAt: now, updatedAt: now })
  return ref.id
}
export async function setPostStatus(id: string, status: SocialPostStatus, extra: Partial<SocialPost> = {}): Promise<void> {
  await db().collection('socialPosts').doc(id).update({ ...extra, status, updatedAt: AdminTimestamp.now() })
}
export async function getDuePosts(nowMs: number): Promise<SocialPost[]> {
  const snap = await db().collection('socialPosts').where('status', '==', 'scheduled').get()
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as SocialPost)
  return all.filter((p) => p.scheduledAt && (p.scheduledAt as admin.firestore.Timestamp).toMillis() <= nowMs)
}
// count posts published to IG since a timestamp (for the 24h IG rate guard)
export async function countIgPublishedSince(sinceMs: number): Promise<number> {
  const snap = await db().collection('socialPosts').where('status', '==', 'published').get()
  return snap.docs.map((d) => d.data() as SocialPost)
    .filter((p) => p.igMediaId && p.publishedAt && (p.publishedAt as admin.firestore.Timestamp).toMillis() >= sinceMs).length
}
export async function saveInsight(input: Omit<SocialInsight, 'id' | 'capturedAt'> & { capturedAt?: admin.firestore.Timestamp }): Promise<void> {
  await db().collection('socialInsights').add({ ...input, capturedAt: input.capturedAt ?? AdminTimestamp.now() })
}
export async function latestInsight(scope: InsightScope, refId: string): Promise<SocialInsight | null> {
  const snap = await db().collection('socialInsights').where('scope', '==', scope).where('refId', '==', refId).get()
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as SocialInsight)
  all.sort((a, b) => ((b.capturedAt as admin.firestore.Timestamp)?.toMillis?.() || 0) - ((a.capturedAt as admin.firestore.Timestamp)?.toMillis?.() || 0))
  return all[0] || null
}
