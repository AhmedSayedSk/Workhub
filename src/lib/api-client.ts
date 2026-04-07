import { auth } from './firebase'

/**
 * Fetch wrapper that automatically attaches Firebase Auth token.
 * Use this for all /api/* calls that require authentication.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser
  const headers = new Headers(options.headers)

  if (user) {
    const token = await user.getIdToken()
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(url, { ...options, headers })
}
