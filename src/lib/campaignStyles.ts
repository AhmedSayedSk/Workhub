// Curated visual styles for campaign images. The `prompt` is appended to every
// image-generation prompt so all posts in a campaign share one consistent look.

export interface CampaignStyleDef {
  key: string
  label: string
  prompt: string
}

export const CAMPAIGN_STYLES: CampaignStyleDef[] = [
  { key: 'realistic', label: 'Realistic', prompt: 'photorealistic, professional commercial photography, natural lighting, crisp high detail, DSLR quality' },
  { key: 'cinematic', label: 'Cinematic', prompt: 'cinematic photography, dramatic moody lighting, shallow depth of field, filmic color grade' },
  { key: '3d', label: '3D Render', prompt: 'polished 3D render, soft studio lighting, smooth materials, subtle reflections, octane-render look' },
  { key: 'cartoon', label: 'Cartoon', prompt: 'playful cartoon illustration, bold clean outlines, vibrant flat colors, friendly characters' },
  { key: 'flat', label: 'Flat Illustration', prompt: 'modern flat vector illustration, clean geometric shapes, minimal shading, corporate-memphis style' },
  { key: 'minimal', label: 'Minimal', prompt: 'minimalist design, generous negative space, simple refined composition, clean and uncluttered' },
  { key: 'gradient', label: 'Gradient / Abstract', prompt: 'vibrant gradient background, smooth abstract shapes, modern tech aesthetic, soft glassmorphism' },
  { key: 'isometric', label: 'Isometric', prompt: 'isometric illustration, clean lines, soft long shadows, tidy product/tech scene' },
  { key: 'watercolor', label: 'Watercolor', prompt: 'soft watercolor painting, organic textures, gentle color bleeds, hand-painted feel' },
  { key: 'layout', label: 'Editorial Layout', prompt: 'editorial poster layout, structured grid composition, bold negative space for text, magazine-style graphic design' },
  { key: 'neon', label: 'Neon / Cyber', prompt: 'neon-lit cyberpunk aesthetic, glowing accents, dark moody background, futuristic vibe' },
  { key: 'collage', label: 'Collage', prompt: 'modern mixed-media collage, layered cut-out shapes, textured paper, eclectic energetic composition' },
]

export const DEFAULT_CAMPAIGN_STYLE = 'realistic'

export function campaignStylePrompt(key?: string): string {
  return CAMPAIGN_STYLES.find((s) => s.key === key)?.prompt || ''
}

// Compose the final image-gen prompt: subject (from the plan) + style + brand colors.
export function buildImagePrompt(basePrompt: string, styleKey?: string, colors?: string[]): string {
  const style = campaignStylePrompt(styleKey)
  const palette = (colors || []).filter(Boolean)
  return [
    basePrompt,
    style ? `Visual style: ${style}.` : '',
    palette.length ? `Feature this brand color palette prominently throughout: ${palette.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}
