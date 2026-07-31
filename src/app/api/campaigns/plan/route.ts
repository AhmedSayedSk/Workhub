import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth' // side-effect: ensures the Admin app is initialized
import { requireModule } from '@/lib/api-auth'
import { adgen } from '@/lib/adgen'
import { campaignToBrief, campaignLanguage, type CampaignDoc } from '@/lib/adgenBrief'
import { resolveMarket } from '@/lib/markets'

// Background campaign planning. The request returns immediately after flipping
// the campaign to `planning`; the AdGen call + post writes run in `after()` on
// the long-lived Node server, so the browser can navigate away or reload
// freely. The client observes progress via Firestore listeners on the campaign
// + its posts — it never reads this route's response body.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db = () => admin.firestore()
const T = admin.firestore.Timestamp

export async function POST(request: NextRequest) {
  const authError = await requireModule(request, 'accessImageGenerator')
  if (authError) return authError

  try {
    const { campaignId } = await request.json()
    if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })

    const ref = db().collection('campaigns').doc(campaignId)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    const camp = snap.data() as CampaignDoc

    // Flip to planning right away so every client reflects it.
    await ref.update({ status: 'planning', planError: null, updatedAt: T.now() })

    after(async () => {
      try {
        // Campaigns carry no market of their own; use the language's default,
        // the same fallback the hooks and render routes apply.
        const market = resolveMarket(undefined, campaignLanguage(camp)).code
        const campaign = await adgen.createCampaign(campaignToBrief(camp, market))
        const posts = campaign.posts || []
        if (posts.length === 0) throw new Error('No posts were generated')

        // Replace any existing draft posts.
        const old = await db().collection('campaignPosts').where('campaignId', '==', campaignId).get()
        const batch = db().batch()
        old.docs.forEach((d) => batch.delete(d.ref))
        posts.forEach((p, i) => {
          batch.set(db().collection('campaignPosts').doc(), {
            campaignId,
            order: i,
            caption: p.caption || '',
            hashtags: p.hashtags || [],
            imagePrompt: p.imagePrompt || '',
            headline: p.headline || '',
            body: p.body || '',
            aspect: camp.aspect || 'portrait',
            imageUrl: null,
            status: 'planned',
            socialPostId: null,
            scheduledAt: null,
            createdAt: T.now(),
            updatedAt: T.now(),
          })
        })
        await batch.commit()

        await ref.update({
          status: 'ready',
          postCount: posts.length,
          scheduledCount: 0,
          // The shared visual identity, when one was requested.
          artDirection: campaign.artDirection || '',
          // Ties this campaign to its AdGen counterpart — required by the
          // hook-options and video routes.
          adgenCampaignId: campaign.id,
          planError: null,
          updatedAt: T.now(),
        })
      } catch (e) {
        await ref
          .update({ status: 'draft', planError: (e as Error).message, updatedAt: T.now() })
          .catch(() => {})
      }
    })

    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
