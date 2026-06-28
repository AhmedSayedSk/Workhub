import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authorizeUrl } from '@/lib/server/linkedin/oauth'

// Returns the LinkedIn authorize URL for the client to redirect to. Called via
// authFetch (so it's authenticated); the callback below is the public OAuth landing.
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  if (!process.env.LINKEDIN_CLIENT_ID) {
    return NextResponse.json({ error: 'LinkedIn is not configured (missing LINKEDIN_CLIENT_ID)' }, { status: 503 })
  }

  const state = Buffer.from(JSON.stringify({ projectId })).toString('base64url')
  return NextResponse.json({ url: authorizeUrl(state) })
}
