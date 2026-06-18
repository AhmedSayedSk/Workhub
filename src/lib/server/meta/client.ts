import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'

const V = process.env.META_GRAPH_VERSION || 'v21.0'
const BASE = `https://graph.facebook.com/${V}`

export class MetaApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message)
    this.name = 'MetaApiError'
  }
}

export type MetaCreds = { token: string; pageId: string; igUserId: string; adAccountId: string }

/**
 * Per-project credential context. Publishing for a specific project runs within
 * `metaContext.run(creds, ...)`, so metaEnv() — and therefore graphFetch / pages /
 * instagram — use that project's Page/IG/token instead of the global env defaults.
 */
export const metaContext = new AsyncLocalStorage<MetaCreds>()

export function metaEnv(): MetaCreds {
  const ctx = metaContext.getStore()
  if (ctx) return ctx
  const token = process.env.META_SYSTEM_TOKEN
  if (!token) throw new MetaApiError(500, null, 'META_SYSTEM_TOKEN is not set')
  return {
    token,
    pageId: process.env.META_PAGE_ID || '',
    igUserId: process.env.META_IG_USER_ID || '',
    adAccountId: process.env.META_AD_ACCOUNT_ID || '',
  }
}

type GraphInit = { method?: 'GET' | 'POST' | 'DELETE'; params?: Record<string, string | number | undefined>; body?: Record<string, unknown> }

export async function graphFetch<T = any>(path: string, init: GraphInit = {}, attempt = 0): Promise<T> {
  const { token } = metaEnv()
  const url = new URL(`${BASE}/${path.replace(/^\//, '')}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(init.params || {})) if (v !== undefined) url.searchParams.set(k, String(v))

  // Graph API expects form-encoded bodies (not JSON) for write calls.
  let body: string | undefined
  let headers: Record<string, string> | undefined
  if (init.body) {
    const form = new URLSearchParams()
    for (const [k, v] of Object.entries(init.body)) {
      if (v !== undefined && v !== null) form.set(k, typeof v === 'string' ? v : JSON.stringify(v))
    }
    body = form.toString()
    headers = { 'content-type': 'application/x-www-form-urlencoded' }
  }

  const res = await fetch(url.toString(), {
    method: init.method || 'GET',
    headers,
    body,
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const code = (json as any)?.error?.code
    const retryable = res.status >= 500 || [4, 17, 613, 80004].includes(code)
    if (retryable && attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
      return graphFetch<T>(path, init, attempt + 1)
    }
    throw new MetaApiError(res.status, json, (json as any)?.error?.message || `Graph API ${res.status}`)
  }
  return json as T
}
