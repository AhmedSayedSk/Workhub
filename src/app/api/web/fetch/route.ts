import { NextRequest, NextResponse } from 'next/server'

// Simple HTML to text converter
function htmlToText(html: string): string {
  // Remove script and style tags and their content
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()

  // Limit length to avoid huge responses
  if (text.length > 10000) {
    text = text.substring(0, 10000) + '...'
  }

  return text
}

// Extract metadata from HTML
function extractMetadata(html: string): { title: string; description: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)

  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    description: descMatch ? descMatch[1].trim() : '',
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL
    let validUrl: URL
    try {
      validUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      )
    }

    // Fetch the URL with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(validUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WorkHubBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''

    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return NextResponse.json({
        success: true,
        data: {
          url: validUrl.toString(),
          title: '',
          description: '',
          content: `[Non-HTML content: ${contentType}]`,
        },
      })
    }

    const html = await response.text()
    const metadata = extractMetadata(html)
    const textContent = htmlToText(html)

    return NextResponse.json({
      success: true,
      data: {
        url: validUrl.toString(),
        title: metadata.title,
        description: metadata.description,
        content: textContent,
      },
    })
  } catch (error) {
    console.error('URL fetch error:', error)
    const message = error instanceof Error ? error.message : 'Fetch failed'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
