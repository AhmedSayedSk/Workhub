'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders its children as the global header's title block (`#header-title-slot`
 * in Header.tsx). Use this when a page needs a DYNAMIC title in the top bar
 * (one that isn't a static entry in PAGE_TITLES) — e.g. the Server dashboard.
 */
export function HeaderTitle({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSlot(document.getElementById('header-title-slot'))
  }, [])

  if (!slot) return null
  return createPortal(children, slot)
}
