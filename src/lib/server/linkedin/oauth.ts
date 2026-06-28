import 'server-only'
import { LI_OAUTH, LI_API, liEnv, LinkedInError } from './client'

// Personal-profile posting scopes. (Company-Page posting will use
// `r_organization_admin w_organization_social` once that app is approved.)
export const SCOPES_MEMBER = 'openid profile email w_member_social'

export function authorizeUrl(state: string, scope: string = SCOPES_MEMBER): string {
  const { clientId, redirectUri } = liEnv()
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope,
  })
  return `${LI_OAUTH}/authorization?${p.toString()}`
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; expiresInSec: number }> {
  const { clientId, clientSecret, redirectUri } = liEnv()
  const res = await fetch(`${LI_OAUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new LinkedInError(res.status, data.error_description || data.error || 'Token exchange failed')
  }
  return { accessToken: data.access_token, expiresInSec: data.expires_in || 0 }
}

// OpenID Connect userinfo → member id (sub) for the author URN + display name.
export async function getMember(token: string): Promise<{ sub: string; name: string }> {
  const res = await fetch(`${LI_API}/v2/userinfo`, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new LinkedInError(res.status, data.message || 'Failed to read LinkedIn profile')
  return { sub: String(data.sub || ''), name: data.name || data.given_name || 'LinkedIn' }
}
