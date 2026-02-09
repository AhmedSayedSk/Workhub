'use client'

import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react'
import { getCachedImageBlobUrl, cacheImage } from '@/lib/image-cache'

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
}

export function CachedImage({ src, ...props }: CachedImageProps) {
  // Start with null to prevent the browser from fetching the original URL
  // before the cache check completes
  const [displaySrc, setDisplaySrc] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Revoke previous blob URL when src changes
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    async function load() {
      const blobUrl = await getCachedImageBlobUrl(src)

      if (cancelled) {
        if (blobUrl) URL.revokeObjectURL(blobUrl)
        return
      }

      if (blobUrl) {
        blobUrlRef.current = blobUrl
        setDisplaySrc(blobUrl)
      } else {
        // Cache miss — show original URL and cache in background
        setDisplaySrc(src)
        cacheImage(src)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [src])

  // Revoke blob URL only when the component fully unmounts,
  // NOT on every effect re-run (which would invalidate the displayed image)
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  // Don't set src attribute until cache check completes — prevents premature network fetch
  return <img {...props} src={displaySrc ?? undefined} />
}
