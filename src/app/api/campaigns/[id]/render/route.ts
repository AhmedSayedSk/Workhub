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
  const mode = body.mode === 'creative' ? 'creative' : 'basic'

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
  const domain = c.brief?.content?.link || undefined
  let script: import('@/types').CreativeScene[] | undefined
  if (mode === 'creative') {
    const { generateCampaignVideoScript } = await import('@/lib/gemini')
    const copyScenes = await generateCampaignVideoScript({
      brandName,
      goal: c.brief?.goal || '',
      audience: c.brief?.audience || '',
      tone: c.brief?.tone || '',
      language: c.language === 'ar' ? 'ar' : 'en',
      domain,
      posts: posts.map((p) => ({ headline: p.headline, body: p.body, caption: p.caption })),
    })
    // Interleave the real images as showcase scenes: hook, then alternate
    // copy/showcase, cta last. Cap at 9 scenes total.
    const images = posts.map((p) => p.imageUrl).filter(Boolean) as string[]
    const hook = copyScenes.find((s) => s.type === 'hook')
    const cta = copyScenes.find((s) => s.type === 'cta')
    const middle = copyScenes.filter((s) => s.type !== 'hook' && s.type !== 'cta')
    const out: import('@/types').CreativeScene[] = []
    if (hook) out.push(hook)
    let imgI = 0
    for (const s of middle) {
      out.push(s)
      if (imgI < images.length && out.length < 8) { out.push({ type: 'showcase', imageUrl: images[imgI++], caption: posts[imgI - 1]?.headline || '' }); }
    }
    while (imgI < images.length && out.length < 8) out.push({ type: 'showcase', imageUrl: images[imgI++], caption: '' })
    if (cta) out.push(cta)
    script = out.slice(0, 9)
  }

  const job = {
    campaignId: id,
    projectId: c.projectId,
    status: 'queued',
    aspect,
    mode,
    ...(script ? { script } : {}),
    hook: {
      headline: brandName,
      subtext: c.brief?.goal ? String(c.brief.goal).slice(0, 90) : 'See what we made',
      bgPrompt: `Premium cinematic on-brand hero background for "${brandName}", ${c.artDirection || c.style || 'sleek modern tech'}, deep rich colors, volumetric light, negative space for a headline, ${aspect} composition, high detail.`,
    },
    brand: { name: brandName, color: (c.brand?.colors && c.brand.colors[0]) || '#111827', logoUrl: c.brand?.logoUrl || c.brandImageUrl || null, domain: domain || null },
    scenes: posts.map((p) => ({ imageUrl: p.imageUrl, headline: p.headline || '', caption: (p.caption || '').slice(0, 140) })),
    createdAt: Date.now(),
  }
  const ref = await db().collection('renderJobs').add(job)
  return NextResponse.json({ jobId: ref.id })
}
