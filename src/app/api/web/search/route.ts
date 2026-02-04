import { NextRequest, NextResponse } from 'next/server'

// DuckDuckGo search - completely free, no API key, no limits
async function searchDuckDuckGo(query: string, num: number = 5): Promise<{
  results: { title: string; link: string; snippet: string }[]
  instant?: { title: string; text: string; url?: string }
}> {
  const results: { title: string; link: string; snippet: string }[] = []
  let instant: { title: string; text: string; url?: string } | undefined

  try {
    // Use DuckDuckGo's HTML lite version for search results
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed: ${response.status}`)
    }

    const html = await response.text()

    // Parse search results from HTML
    // DuckDuckGo lite format: <a class="result__a" href="...">title</a>
    // and <a class="result__snippet">snippet</a>

    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/gi

    let match
    let count = 0
    while ((match = resultRegex.exec(html)) !== null && count < num) {
      let link = match[1]
      const title = match[2].trim()
      const snippet = match[3].trim()

      // DuckDuckGo uses redirect URLs, extract the actual URL
      if (link.includes('uddg=')) {
        const urlMatch = link.match(/uddg=([^&]+)/)
        if (urlMatch) {
          link = decodeURIComponent(urlMatch[1])
        }
      }

      if (title && link && !link.includes('duckduckgo.com')) {
        results.push({ title, link, snippet })
        count++
      }
    }

    // If the regex didn't work well, try alternative parsing
    if (results.length === 0) {
      // Try to find result links with a simpler pattern
      const linkRegex = /<a[^>]*class="result__url"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<a[^>]*class="result__a"[^>]*>([^<]*)<\/a>/gi

      while ((match = linkRegex.exec(html)) !== null && results.length < num) {
        let link = match[1]
        const title = match[2].trim()

        if (link.includes('uddg=')) {
          const urlMatch = link.match(/uddg=([^&]+)/)
          if (urlMatch) {
            link = decodeURIComponent(urlMatch[1])
          }
        }

        if (title && link) {
          results.push({ title, link, snippet: '' })
        }
      }
    }

    // Also try to get instant answer from DuckDuckGo API
    try {
      const instantUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      const instantResponse = await fetch(instantUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })

      if (instantResponse.ok) {
        const instantData = await instantResponse.json()

        if (instantData.AbstractText) {
          instant = {
            title: instantData.Heading || query,
            text: instantData.AbstractText,
            url: instantData.AbstractURL,
          }
        } else if (instantData.Answer) {
          instant = {
            title: 'Direct Answer',
            text: instantData.Answer,
          }
        } else if (instantData.Definition) {
          instant = {
            title: instantData.Heading || 'Definition',
            text: instantData.Definition,
            url: instantData.DefinitionURL,
          }
        }
      }
    } catch {
      // Instant answer is optional, continue without it
    }

  } catch (error) {
    console.error('DuckDuckGo search error:', error)
  }

  return { results, instant }
}

export async function POST(request: NextRequest) {
  try {
    const { query, num = 5 } = await request.json()

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }

    const { results, instant } = await searchDuckDuckGo(query, num)

    return NextResponse.json({
      success: true,
      data: {
        organic: results.map((item, index) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          position: index + 1,
        })),
        instant: instant || null,
      },
    })
  } catch (error) {
    console.error('Web search error:', error)
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    )
  }
}
