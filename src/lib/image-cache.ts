const CACHE_NAME = 'workhub-image-cache'
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
const TIMESTAMP_HEADER = 'x-cached-at'

function isCacheApiAvailable(): boolean {
  return typeof caches !== 'undefined'
}

export async function getCachedImageBlobUrl(url: string): Promise<string | null> {
  if (!isCacheApiAvailable()) return null

  try {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(url)
    if (!response) return null

    // Check expiry
    const cachedAt = response.headers.get(TIMESTAMP_HEADER)
    if (cachedAt) {
      const age = Date.now() - parseInt(cachedAt, 10)
      if (age > CACHE_EXPIRY_MS) {
        await cache.delete(url)
        return null
      }
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export async function cacheImage(url: string): Promise<void> {
  if (!isCacheApiAvailable()) return

  try {
    const cache = await caches.open(CACHE_NAME)

    // Don't re-cache if already present and not expired
    const existing = await cache.match(url)
    if (existing) {
      const cachedAt = existing.headers.get(TIMESTAMP_HEADER)
      if (cachedAt) {
        const age = Date.now() - parseInt(cachedAt, 10)
        if (age <= CACHE_EXPIRY_MS) return
      }
    }

    // Fetch through API proxy to bypass CORS restrictions on Firebase Storage
    const fetchUrl = url.includes('firebasestorage.googleapis.com')
      ? `/api/image-proxy?url=${encodeURIComponent(url)}`
      : url
    const response = await fetch(fetchUrl)
    if (!response.ok) return

    const blob = await response.blob()
    const headers = new Headers({
      'Content-Type': blob.type,
      [TIMESTAMP_HEADER]: Date.now().toString(),
    })
    const cachedResponse = new Response(blob, { headers })
    await cache.put(url, cachedResponse)
  } catch (err) {
    console.warn('[image-cache] Failed to cache image:', err)
  }
}

export async function clearImageCache(): Promise<void> {
  if (!isCacheApiAvailable()) return
  await caches.delete(CACHE_NAME)
}

export async function getImageCacheInfo(): Promise<{ count: number }> {
  if (!isCacheApiAvailable()) return { count: 0 }

  try {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    return { count: keys.length }
  } catch {
    return { count: 0 }
  }
}
