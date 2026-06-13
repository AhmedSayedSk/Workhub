'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders its children inside the global header's action slot
 * (`#header-actions-slot` in Header.tsx). Pages use this to surface their
 * primary create/action buttons in the top bar next to the page title.
 */
export function HeaderActions({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSlot(document.getElementById('header-actions-slot'))
  }, [])

  if (!slot) return null
  return createPortal(children, slot)
}
