import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
const db = () => admin.firestore()
const ASPECTS = ['portrait', 'landscape', 'square'] as const

// Firestore rejects `undefined` values anywhere in a document. Recursively drop
// undefined-valued keys so an optional scene field (e.g. cta.url) never fails the write.
function stripUndefined<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripUndefined) as unknown as T
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) out[k] = stripUndefined(val)
    }
    return out as T
  }
  return v
}

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
    // copy/showcase, cta last. Reserve slots for hook/cta so the cap never
    // slices them off. Cap at 9 scenes total.
    const hook = copyScenes.find((s) => s.type === 'hook')
    const cta = copyScenes.find((s) => s.type === 'cta')
    const middle = copyScenes.filter((s) => s.type !== 'hook' && s.type !== 'cta')
    // posts here are already filtered to those with imageUrl, so posts[i].imageUrl is defined.
    const maxMid = 9 - (hook ? 1 : 0) - (cta ? 1 : 0)
    const mid: import('@/types').CreativeScene[] = []
    let imgI = 0
    for (const s of middle) {
      if (mid.length >= maxMid) break
      mid.push(s)
      if (imgI < posts.length && mid.length < maxMid) {
        mid.push({ type: 'showcase', imageUrl: posts[imgI].imageUrl as string, caption: posts[imgI].headline || '' })
        imgI++
      }
    }
    while (imgI < posts.length && mid.length < maxMid) {
      mid.push({ type: 'showcase', imageUrl: posts[imgI].imageUrl as string, caption: '' })
      imgI++
    }
    script = [...(hook ? [hook] : []), ...mid, ...(cta ? [cta] : [])]
  }

  const job = {
    campaignId: id,
    projectId: c.projectId,
    status: 'queued',
    aspect,
    mode,
    lang: c.language === 'ar' ? 'ar' : 'en',
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
  const ref = await db().collection('renderJobs').add(stripUndefined(job))
  return NextResponse.json({ jobId: ref.id })
}
