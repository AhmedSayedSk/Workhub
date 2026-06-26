import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth' // side-effect: ensures the Admin app is initialized
import { requireAuth } from '@/lib/api-auth'
import { generateCampaignPosts } from '@/lib/gemini'

// Background campaign planning. The request returns immediately after flipping the
// campaign to `planning`; the Gemini call + post writes run in `after()` on the
// long-lived Node server, so the browser can navigate away or reload freely. The
// client observes progress via Firestore listeners on the campaign + its posts.
export const dynamic = 'force-dynamic'

const db = () => admin.firestore()
const T = admin.firestore.Timestamp

interface CampaignDoc {
  projectId: string
  brand?: { name?: string }
  brief?: { goal?: string; audience?: string; tone?: string; count?: number }
  language?: string
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const { campaignId } = await request.json()
    if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })

    const ref = db().collection('campaigns').doc(campaignId)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    const camp = snap.data() as CampaignDoc

    // Build the brand/product context from the project (server-side).
    let context = camp.brand?.name || ''
    try {
      const proj = (await db().collection('projects').doc(camp.projectId).get()).data() as
        | { name?: string; description?: string; projectType?: string; clientName?: string }
        | undefined
      if (proj) {
        context = [
          proj.name,
          proj.description,
          proj.projectType ? `Type: ${proj.projectType}` : '',
          proj.clientName ? `Client: ${proj.clientName}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      }
    } catch {
      /* fall back to brand name */
    }

    // Flip to planning right away so every client reflects it.
    await ref.update({ status: 'planning', planError: null, updatedAt: T.now() })

    after(async () => {
      try {
        const posts = await generateCampaignPosts({
          context,
          brandName: camp.brand?.name || '',
          goal: camp.brief?.goal || '',
          audience: camp.brief?.audience || '',
          tone: camp.brief?.tone || '',
          count: camp.brief?.count || 4,
          language: camp.language === 'ar' ? 'ar' : 'en',
        })
        if (posts.length === 0) throw new Error('No posts were generated')

        // Replace any existing draft posts.
        const old = await db().collection('campaignPosts').where('campaignId', '==', campaignId).get()
        const batch = db().batch()
        old.docs.forEach((d) => batch.delete(d.ref))
        posts.forEach((p, i) => {
          batch.set(db().collection('campaignPosts').doc(), {
            campaignId,
            order: i,
            caption: p.caption,
            hashtags: p.hashtags,
            imagePrompt: p.imagePrompt,
            aspect: 'portrait',
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
