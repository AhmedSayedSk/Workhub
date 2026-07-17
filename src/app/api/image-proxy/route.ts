import { NextRequest, NextResponse } from 'next/server'

// No auth required — only proxies whitelisted Firebase Storage URLs
// Browser <img> tags can't send Authorization headers
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Only allow Firebase Storage URLs (incl. our GCS-hosted bucket — used for
  // direct video downloads, where cross-origin `download` attrs are ignored).
  const allowed =
    url.startsWith('https://firebasestorage.googleapis.com/') ||
    url.startsWith('https://storage.googleapis.com/workhub-c288f.firebasestorage.app/')
  if (!allowed) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 403 })
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return new NextResponse(null, { status: response.status })
    }

    const blob = await response.blob()
    return new NextResponse(blob, {
      headers: {
        'Content-Type': blob.type,
        'Cache-Control': 'public, max-age=604800',
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
