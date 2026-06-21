import 'server-only'
import { graphFetch, metaEnv } from './client'

/**
 * Facebook Page write/insights calls require a PAGE access token, not the
 * system-user token. We fetch it on demand from the Page node (the system-user
 * token may read it because the system user has Full control of the Page).
 */
async function pageToken(): Promise<string> {
  const { pageId } = metaEnv()
  const r = await graphFetch<{ access_token: string }>(`${pageId}`, { params: { fields: 'access_token' } })
  return r.access_token
}

export async function publishPost(caption: string, link?: string) {
  const { pageId } = metaEnv()
  const access_token = await pageToken()
  return graphFetch<{ id: string }>(`${pageId}/feed`, {
    method: 'POST', body: { message: caption, ...(link ? { link } : {}) }, params: { access_token },
  })
}
export async function publishPhoto(caption: string, imageUrl: string) {
  const { pageId } = metaEnv()
  const access_token = await pageToken()
  return graphFetch<{ id: string; post_id?: string }>(`${pageId}/photos`, {
    method: 'POST', body: { url: imageUrl, caption }, params: { access_token },
  })
}
export async function publishVideo(caption: string, videoUrl: string) {
  const { pageId } = metaEnv()
  const access_token = await pageToken()
  return graphFetch<{ id: string }>(`${pageId}/videos`, {
    method: 'POST', body: { file_url: videoUrl, description: caption }, params: { access_token },
  })
}
export async function listPosts(limit = 25) {
  const { pageId } = metaEnv()
  const access_token = await pageToken()
  return graphFetch<{ data: any[] }>(`${pageId}/posts`, {
    params: { fields: 'id,message,created_time,permalink_url', limit, access_token },
  })
}

/**
 * Current valid Page insight metrics (older ones like page_impressions / page_fans
 * are deprecated). Follower count is read from the Page node's followers_count and
 * appended as a synthetic `page_followers` entry so the UI can render it uniformly.
 */
// Note: page_impressions_unique / page_impressions were retired by Meta (Graph v19+) and
// return "(#100) The value must be a valid insights metric", which fails the whole call.
// Only request metrics still supported in the current Graph version.
export async function getPageInsights(metrics = ['page_post_engagements', 'page_views_total']) {
  const { pageId } = metaEnv()
  const access_token = await pageToken()
  const [insights, page] = await Promise.all([
    graphFetch<{ data: any[] }>(`${pageId}/insights`, { params: { metric: metrics.join(','), period: 'day', access_token } }),
    graphFetch<{ fan_count: number; followers_count: number }>(`${pageId}`, { params: { fields: 'fan_count,followers_count', access_token } }),
  ])
  insights.data = insights.data || []
  insights.data.push({ name: 'page_followers', period: 'day', values: [{ value: page.followers_count ?? page.fan_count ?? 0 }] })
  return insights
}
