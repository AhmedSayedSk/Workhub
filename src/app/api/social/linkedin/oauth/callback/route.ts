import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, getMember } from '@/lib/server/linkedin/oauth'
import { saveLinkedInCreds } from '@/lib/server/linkedin/accounts'

// Public OAuth landing — LinkedIn redirects the browser here after consent.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const origin = request.nextUrl.origin
  const code = sp.get('code')
  const state = sp.get('state')
  const err = sp.get('error_description') || sp.get('error')

  let projectId = ''
  try {
    if (state) projectId = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')).projectId || ''
  } catch {
    /* bad state */
  }

  const back = (status: string) =>
    NextResponse.redirect(
      projectId ? `${origin}/projects/${projectId}?stage=market&linkedin=${status}` : `${origin}/content-studio?linkedin=${status}`
    )

  if (err) return back('error')
  if (!code || !projectId) return back('error')

  try {
    const { accessToken, expiresInSec } = await exchangeCode(code)
    const member = await getMember(accessToken)
    if (!member.sub) return back('error')
    await saveLinkedInCreds(projectId, {
      token: accessToken,
      authorUrn: `urn:li:person:${member.sub}`,
      expiresAt: expiresInSec ? Date.now() + expiresInSec * 1000 : 0,
      name: member.name,
    })
    return back('connected')
  } catch {
    return back('error')
  }
}
