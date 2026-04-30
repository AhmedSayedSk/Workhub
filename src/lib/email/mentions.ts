import type { Member } from '@/types'

// Match `@<token>` where token is letters/digits/hyphen, supporting English + Arabic ranges.
// Lookbehind requires start-of-text or whitespace, so we don't match inside email addresses.
const MENTION_RE = /(?:^|[\s,;.!?])@([\p{L}\p{N}_-]{1,48})/gu

function kebab(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extracts unique mention tokens from a comment body.
 * Matches `@FirstName` or `@kebab-name` styles per question answers (B + C).
 */
export function extractMentions(text: string): string[] {
  if (!text) return []
  const tokens = new Set<string>()
  for (const match of text.matchAll(MENTION_RE)) {
    if (match[1]) tokens.add(match[1])
  }
  return [...tokens]
}

/**
 * Resolve mention tokens to Member records. A token matches a member if:
 *   - the lowercased first word of the member's name === token (lowercased), OR
 *   - kebab(member.name) === token (lowercased)
 * Returns deduped list of matched members.
 */
export function resolveMentions(text: string, members: Member[]): Member[] {
  const tokens = extractMentions(text)
  if (tokens.length === 0) return []
  const tokensLower = new Set(tokens.map((t) => t.toLowerCase()))
  const matched = new Map<string, Member>()
  for (const m of members) {
    const firstName = m.name.split(/\s+/)[0]?.toLowerCase() || ''
    const slug = kebab(m.name)
    if (tokensLower.has(firstName) || tokensLower.has(slug)) {
      matched.set(m.id, m)
    }
  }
  return [...matched.values()]
}

/**
 * Strip mention markers and produce a short snippet for the email body.
 */
export function commentSnippet(text: string, max = 240): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`
}
