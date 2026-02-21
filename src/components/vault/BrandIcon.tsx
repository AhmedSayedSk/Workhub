'use client'

import { useState, ReactNode } from 'react'
import { BrandIconMatch, getBrandIconUrl } from '@/lib/brand-icons'

interface BrandIconProps {
  brand: BrandIconMatch
  fallback: ReactNode
}

export function BrandIcon({ brand, fallback }: BrandIconProps) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return <>{fallback}</>
  }

  // Dark brands (Apple, GitHub, Vercel, etc.): white icon on dark background
  // Light brands: colored icon on tinted background
  const iconUrl = brand.isDark
    ? getBrandIconUrl(brand.slug, '#FFFFFF')
    : getBrandIconUrl(brand.slug, brand.color)

  const bgStyle = brand.isDark
    ? { backgroundColor: brand.color, border: '1px solid rgba(255, 255, 255, 0.2)' }
    : { backgroundColor: `${brand.color}14`, border: `1px solid ${brand.color}80` }

  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
      style={bgStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={iconUrl}
        alt={brand.name}
        className="w-5 h-5"
        onError={() => setHasError(true)}
      />
    </div>
  )
}
