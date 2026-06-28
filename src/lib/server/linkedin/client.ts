import 'server-only'

// LinkedIn REST API base + versioned API (LinkedIn-Version header is YYYYMM).
// Versions are only active ~12 months; override via env when LinkedIn rotates them.
export const LI_API = 'https://api.linkedin.com'
export const LI_OAUTH = 'https://www.linkedin.com/oauth/v2'
export const LI_VERSION = process.env.LINKEDIN_VERSION || '202606'

export class LinkedInError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'LinkedInError'
  }
}

export function liEnv() {
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    redirectUri:
      process.env.LINKEDIN_REDIRECT_URI || 'https://workhub.sikasio.com/api/social/linkedin/oauth/callback',
  }
}

// Authenticated call to the versioned REST API.
export function liFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${LI_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'LinkedIn-Version': LI_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
}
