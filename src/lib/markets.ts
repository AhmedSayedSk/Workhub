// Target-market catalog for campaign videos. Each market carries the cultural
// direction used by every AI step (hooks, script copy, narration delivery) so
// the whole video speaks the market's language — literally and culturally.

export interface Market {
  code: string
  label: string
  labelAr: string
  lang: 'en' | 'ar'
  // Injected into copywriting prompts (hooks + video script).
  cultureNote: string
  // Injected into the narration style prompt (delivery/dialect).
  voiceNote: string
}

export const MARKETS: Market[] = [
  {
    code: 'global', label: 'Global (English)', labelAr: 'عالمي', lang: 'en',
    cultureNote: 'International audience: clear, direct, culturally neutral English. Avoid region-specific idioms.',
    voiceNote: 'Neutral international English delivery.',
  },
  {
    code: 'us', label: 'United States', labelAr: 'الولايات المتحدة', lang: 'en',
    cultureNote: 'US audience: confident, benefit-first, conversational American English. Bold claims land well.',
    voiceNote: 'American English delivery — upbeat, confident, conversational.',
  },
  {
    code: 'uk', label: 'United Kingdom', labelAr: 'المملكة المتحدة', lang: 'en',
    cultureNote: 'UK audience: understated wit, avoid over-hype; British English spelling and phrasing.',
    voiceNote: 'British English delivery — polished, warm, measured.',
  },
  {
    code: 'eg', label: 'Egypt', labelAr: 'مصر', lang: 'ar',
    cultureNote: 'Egyptian audience: warm Egyptian colloquial Arabic (عامية مصرية) is welcome and effective; friendly humor works; respect local values and family-oriented framing.',
    voiceNote: 'Egyptian Arabic delivery (colloquial, warm and friendly — the way Egyptian ads sound).',
  },
  {
    code: 'sa', label: 'Saudi Arabia', labelAr: 'السعودية', lang: 'ar',
    cultureNote: 'Saudi audience: respectful, aspirational Modern Standard Arabic with a Gulf flavor; conservative, family- and tradition-respecting framing; avoid slang and over-familiarity.',
    voiceNote: 'Gulf Arabic delivery — dignified, confident, respectful; MSA-leaning.',
  },
  {
    code: 'ae', label: 'UAE', labelAr: 'الإمارات', lang: 'ar',
    cultureNote: 'UAE audience: cosmopolitan and premium; polished Modern Standard Arabic; luxury and excellence resonate; respectful of local customs.',
    voiceNote: 'Polished Gulf Arabic delivery — premium, cosmopolitan tone.',
  },
  {
    code: 'jo', label: 'Jordan / Levant', labelAr: 'الأردن والشام', lang: 'ar',
    cultureNote: 'Levantine audience: warm Levantine-flavored Arabic; community- and trust-oriented framing; sincere over flashy.',
    voiceNote: 'Levantine Arabic delivery — warm, sincere, trustworthy.',
  },
  {
    code: 'ma', label: 'Morocco / Maghreb', labelAr: 'المغرب', lang: 'ar',
    cultureNote: 'Maghreb audience: clear Modern Standard Arabic (widely understood across dialects); respectful, value-focused framing.',
    voiceNote: 'Clear Modern Standard Arabic delivery, warm and friendly.',
  },
]

export function resolveMarket(code: unknown, campaignLang: 'en' | 'ar'): Market {
  const m = MARKETS.find((x) => x.code === code)
  if (m) return m
  // auto: sensible default per campaign language
  return MARKETS.find((x) => x.code === (campaignLang === 'ar' ? 'eg' : 'global'))!
}
