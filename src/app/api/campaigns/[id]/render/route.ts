import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
const db = () => admin.firestore()
const ASPECTS = ['portrait', 'landscape', 'square'] as const

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request)
  if (authError) return authError
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const aspect = ASPECTS.includes(body.aspect) ? body.aspect : 'portrait'

  const cSnap = await db().collection('campaigns').doc(id).get()
  if (!cSnap.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  const c = cSnap.data() as any

  const postsSnap = await db().collection('campaignPosts').where('campaignId', '==', id).get()
  const posts = postsSnap.docs
    .map((d) => d.data() as any)
    .filter((p) => p.imageUrl)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 6)
  if (!posts.length) return NextResponse.json({ error: 'Campaign has no generated images yet' }, { status: 400 })

  const brandName = c.brand?.name || c.name || 'Brand'
  const job = {
    campaignId: id,
    projectId: c.projectId,
    status: 'queued',
    aspect,
    hook: {
      headline: brandName,
      subtext: c.brief?.goal ? String(c.brief.goal).slice(0, 90) : 'See what we made',
      bgPrompt: `Premium cinematic on-brand hero background for "${brandName}", ${c.artDirection || c.style || 'sleek modern tech'}, deep rich colors, volumetric light, negative space for a headline, ${aspect} composition, high detail.`,
    },
    brand: { name: brandName, color: (c.brand?.colors && c.brand.colors[0]) || '#111827', logoUrl: c.brand?.logoUrl || c.brandImageUrl || null },
    scenes: posts.map((p) => ({ imageUrl: p.imageUrl, headline: p.headline || '', caption: (p.caption || '').slice(0, 140) })),
    createdAt: Date.now(),
  }
  const ref = await db().collection('renderJobs').add(job)
  return NextResponse.json({ jobId: ref.id })
}
