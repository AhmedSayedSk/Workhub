// Maps WorkHub's stored campaign document onto the brief AdGen accepts.
// Kept out of the route so it can be unit-tested without Firebase Admin.
//
// This module is deliberately dependency-free: the only import is type-only
// (erased at compile time), and the target market is passed in rather than
// resolved here, so the mapping is a pure function the test runner can load
// directly. The explicit `.ts` extension is what lets `node --test` resolve it.
import type { AdGenAspect, AdGenBrief, AdGenLanguage } from './adgen.ts'

// AdGen plans at most 8 posts per campaign.
export const MAX_POSTS = 8

const ASPECTS: AdGenAspect[] = ['portrait', 'landscape', 'square']

/** The subset of a WorkHub campaign document that planning reads. */
export interface CampaignDoc {
  brand?: { name?: string; colors?: string[]; logoUrl?: string | null }
  brandImageUrl?: string
  brief?: {
    goal?: string
    audience?: string
    tone?: string
    cta?: string
    count?: number
    content?: {
      includeLink?: boolean
      link?: string
      includeHowTo?: boolean
      includeEdge?: boolean
      edge?: string
    }
  }
  language?: string
  style?: string
  aspect?: string
  consistentIdentity?: boolean
  imageInstructions?: string
}

/** Campaigns store a free-form language; AdGen accepts only 'en' or 'ar'. */
export function campaignLanguage(camp: CampaignDoc): AdGenLanguage {
  return camp.language === 'ar' ? 'ar' : 'en'
}

/**
 * @param market Target-market code, resolved by the caller (see lib/markets).
 */
export function campaignToBrief(camp: CampaignDoc, market: string): AdGenBrief {
  const content = camp.brief?.content
  // WorkHub stores an include/value pair per emphasis; AdGen infers "include
  // this" from the value being present, so only send what the user opted into.
  const link = content?.includeLink ? (content.link || '').trim() : ''
  const edge = content?.includeEdge ? (content.edge || '').trim() : ''
  const logoUrl = camp.brand?.logoUrl || camp.brandImageUrl || ''
  const hasContent = !!(link || edge || content?.includeHowTo)

  return {
    brand: {
      name: camp.brand?.name || '',
      colors: camp.brand?.colors || [],
      ...(logoUrl ? { logoUrl } : {}),
    },
    goal: camp.brief?.goal || '',
    audience: camp.brief?.audience || '',
    tone: camp.brief?.tone || '',
    language: campaignLanguage(camp),
    market,
    style: camp.style || 'realistic',
    aspect: ASPECTS.includes(camp.aspect as AdGenAspect) ? (camp.aspect as AdGenAspect) : 'portrait',
    postCount: Math.max(1, Math.min(MAX_POSTS, Math.round(camp.brief?.count || 4))),
    ...(hasContent
      ? {
          content: {
            ...(link ? { link } : {}),
            ...(content?.includeHowTo ? { includeHowTo: true } : {}),
            ...(edge ? { edge } : {}),
          },
        }
      : {}),
    ...(camp.consistentIdentity ? { consistentIdentity: true } : {}),
    ...(camp.imageInstructions ? { imageInstructions: camp.imageInstructions } : {}),
  }
}
