// Color system for campaign videos: an AI-proposed palette is validated and
// contrast-fixed here so every on-screen pairing (text/bg, accent/bg, CTA
// text/accent) meets WCAG ratios — AI taste, deterministic safety.

export interface VideoPalette {
  bg1: string // gradient top (deep, brand-tinted)
  bg2: string // gradient bottom (darker)
  accent: string // bars, kicker, stat value, CTA pill
  text: string // headlines / captions
  muted: string // sub lines / labels
  ctaText: string // text on the accent CTA pill
}

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX6 = /^#[0-9a-f]{6}$/i

export function normalizeHex(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  const m3 = s.match(HEX3)
  if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`.toLowerCase()
  return HEX6.test(s) ? s.toLowerCase() : null
}

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

// WCAG relative luminance
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

export function mix(hex: string, other: string, t: number): string {
  const [r1, g1, b1] = rgb(hex)
  const [r2, g2, b2] = rgb(other)
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

// Nudges `fg` toward white or black until it clears `min` contrast against `bg`.
function fix(fg: string, bg: string, min: number): string {
  let out = fg
  const towards = luminance(bg) < 0.25 ? '#ffffff' : '#000000'
  for (let i = 0; i < 48 && contrast(out, bg) < min; i++) out = mix(out, towards, 0.1)
  return contrast(out, bg) >= min ? out : towards // absolute fallback: pure white/black always clears
}

// Caps a background at "deep cinematic dark" (premium video family).
function deepen(bgHex: string, maxLum: number): string {
  let out = bgHex
  for (let i = 0; i < 40 && luminance(out) > maxLum; i++) out = mix(out, '#000000', 0.15)
  return out
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255)
}

function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 220 // achromatic brand -> cool navy family
  const d = max - min
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return Math.round(((h * 60) + 360) % 360)
}

// Deterministic palette from the brand color — used when the AI proposal is
// missing/invalid, and as the base the AI proposal is merged over.
export function derivePalette(brandColor?: string | null): VideoPalette {
  const brand = normalizeHex(brandColor) || '#34e5a4'
  const h = hue(brand)
  return {
    bg1: hslToHex(h, 0.34, 0.11),
    bg2: hslToHex(h, 0.42, 0.05),
    accent: brand,
    text: '#f5f7fb',
    muted: '#b9c2d0',
    ctaText: '#0b0f18',
  }
}

// Merges an AI proposal over the derived base, then enforces every contrast
// pairing used by the scene templates. Always returns a safe palette.
export function finalizePalette(raw: Partial<Record<keyof VideoPalette, unknown>> | null, brandColor?: string | null): VideoPalette {
  const base = derivePalette(brandColor)
  const p: VideoPalette = {
    bg1: normalizeHex(raw?.bg1) || base.bg1,
    bg2: normalizeHex(raw?.bg2) || base.bg2,
    accent: normalizeHex(raw?.accent) || base.accent,
    text: normalizeHex(raw?.text) || base.text,
    muted: normalizeHex(raw?.muted) || base.muted,
    ctaText: normalizeHex(raw?.ctaText) || base.ctaText,
  }
  // Backgrounds stay in the deep cinematic family (and bg2 darker than bg1).
  p.bg1 = deepen(p.bg1, 0.045)
  p.bg2 = deepen(p.bg2, 0.022)
  if (luminance(p.bg2) > luminance(p.bg1)) [p.bg1, p.bg2] = [p.bg2, p.bg1]
  // Text/muted must read on BOTH gradient stops — fix against each in turn
  // (both bgs are dark so every nudge goes toward white; monotonic, both hold).
  const fixBoth = (fg: string, min: number) => fix(fix(fg, p.bg2, min), p.bg1, min)
  p.text = fixBoth(p.text, 7)
  p.muted = fixBoth(p.muted, 4.5)
  // Accent doubles as kicker/stat TEXT -> readable, not just visible.
  p.accent = fixBoth(p.accent, 4.5)
  // CTA pill text vs the (possibly adjusted) accent: pick the better of the
  // proposal / near-black / white, then fix if still short.
  const candidates = [p.ctaText, '#0b0f18', '#ffffff']
  p.ctaText = candidates.reduce((a, b) => (contrast(a, p.accent) >= contrast(b, p.accent) ? a : b))
  p.ctaText = fix(p.ctaText, p.accent, 4.5)
  return p
}
