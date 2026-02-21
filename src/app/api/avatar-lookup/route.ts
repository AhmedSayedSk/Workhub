import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ avatarUrl: null })
  }

  const trimmed = email.trim().toLowerCase()
  const hash = createHash('md5').update(trimmed).digest('hex')

  // Check Gravatar — d=404 returns 404 if no avatar exists
  const gravatarCheck = `https://www.gravatar.com/avatar/${hash}?d=404&s=200`

  try {
    const res = await fetch(gravatarCheck, { method: 'HEAD' })
    if (res.ok) {
      return NextResponse.json({
        avatarUrl: `https://www.gravatar.com/avatar/${hash}?s=200`,
      })
    }
  } catch {
    // Gravatar check failed, fall through
  }

  return NextResponse.json({ avatarUrl: null })
}
