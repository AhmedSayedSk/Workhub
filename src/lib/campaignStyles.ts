// Curated visual styles for campaign images. The `prompt` is appended to every
// image-generation prompt so all posts in a campaign share one consistent look.

export interface CampaignStyleDef {
  key: string
  label: string
  prompt: string
  swatch: string // CSS background that previews the style's look
  example?: string // optional real example image
}

export const CAMPAIGN_STYLES: CampaignStyleDef[] = [
  { key: 'realistic', label: 'Realistic', prompt: 'photorealistic, professional commercial photography, natural lighting, crisp high detail, DSLR quality', swatch: 'linear-gradient(135deg,#9aa7b6,#54637a)', example: '/campaign-styles/realistic.jpg' },
  { key: 'cinematic', label: 'Cinematic', prompt: 'cinematic photography, dramatic moody lighting, shallow depth of field, filmic color grade', swatch: 'linear-gradient(135deg,#0b3d4d,#1f6f7e 45%,#e08a3c)', example: '/campaign-styles/cinematic.jpg' },
  { key: '3d', label: '3D Render', prompt: 'polished 3D render, soft studio lighting, smooth materials, subtle reflections, octane-render look', swatch: 'linear-gradient(135deg,#c4b5fd,#818cf8 60%,#6366f1)', example: '/campaign-styles/3d.jpg' },
  { key: 'cartoon', label: 'Cartoon', prompt: 'playful cartoon illustration, bold clean outlines, vibrant flat colors, friendly characters', swatch: 'linear-gradient(135deg,#ffd23f,#ff8a3c 55%,#ff5d5d)', example: '/campaign-styles/cartoon.jpg' },
  { key: 'flat', label: 'Flat Illustration', prompt: 'modern flat vector illustration, clean geometric shapes, minimal shading, corporate-memphis style', swatch: 'linear-gradient(135deg,#7bd0c1,#4a7bd6)', example: '/campaign-styles/flat.jpg' },
  { key: 'minimal', label: 'Minimal', prompt: 'minimalist design, generous negative space, simple refined composition, clean and uncluttered', swatch: 'linear-gradient(135deg,#f3f4f6,#cdd3db)', example: '/campaign-styles/minimal.jpg' },
  { key: 'gradient', label: 'Gradient / Abstract', prompt: 'vibrant gradient background, smooth abstract shapes, modern tech aesthetic, soft glassmorphism', swatch: 'linear-gradient(135deg,#ff6ec4,#7873f5 50%,#42e695)', example: '/campaign-styles/gradient.jpg' },
  { key: 'isometric', label: 'Isometric', prompt: 'isometric illustration, clean lines, soft long shadows, tidy product/tech scene', swatch: 'linear-gradient(135deg,#8aa0f5,#4458a8)', example: '/campaign-styles/isometric.jpg' },
  { key: 'watercolor', label: 'Watercolor', prompt: 'soft watercolor painting, organic textures, gentle color bleeds, hand-painted feel', swatch: 'linear-gradient(135deg,#f9c5d1,#a0e7e5 55%,#fbe7a1)', example: '/campaign-styles/watercolor.jpg' },
  { key: 'layout', label: 'Editorial Layout', prompt: 'editorial poster layout, structured grid composition, bold negative space for text, magazine-style graphic design', swatch: 'linear-gradient(90deg,#1f2937 0 38%,#e5e7eb 38% 100%)', example: '/campaign-styles/layout.jpg' },
  { key: 'neon', label: 'Neon / Cyber', prompt: 'neon-lit cyberpunk aesthetic, glowing accents, dark moody background, futuristic vibe', swatch: 'linear-gradient(135deg,#0f1020,#ff2bd6 55%,#21f0ff)', example: '/campaign-styles/neon.jpg' },
  { key: 'collage', label: 'Collage', prompt: 'modern mixed-media collage, layered cut-out shapes, textured paper, eclectic energetic composition', swatch: 'conic-gradient(from 35deg,#f6b73c,#c97ba3,#5ba6a0,#c97575,#f6b73c)', example: '/campaign-styles/collage.jpg' },
]

export const DEFAULT_CAMPAIGN_STYLE = 'realistic'

export function campaignStylePrompt(key?: string): string {
  return CAMPAIGN_STYLES.find((s) => s.key === key)?.prompt || ''
}

// Compose the final image-gen prompt: subject (from the plan) + style + brand
// colors + (for Arabic campaigns) a rule that any rendered text must be Arabic.
export function buildImagePrompt(
  basePrompt: string,
  styleKey?: string,
  colors?: string[],
  language?: 'en' | 'ar',
  artDirection?: string,
  instructions?: string,
  textOnImage?: 'none' | 'short' | 'long',
  headline?: string,
  body?: string
): string {
  const style = campaignStylePrompt(styleKey)
  const palette = (colors || []).filter(Boolean)
  // Bake the post text onto the image when requested.
  const overlay = (() => {
    if (!textOnImage || textOnImage === 'none') return ''
    const h = (headline || '').trim()
    const b = (body || '').trim()
    const lines = (textOnImage === 'long' ? [h, b] : [h]).filter(Boolean)
    if (!lines.length) return ''
    return `Render this exact text directly ON the image as a bold, legible, professionally-composed typographic overlay — leave clean negative space for it, ensure strong contrast (add a subtle scrim/shadow if needed), and spell it EXACTLY as written, no extra words: ${lines.map((l) => `"${l}"`).join(' and, smaller below it, ')}.`
  })()
  return [
    basePrompt,
    overlay,
    instructions?.trim() ? `Custom instructions (must be followed in EVERY image): ${instructions.trim()}` : '',
    artDirection
      ? `Cohesive campaign art direction — every post in this campaign MUST share this exact visual identity so they look like one set: ${artDirection}`
      : '',
    style ? `Visual style: ${style}.` : '',
    palette.length ? `Feature this brand color palette prominently throughout: ${palette.join(', ')}.` : '',
    language === 'ar'
      ? 'IMPORTANT: any text that appears in the image MUST be written in correct Arabic (العربية), right-to-left, properly spelled and shaped — never English or Latin letters.'
      : '',
  ]
    .filter(Boolean)
    .join(' ')
}
