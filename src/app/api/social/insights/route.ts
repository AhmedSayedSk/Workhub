import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { fbPages, ig, MetaApiError } from '@/lib/server/meta'
import * as store from '@/lib/server/meta/store'
import type { InsightScope, SocialPlatform } from '@/types'

function normalize(data: any[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const entry of data ?? []) {
    if (!entry?.name) continue
    acc[entry.name] = Number(entry.values?.[0]?.value ?? 0)
  }
  return acc
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  const params = request.nextUrl.searchParams
  const scope = params.get('scope') as InsightScope | null
  const platform = params.get('platform') as SocialPlatform | null
  const refId = params.get('refId')

  if (scope !== 'account' && scope !== 'post') {
    return NextResponse.json({ error: "scope must be 'account' or 'post'" }, { status: 400 })
  }
  if (platform !== 'fb' && platform !== 'ig') {
    return NextResponse.json({ error: "platform must be 'fb' or 'ig'" }, { status: 400 })
  }
  if (scope === 'post' && !refId) {
    return NextResponse.json({ error: 'refId is required when scope is post' }, { status: 400 })
  }

  const cacheRefId = refId || platform

  try {
    let data: any[] = []
    if (scope === 'account' && platform === 'fb') {
      data = (await fbPages.getPageInsights()).data
    } else if (scope === 'account' && platform === 'ig') {
      data = (await ig.getAccountInsights()).data
    } else if (scope === 'post' && platform === 'ig') {
      data = (await ig.getMediaInsights(refId!)).data
    } else {
      // post + fb: per-post FB insights not in v1 client — fall back to cache or empty
      const cached = await store.latestInsight(scope, cacheRefId)
      if (cached) {
        return NextResponse.json({
          metrics: cached.metrics,
          capturedAt: (cached.capturedAt as any)?.toDate?.()?.toISOString?.() ?? null,
          platform,
          scope,
          stale: true,
        })
      }
      return NextResponse.json({ metrics: {}, capturedAt: new Date().toISOString(), platform, scope })
    }

    const metrics = normalize(data)
    await store.saveInsight({ scope, refId: cacheRefId, platform, metrics })

    return NextResponse.json({ metrics, capturedAt: new Date().toISOString(), platform, scope })
  } catch (error) {
    if (error instanceof MetaApiError) {
      const cached = await store.latestInsight(scope, cacheRefId)
      if (cached) {
        return NextResponse.json({
          metrics: cached.metrics,
          capturedAt: (cached.capturedAt as any)?.toDate?.()?.toISOString?.() ?? null,
          platform,
          scope,
          stale: true,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
