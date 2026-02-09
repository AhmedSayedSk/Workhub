import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Only allow Firebase Storage URLs
  if (!url.startsWith('https://firebasestorage.googleapis.com/')) {
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
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
