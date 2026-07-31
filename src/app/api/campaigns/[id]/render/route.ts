import { NextRequest, NextResponse, after } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth'
import { requireModule } from '@/lib/api-auth'
import { adgen, AdGenError, type AdGenVideoOptions } from '@/lib/adgen'
import { RENDER_ENGINE } from '@/lib/adgenMirror'
import { settleRenderJob } from '@/lib/renderMirror'
import { renderJobMirror } from '@/lib/server/renderJobMirror'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
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

/**
 * Start a campaign video render.
 *
 * The render itself runs on the campaign service; this route owns the job
 * document the UI watches. The returned `jobId` is the **Firestore** id — the
 * client listener is keyed on it — and the service's own id is kept alongside
 * as `adgenJobId` so the webhook can find the document again.
 *
 * Script, palette and hook copy are no longer written here: they are options on
 * the render request now, generated service-side from the same campaign.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireModule(request, 'accessImageGenerator')
  if (authError) return authError
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const aspect = ASPECTS.includes(body.aspect) ? body.aspect : 'portrait'
  const mode = body.mode === 'creative' ? 'creative' : 'basic'
  const transition = ['smooth', 'simple', 'none', 'cinematic', 'push'].includes(body.transition) ? body.transition : 'smooth'
  const sfx = { enabled: body.sfx?.enabled !== false } // sound effects default ON
  const captions = body.captions !== false // karaoke captions default ON (only render with voiceover)
  const AR_FONT_IDS = ['cairo', 'tajawal', 'almarai', 'changa', 'messiri', 'amiri', 'lalezar']
  const arFont = AR_FONT_IDS.includes(body.arFont) ? body.arFont : 'cairo'
  const subtitles = body.subtitles !== false // scene secondary lines default ON
  const videoHook = !!body.videoHook // stock-footage hook background instead of the AI image

  const cSnap = await db().collection('campaigns').doc(id).get()
  if (!cSnap.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  const c = cSnap.data() as any

  // The render is a job against the PLANNED campaign held by the service. A
  // campaign planned before the switch has no such id — replanning creates one.
  const adgenCampaignId = typeof c.adgenCampaignId === 'string' ? c.adgenCampaignId.trim() : ''
  if (!adgenCampaignId) {
    return NextResponse.json(
      { error: 'This campaign has no plan yet — generate the plan again before rendering a video' },
      { status: 409 }
    )
  }

  // Optional AI voiceover. Language defaults to the campaign language; gender/on-off from the request.
  const campaignLang: 'en' | 'ar' = c.language === 'ar' ? 'ar' : 'en'
  // Target market: adapts ALL copy + narration delivery to the market's culture.
  const { resolveMarket } = await import('@/lib/markets')
  const market = resolveMarket(body.market, campaignLang)
  const vo = body.voiceover && typeof body.voiceover === 'object' ? body.voiceover : null
  const VO_RATES = [0.9, 1, 1.1, 1.25, 1.5]
  // Named, selectable voices — public ids only (engine voices are white-labeled
  // behind the speech service). Each id implies a gender; 'mixed' alternates M/F.
  const VOICE_GENDER: Record<string, 'male' | 'female'> = { aria: 'female', nova: 'female', sami: 'male', omar: 'male' }
  // Narration language follows the SELECTED MARKET (matching the script copy);
  // an explicit user choice still wins.
  const voLang = (vo && (vo.language === 'ar' || vo.language === 'en') ? vo.language : market.lang) as 'en' | 'ar'
  // 'mixed' is a voice choice of its own — the UI sends it as gender with no
  // voice id, the service takes it as the voice.
  const voVoice = vo && typeof vo.voice === 'string' && VOICE_GENDER[vo.voice]
    ? (vo.voice as string)
    : (vo && vo.gender === 'mixed' ? 'mixed' : undefined)
  // rate 'auto' (or anything off the ladder) = let the service pace it.
  const voRate = vo && VO_RATES.includes(Number(vo.rate)) ? Number(vo.rate) : undefined
  const voiceover = vo && vo.enabled
    ? {
        enabled: true,
        language: voLang,
        // A named voice fixes the gender; otherwise fall back to the gender field.
        gender: (voVoice && VOICE_GENDER[voVoice]
          ? VOICE_GENDER[voVoice]
          : (['male', 'female', 'mixed'].includes(vo.gender) ? vo.gender : 'female')) as 'male' | 'female' | 'mixed',
        ...(voVoice ? { voice: voVoice } : {}),
        model: (vo.model === 'premium' ? 'premium' : 'standard') as 'standard' | 'premium',
        ...(voRate !== undefined ? { rate: voRate } : {}),
        rateAuto: voRate === undefined,
      }
    : null

  const postsSnap = await db().collection('campaignPosts').where('campaignId', '==', id).get()
  const posts = postsSnap.docs
    .map((d) => d.data() as any)
    .filter((p) => p.imageUrl)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 6)
  if (!posts.length) {
    // TEMP DIAGNOSTIC — remove once the render path is verified.
    const all = postsSnap.docs.map((d) => d.data() as any)
    return NextResponse.json(
      {
        error: 'DIAGPROBE no images',
        _diag: {
          queriedId: id,
          docsForCampaign: postsSnap.size,
          withImageUrl: all.filter((p) => p.imageUrl).length,
          sampleCampaignIds: all.slice(0, 3).map((p) => p.campaignId),
          projectId: (admin.app().options.credential as any)?.projectId
            ?? (admin.app().options as any)?.projectId ?? null,
          appName: admin.app().name,
          appCount: admin.apps.length,
        },
      },
      { status: 400 }
    )
  }

  // Optional per-render override from the modal's Project name input.
  const brandName = (typeof body.brandName === 'string' && body.brandName.trim())
    ? body.brandName.trim().slice(0, 60)
    : (c.brand?.name || c.name || 'Brand')
  const domain = c.brief?.content?.link || undefined

  // Enabled scene styles (Scene Styles table) — the renderer rotates within these.
  let sceneStyles: string[] = []
  try {
    const stSnap = await db().collection('sceneStyles').where('enabled', '==', true).get()
    sceneStyles = stSnap.docs.map((d) => d.id)
  } catch { /* absent collection -> all styles */ }

  // User-chosen opening hook (from /hook-options). Absent = the service writes
  // its own, which differs on every render — hence the UI's warning.
  const chosenHook = body.hook && typeof body.hook === 'object' && typeof body.hook.headline === 'string' && body.hook.headline.trim()
    ? {
        headline: String(body.hook.headline).slice(0, 120),
        ...(body.hook.underline ? { underline: String(body.hook.underline).slice(0, 60) } : {}),
        ...(body.hook.kicker ? { kicker: String(body.hook.kicker).slice(0, 40) } : {}),
      }
    : null

  // The job document the UI watches. Created BEFORE the render is queued so a
  // failure to start is visible in the card instead of vanishing with the
  // response; `engine` marks it as a service-run render (the previous worker
  // wrote its own jobs and had no such field).
  const job = {
    campaignId: id,
    projectId: c.projectId,
    engine: RENDER_ENGINE,
    status: 'queued',
    progress: 0,
    stage: 'preparing',
    aspect,
    mode,
    lang: campaignLang,
    market: market.code,
    transition,
    sfx,
    captions,
    arFont,
    subtitles,
    videoHook,
    ...(sceneStyles.length ? { sceneStyles } : {}),
    ...(voiceover ? { voiceover } : {}),
    hook: {
      headline: chosenHook ? chosenHook.headline.replace(/\n/g, ' ') : brandName,
      subtext: c.brief?.goal ? String(c.brief.goal).slice(0, 90) : 'See what we made',
    },
    brand: { name: brandName, color: (c.brand?.colors && c.brand.colors[0]) || '#111827', logoUrl: c.brand?.logoUrl || c.brandImageUrl || null, domain: domain || null },
    scenes: posts.map((p) => ({ imageUrl: p.imageUrl, headline: p.headline || '', caption: (p.caption || '').slice(0, 140) })),
    createdAt: Date.now(),
  }
  const ref = await db().collection('renderJobs').add(stripUndefined(job))

  const options: AdGenVideoOptions = {
    aspect,
    mode,
    market: market.code,
    transition,
    sfx,
    captions,
    subtitles,
    arFont,
    videoHook,
    brandName,
    ...(sceneStyles.length ? { sceneStyles } : {}),
    ...(chosenHook ? { hook: chosenHook } : {}),
    ...(voiceover
      ? { voiceover: { enabled: true, language: voiceover.language, ...(voiceover.voice ? { voice: voiceover.voice } : {}), model: voiceover.model, ...(voRate !== undefined ? { rate: voRate } : {}) } }
      : { voiceover: { enabled: false } }),
  }

  let adgenJobId: string
  try {
    ({ jobId: adgenJobId } = await adgen.renderVideo(adgenCampaignId, options))
  } catch (e) {
    const status = e instanceof AdGenError ? e.status : 500
    // AdGenError messages are already scrubbed of the service credential.
    const message = e instanceof AdGenError ? e.message : 'Could not start the video render'
    // Settle the document so the card shows the failure instead of spinning.
    await ref.update({ status: 'failed', error: message, finishedAt: Date.now() }).catch(() => { /* the response still reports it */ })
    return NextResponse.json({ error: message }, { status })
  }

  try {
    // Written second: the webhook finds this document BY this id, so the render
    // must exist before the id can be stored.
    await ref.update({ adgenJobId })
  } catch {
    // The render is running and nothing can ever be linked back to it. Stop it
    // rather than pay for a video no one will receive, and settle the card.
    await adgen.cancelJob(adgenJobId).catch(() => { /* best effort */ })
    await ref.update({ status: 'failed', error: 'Could not track the render — try again', finishedAt: Date.now() })
      .catch(() => { /* the response still reports it */ })
    return NextResponse.json({ error: 'Could not track the render — try again' }, { status: 500 })
  }

  // Close the delivery window. A terminal webhook fired between the document
  // being created and `adgenJobId` being stored found nothing to write to, was
  // answered 200 and will never be retried — so pull the state once, now, off
  // the response path.
  after(async () => {
    try {
      await settleRenderJob(
        { id: ref.id, status: 'queued', engine: RENDER_ENGINE, adgenJobId, createdAt: job.createdAt },
        {
          getJob: (jobId) => adgen.getJob(jobId),
          mirror: (docId, decide) => renderJobMirror.byDocId(docId, decide),
          nowMs: Date.now(),
        }
      )
    } catch { /* the poll and the sweep both cover this */ }
  })

  return NextResponse.json({ jobId: ref.id })
}
