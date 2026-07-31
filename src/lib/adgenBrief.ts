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
// Longest product/brand context AdGen accepts.
export const MAX_CONTEXT_CHARS = 4000

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

export interface BriefContext {
  /** Target-market code, resolved by the caller (see lib/markets). */
  market: string
  /** Product/brand description built from the campaign's project. */
  context?: string
}

/**
 * An options object rather than positional arguments: everything beyond the
 * campaign document is data the route has to fetch, and that list grows.
 */
export function campaignToBrief(camp: CampaignDoc, opts: BriefContext): AdGenBrief {
  const content = camp.brief?.content
  // WorkHub stores an include/value pair per emphasis. `edge` is the optional
  // supporting detail for a competitor-edge post, so the request to include one
  // is sent as its own flag — a blank textarea must not silently drop the post.
  const link = content?.includeLink ? (content.link || '').trim() : ''
  const includeEdge = !!content?.includeEdge
  const edge = includeEdge ? (content?.edge || '').trim() : ''
  const logoUrl = camp.brand?.logoUrl || camp.brandImageUrl || ''
  const cta = (camp.brief?.cta || '').trim()
  const context = (opts.context || '').trim().slice(0, MAX_CONTEXT_CHARS)
  const hasContent = !!(link || includeEdge || content?.includeHowTo)

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
    market: opts.market,
    style: camp.style || 'realistic',
    aspect: ASPECTS.includes(camp.aspect as AdGenAspect) ? (camp.aspect as AdGenAspect) : 'portrait',
    postCount: Math.max(1, Math.min(MAX_POSTS, Math.round(camp.brief?.count || 4))),
    ...(context ? { context } : {}),
    ...(cta ? { cta } : {}),
    ...(hasContent
      ? {
          content: {
            ...(link ? { link } : {}),
            ...(content?.includeHowTo ? { includeHowTo: true } : {}),
            ...(includeEdge ? { includeEdge: true } : {}),
            ...(edge ? { edge } : {}),
          },
        }
      : {}),
    ...(camp.consistentIdentity ? { consistentIdentity: true } : {}),
    ...(camp.imageInstructions ? { imageInstructions: camp.imageInstructions } : {}),
  }
}
