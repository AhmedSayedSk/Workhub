import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/server/meta/store'
import { publishOne } from '@/lib/server/meta/publish'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.META_CRON_SECRET || secret !== process.env.META_CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const now = Date.now()
  const due = await store.getDuePosts(now)
  const igCount24h = await store.countIgPublishedSince(now - 24 * 60 * 60 * 1000)
  let published = 0, failed = 0, skipped = 0, igUsed = igCount24h
  for (const post of due) {
    // IG rate guard: ~50 posts / rolling 24h
    if (post.platforms.includes('ig') && igUsed >= 50) { skipped++; continue }
    try {
      await store.setPostStatus(post.id, 'publishing')
      const r = await publishOne(post)
      if (r.igMediaId) igUsed++
      published++
    } catch { failed++ }
  }
  return NextResponse.json({ processed: due.length, published, failed, skipped })
}
