import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth'
import { requireModule } from '@/lib/api-auth'
import { adgen, AdGenError } from '@/lib/adgen'
import { resolveMarket } from '@/lib/markets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const db = () => admin.firestore()

const CACHE_MS = 24 * 60 * 60 * 1000 // regenerate at most daily unless forced

// Returns AI-written opening-hook options (one set per ad-hook archetype) for
// this campaign, in the selected market's language. Cached on the campaign doc.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireModule(request, 'accessImageGenerator')
  if (authError) return authError
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))

  const cSnap = await db().collection('campaigns').doc(id).get()
  if (!cSnap.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  const c = cSnap.data() as any

  const market = resolveMarket(body.market, c.language === 'ar' ? 'ar' : 'en')

  const cached = c.hookOptions
  // (lang check invalidates pre-bilingual caches; market check re-generates per market)
  if (!body.force && cached?.items?.length && cached.items[0]?.lang && cached.market === market.code && Date.now() - (cached.updatedAt || 0) < CACHE_MS) {
    return NextResponse.json({ options: cached.items, cached: true })
  }

  // Hooks are written from the campaign AdGen itself planned, so a campaign
  // that predates the switch (or whose planning failed) has nothing to work
  // from and must be planned again first.
  const adgenCampaignId = typeof c.adgenCampaignId === 'string' ? c.adgenCampaignId : ''
  if (!adgenCampaignId) {
    return NextResponse.json(
      { error: 'This campaign has no plan yet — generate the plan again before creating hooks' },
      { status: 409 }
    )
  }

  try {
    const { options } = await adgen.hooks(adgenCampaignId, { market: market.code, force: !!body.force })
    if (!options?.length) {
      return NextResponse.json({ error: 'No hook options were generated' }, { status: 502 })
    }

    await db()
      .collection('campaigns')
      .doc(id)
      .set({ hookOptions: { items: options, market: market.code, updatedAt: Date.now() } }, { merge: true })
    return NextResponse.json({ options })
  } catch (e) {
    const status = e instanceof AdGenError ? e.status : 500
    return NextResponse.json({ error: (e as Error).message }, { status })
  }
}
