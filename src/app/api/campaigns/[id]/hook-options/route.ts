import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
const db = () => admin.firestore()

const CACHE_MS = 24 * 60 * 60 * 1000 // regenerate at most daily unless forced

// Returns 5 AI-written opening-hook options (one per ad-hook archetype) for
// this campaign, in the campaign's language. Cached on the campaign doc.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request)
  if (authError) return authError
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))

  const cSnap = await db().collection('campaigns').doc(id).get()
  if (!cSnap.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  const c = cSnap.data() as any

  const cached = c.hookOptions
  if (!body.force && cached?.items?.length && Date.now() - (cached.updatedAt || 0) < CACHE_MS) {
    return NextResponse.json({ options: cached.items, cached: true })
  }

  const postsSnap = await db().collection('campaignPosts').where('campaignId', '==', id).get()
  const postsCopy = postsSnap.docs
    .map((d) => d.data() as any)
    .map((p) => [p.headline, p.body, p.caption].filter(Boolean).join(' — '))
    .filter(Boolean)
    .slice(0, 8)
    .join('\n')

  const { generateHookOptions } = await import('@/lib/gemini')
  const options = await generateHookOptions({
    brandName: c.brand?.name || c.name || 'Brand',
    goal: c.brief?.goal,
    audience: c.brief?.audience,
    tone: c.brief?.tone,
    language: c.language === 'ar' ? 'ar' : 'en',
    postsCopy,
  })

  await db().collection('campaigns').doc(id).set({ hookOptions: { items: options, updatedAt: Date.now() } }, { merge: true })
  return NextResponse.json({ options })
}
