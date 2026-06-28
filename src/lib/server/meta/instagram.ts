import 'server-only'
import { graphFetch, metaEnv, MetaApiError } from './client'

export async function publishMedia(opts: {
  caption: string; mediaUrl: string; mediaType: 'image' | 'video'
}): Promise<{ id: string }> {
  const { igUserId } = metaEnv()
  if (!igUserId) throw new MetaApiError(500, null, 'META_IG_USER_ID is not set')

  const container = await graphFetch<{ id: string }>(`${igUserId}/media`, {
    method: 'POST',
    body: opts.mediaType === 'video'
      ? { media_type: 'REELS', video_url: opts.mediaUrl, caption: opts.caption }
      : { image_url: opts.mediaUrl, caption: opts.caption },
  })

  // Wait for the container to finish processing before publishing — for IMAGES too:
  // IG fetches the remote URL asynchronously, and publishing too early fails with
  // "Media ID is not available". (Images finish fast; video can take longer.)
  const maxTries = opts.mediaType === 'video' ? 20 : 12
  const waitMs = opts.mediaType === 'video' ? 3000 : 1500
  for (let i = 0; i < maxTries; i++) {
    const s = await graphFetch<{ status_code: string }>(`${container.id}`, { params: { fields: 'status_code' } })
    if (s.status_code === 'FINISHED') break
    if (s.status_code === 'ERROR') throw new MetaApiError(502, s, 'IG media processing failed')
    await new Promise((r) => setTimeout(r, waitMs))
  }

  return graphFetch<{ id: string }>(`${igUserId}/media_publish`, {
    method: 'POST', body: { creation_id: container.id },
  })
}

export async function listMedia(limit = 25) {
  const { igUserId } = metaEnv()
  return graphFetch<{ data: any[] }>(`${igUserId}/media`, {
    params: { fields: 'id,caption,media_type,media_url,permalink,timestamp', limit },
  })
}
/**
 * `reach` requires metric_type=total_value in the current API; follower/media
 * counts are read from the IG user node (the insights `follower_count` series is
 * empty for accounts without recent follower changes). Returns a normalized
 * `{ data: [{ name, values: [{ value }] }] }` shape the insights route understands.
 */
export async function getAccountInsights() {
  const { igUserId } = metaEnv()
  const [reach, profile] = await Promise.all([
    graphFetch<{ data: { total_value?: { value: number } }[] }>(`${igUserId}/insights`, {
      params: { metric: 'reach', period: 'day', metric_type: 'total_value' },
    }),
    graphFetch<{ followers_count: number; media_count: number }>(`${igUserId}`, {
      params: { fields: 'followers_count,media_count' },
    }),
  ])
  return {
    data: [
      { name: 'reach', period: 'day', values: [{ value: reach.data?.[0]?.total_value?.value ?? 0 }] },
      { name: 'followers_count', period: 'day', values: [{ value: profile.followers_count ?? 0 }] },
      { name: 'media_count', period: 'day', values: [{ value: profile.media_count ?? 0 }] },
    ],
  }
}
// Note: the `impressions` media metric was retired by Meta for reels/video product types
// ("The Media Insights API does not support the impressions metric...") — `views` replaces it.
export async function getMediaInsights(mediaId: string, metrics = ['views', 'reach', 'likes', 'comments']) {
  return graphFetch<{ data: any[] }>(`${mediaId}/insights`, { params: { metric: metrics.join(',') } })
}
