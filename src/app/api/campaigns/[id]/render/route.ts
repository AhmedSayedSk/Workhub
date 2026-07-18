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
  const transition = ['smooth', 'simple', 'none', 'cinematic', 'push'].includes(body.transition) ? body.transition : 'smooth'
  const sfx = { enabled: body.sfx?.enabled !== false } // sound effects default ON

  const cSnap = await db().collection('campaigns').doc(id).get()
  if (!cSnap.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  const c = cSnap.data() as any

  // Optional AI voiceover. Language defaults to the campaign language; gender/on-off from the request.
  const campaignLang: 'en' | 'ar' = c.language === 'ar' ? 'ar' : 'en'
  // Target market: adapts ALL copy + narration delivery to the market's culture.
  const { resolveMarket } = await import('@/lib/markets')
  const market = resolveMarket(body.market, campaignLang)
  const vo = body.voiceover && typeof body.voiceover === 'object' ? body.voiceover : null
  const VO_RATES = [0.9, 1, 1.1, 1.25, 1.5]
  // rate 0 = "auto" marker — resolved by the AI pace director once the final
  // narration copy is known (after script assembly, below).
  // Named, selectable voices — public ids only (engine voices are white-labeled
  // behind the TTS API). Each id implies a gender; 'mixed' alternates M/F.
  const VOICE_GENDER: Record<string, 'male' | 'female'> = { aria: 'female', nova: 'female', sami: 'male', omar: 'male' }
  const voLang = (vo && (vo.language === 'ar' || vo.language === 'en') ? vo.language : campaignLang) as 'en' | 'ar'
  const voVoice = vo && typeof vo.voice === 'string' && VOICE_GENDER[vo.voice] ? vo.voice as string : undefined
  const voStyle = voLang === 'ar'
    ? `Professional Arabic advertising voiceover. ${market.voiceNote} Clear Modern Standard Arabic (فصحى), premium and inviting; articulate, with lively but controlled pacing and clear emphasis on key words. Not stiff, not a monotone newsreader.`
    : `Warm, upbeat commercial voiceover for a brand advertisement. ${market.voiceNote} Friendly, confident and inviting with natural dynamic pacing.`
  const voiceover = vo && vo.enabled
    ? {
        enabled: true,
        language: voLang,
        // A named voice fixes the gender; otherwise fall back to the gender field.
        gender: (voVoice ? VOICE_GENDER[voVoice] : (['male', 'female', 'mixed'].includes(vo.gender) ? vo.gender : 'female')) as 'male' | 'female' | 'mixed',
        ...(voVoice ? { voice: voVoice } : {}),
        model: (vo.model === 'premium' ? 'premium' : 'standard') as 'standard' | 'premium',
        rate: VO_RATES.includes(Number(vo.rate)) ? Number(vo.rate) : 0,
        rateAuto: !VO_RATES.includes(Number(vo.rate)),
        style: voStyle,
      }
    : null

  const postsSnap = await db().collection('campaignPosts').where('campaignId', '==', id).get()
  const posts = postsSnap.docs
    .map((d) => d.data() as any)
    .filter((p) => p.imageUrl)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 6)
  if (!posts.length) return NextResponse.json({ error: 'Campaign has no generated images yet' }, { status: 400 })

  const brandName = c.brand?.name || c.name || 'Brand'
  const domain = c.brief?.content?.link || undefined
  const brandColor = (c.brand?.colors && c.brand.colors[0]) || null

  // Enabled scene styles (Scene Styles table) — the worker rotates within these.
  let sceneStyles: string[] = []
  try {
    const stSnap = await db().collection('sceneStyles').where('enabled', '==', true).get()
    sceneStyles = stSnap.docs.map((d) => d.id)
  } catch { /* absent collection -> worker uses all styles */ }

  // AI-proposed color system, contrast-enforced (WCAG) before it ships.
  const { generateVideoPalette } = await import('@/lib/gemini')
  const { finalizePalette } = await import('@/lib/palette')
  const rawPalette = await generateVideoPalette({ brandName, brandColor, tone: c.brief?.tone, goal: c.brief?.goal })
  const palette = finalizePalette(rawPalette, brandColor)
  // User-chosen opening hook (from /hook-options): overrides the script's hook
  // scene (creative) and the basic hook headline. 'auto'/absent = AI's own hook.
  const chosenHook = body.hook && typeof body.hook === 'object' && typeof body.hook.headline === 'string' && body.hook.headline.trim()
    ? {
        headline: String(body.hook.headline).slice(0, 120),
        ...(body.hook.underline ? { underline: String(body.hook.underline).slice(0, 60) } : {}),
        ...(body.hook.kicker ? { kicker: String(body.hook.kicker).slice(0, 40) } : {}),
      }
    : null
  let script: import('@/types').CreativeScene[] | undefined
  if (mode === 'creative') {
    const { generateCampaignVideoScript } = await import('@/lib/gemini')
    // The video script is narrative-critical — use the strongest model for it.
    const copyScenes = await generateCampaignVideoScript({
      ...(chosenHook ? { hook: { headline: chosenHook.headline, ...(body.hook?.style ? { style: String(body.hook.style) } : {}) } } : {}),
      brandName,
      goal: c.brief?.goal || '',
      cta: c.brief?.cta || undefined,
      audience: c.brief?.audience || '',
      tone: c.brief?.tone || '',
      language: market.lang, // script copy (incl. the opening hook) follows the selected market
      domain,
      cultureNote: market.cultureNote,
      posts: posts.map((p) => ({ headline: p.headline, body: p.body, caption: p.caption })),
    }, 'gemini-3-pro-preview')
    // MERGE each beat's copy INTO an image scene: every showcase = one scene
    // with the image on top and that beat's text (caption + sub) below it —
    // never a text-only beat followed by a separate image. Stats stay their own
    // designed moment, sprinkled between showcases. Reserve hook/cta slots so
    // the 9-scene cap never slices them off.
    const hook = copyScenes.find((s) => s.type === 'hook')
    const cta = copyScenes.find((s) => s.type === 'cta')
    // posts here are already filtered to those with imageUrl, so posts[i].imageUrl is defined.
    const maxMid = 9 - (hook ? 1 : 0) - (cta ? 1 : 0)
    // Short display line from post copy (fallback when Gemini gives fewer beats
    // than images): strip links/hashtags, keep the first sentence, cap length.
    const firstLine = (s?: string) => {
      if (!s) return ''
      const clean = String(s).replace(/https?:\/\/\S+/g, '').replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim()
      const m = clean.match(/^[^.!؟?\n]{6,90}[.!؟?]?/)
      return (m ? m[0] : clean).slice(0, 90).trim()
    }
    // PRESERVE the model's play order (its narrative arc): walk the copy scenes
    // in sequence — each beat rides the next campaign image; stats stay exactly
    // where the model placed them (proof right after the claim it supports).
    const mid: import('@/types').CreativeScene[] = []
    let pi = 0
    for (const s of copyScenes) {
      if (mid.length >= maxMid) break
      if (s.type === 'beat') {
        const p = posts[pi]
        if (p) {
          pi++
          mid.push({
            type: 'showcase',
            imageUrl: p.imageUrl as string,
            caption: s.title || p.headline || firstLine(p.caption) || firstLine(p.body) || '',
            ...(s.sub ? { sub: s.sub } : {}),
          })
        } else {
          mid.push(s) // more beats than images — keep the story beat as its own scene
        }
      } else if (s.type === 'stat') {
        mid.push(s)
      }
    }
    // Leftover images (more images than beats) still show, with post-copy captions.
    for (; pi < posts.length && mid.length < maxMid; pi++) {
      const p = posts[pi]
      mid.push({ type: 'showcase', imageUrl: p.imageUrl as string, caption: p.headline || firstLine(p.caption) || firstLine(p.body) || '' })
    }
    script = [...(hook ? [hook] : []), ...mid, ...(cta ? [cta] : [])]
  }

  if (chosenHook && script) {
    const i = script.findIndex((s) => s.type === 'hook')
    const hookScene = { type: 'hook' as const, ...chosenHook }
    if (i >= 0) script[i] = hookScene
    else script.unshift(hookScene)
  }

  // Auto speed: the AI pace director picks the rate from the campaign's energy,
  // language and the ACTUAL narration copy volume. Heuristic fallback inside.
  if (voiceover && voiceover.rateAuto) {
    const { chooseVoiceoverRate } = await import('@/lib/gemini')
    const sceneText = (s: import('@/types').CreativeScene): string => {
      switch (s.type) {
        case 'hook': return (s.headline || '').replace(/\n/g, ' ')
        case 'beat': return [s.title, s.sub].filter(Boolean).join('. ')
        case 'stat': return [s.value, s.label].filter(Boolean).join(' ')
        case 'showcase': return [s.caption, s.sub].filter(Boolean).join('. ')
        case 'cta': return s.text || ''
        default: return ''
      }
    }
    const lines = script
      ? script.map(sceneText).filter(Boolean)
      : [brandName, ...posts.map((p) => p.caption || p.headline || '')].filter(Boolean)
    const sampleCopy = lines.join(' — ')
    voiceover.rate = await chooseVoiceoverRate({
      brandName,
      tone: c.brief?.tone,
      audience: c.brief?.audience,
      goal: c.brief?.goal,
      language: voiceover.language,
      mode,
      sceneCount: script ? script.length : posts.length + 1,
      sampleCopy,
      totalChars: sampleCopy.length,
    })
  }

  const job = {
    campaignId: id,
    projectId: c.projectId,
    status: 'queued',
    aspect,
    mode,
    lang: campaignLang,
    market: market.code,
    transition,
    sfx,
    ...(sceneStyles.length ? { sceneStyles } : {}),
    palette,
    ...(voiceover ? { voiceover } : {}),
    ...(script ? { script } : {}),
    hook: {
      headline: chosenHook ? chosenHook.headline.replace(/\n/g, ' ') : brandName,
      subtext: c.brief?.goal ? String(c.brief.goal).slice(0, 90) : 'See what we made',
      // NOTE: never mention the brand NAME here — image models paint quoted
      // names as literal text, and our headline/logo are overlaid separately.
      bgPrompt: `Premium cinematic abstract hero background, ${c.artDirection || c.style || 'sleek modern tech'}, deep rich colors, volumetric light, soft depth of field, large clean negative space for overlaid copy, ${aspect} composition, high detail.`,
    },
    brand: { name: brandName, color: (c.brand?.colors && c.brand.colors[0]) || '#111827', logoUrl: c.brand?.logoUrl || c.brandImageUrl || null, domain: domain || null },
    scenes: posts.map((p) => ({ imageUrl: p.imageUrl, headline: p.headline || '', caption: (p.caption || '').slice(0, 140) })),
    createdAt: Date.now(),
  }
  const ref = await db().collection('renderJobs').add(stripUndefined(job))
  return NextResponse.json({ jobId: ref.id })
}
