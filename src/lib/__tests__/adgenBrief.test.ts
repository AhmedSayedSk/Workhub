import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { campaignToBrief, campaignLanguage, MAX_POSTS, type CampaignDoc } from '../adgenBrief.ts'
import { resolveMarket } from '../markets.ts'

// The route resolves the market from lib/markets and passes the code in.
const MARKET = 'global'

// A fully-populated WorkHub campaign document.
const FULL: CampaignDoc = {
  brand: { name: 'Acme', colors: ['#112233', '#445566'], logoUrl: 'https://cdn.example.test/logo.png' },
  brandImageUrl: 'https://cdn.example.test/brand.png',
  brief: {
    goal: 'grow signups',
    audience: 'small teams',
    tone: 'confident',
    cta: 'Start free',
    count: 6,
    content: { includeLink: true, link: 'https://acme.example.test', includeHowTo: true, includeEdge: true, edge: 'faster setup' },
  },
  language: 'en',
  style: 'cinematic',
  aspect: 'square',
  consistentIdentity: true,
  imageInstructions: 'no text on the image',
}

describe('campaignToBrief — core fields', () => {
  test('carries brand, goal, audience, tone, style, aspect and instructions across', () => {
    const b = campaignToBrief(FULL, MARKET)

    assert.deepEqual(b.brand, {
      name: 'Acme',
      colors: ['#112233', '#445566'],
      logoUrl: 'https://cdn.example.test/logo.png',
    })
    assert.equal(b.goal, 'grow signups')
    assert.equal(b.audience, 'small teams')
    assert.equal(b.tone, 'confident')
    assert.equal(b.style, 'cinematic')
    assert.equal(b.aspect, 'square')
    assert.equal(b.consistentIdentity, true)
    assert.equal(b.imageInstructions, 'no text on the image')
  })

  test('an empty campaign still produces a complete, valid brief', () => {
    const b = campaignToBrief({}, MARKET)

    assert.deepEqual(b.brand, { name: '', colors: [] })
    assert.equal(b.goal, '')
    assert.equal(b.audience, '')
    assert.equal(b.tone, '')
    assert.equal(b.language, 'en')
    assert.equal(b.market, 'global')
    assert.equal(b.style, 'realistic')
    assert.equal(b.aspect, 'portrait')
    assert.equal(b.postCount, 4)
    assert.equal(b.content, undefined)
    assert.equal(b.consistentIdentity, undefined)
    assert.equal(b.imageInstructions, undefined)
  })

  test('brandImageUrl is the logo fallback, and an absent logo is omitted entirely', () => {
    assert.equal(campaignToBrief({ brandImageUrl: 'https://cdn.example.test/brand.png' }, MARKET).brand.logoUrl, 'https://cdn.example.test/brand.png')
    // Firestore stores a cleared logo as null — it must not become `null` in the brief.
    assert.equal('logoUrl' in campaignToBrief({ brand: { name: 'A', logoUrl: null } }, MARKET).brand, false)
  })
})

describe('campaignToBrief — language and market', () => {
  test('the stored language maps onto the two AdGen accepts', () => {
    assert.equal(campaignLanguage({ language: 'en' }), 'en')
    assert.equal(campaignLanguage({ language: 'ar' }), 'ar')
    assert.equal(campaignLanguage({}), 'en')
    // Anything else falls back to English rather than being passed through.
    assert.equal(campaignLanguage({ language: 'fr' }), 'en')
    assert.equal(campaignLanguage({ language: 'AR' }), 'en')
  })

  test('the brief reports the same language it was built from', () => {
    assert.equal(campaignToBrief({ language: 'ar' }, 'eg').language, 'ar')
    assert.equal(campaignToBrief({ language: 'fr' }, MARKET).language, 'en')
  })

  test('the caller-supplied market is passed through verbatim', () => {
    assert.equal(campaignToBrief({ language: 'ar' }, 'sa').market, 'sa')
  })

  test("the route's market fallback picks a market matching the campaign language", () => {
    // This is the exact expression the plan route evaluates.
    assert.equal(resolveMarket(undefined, campaignLanguage({ language: 'en' })).code, 'global')
    assert.equal(resolveMarket(undefined, campaignLanguage({ language: 'ar' })).code, 'eg')
    // An Arabic campaign must never default to an English-speaking market.
    assert.equal(resolveMarket(undefined, campaignLanguage({ language: 'ar' })).lang, 'ar')
  })
})

describe('campaignToBrief — postCount', () => {
  test('clamps to the AdGen maximum', () => {
    // WorkHub's own planner allowed up to 20; AdGen caps at 8.
    assert.equal(campaignToBrief({ brief: { count: 20 } }, MARKET).postCount, MAX_POSTS)
  })

  test('never sends zero or a negative count', () => {
    assert.equal(campaignToBrief({ brief: { count: 0 } }, MARKET).postCount, 4) // 0 is falsy -> default
    assert.equal(campaignToBrief({ brief: { count: -3 } }, MARKET).postCount, 1)
  })

  test('rounds a fractional count', () => {
    assert.equal(campaignToBrief({ brief: { count: 3.6 } }, MARKET).postCount, 4)
  })
})

describe('campaignToBrief — aspect', () => {
  for (const aspect of ['portrait', 'landscape', 'square']) {
    test(`passes the supported aspect "${aspect}" through`, () => {
      assert.equal(campaignToBrief({ aspect }, MARKET).aspect, aspect)
    })
  }

  test('an unsupported aspect falls back to portrait', () => {
    assert.equal(campaignToBrief({ aspect: 'banner' }, MARKET).aspect, 'portrait')
  })
})

describe('campaignToBrief — content emphasis', () => {
  test('sends link and edge only when the user opted into them', () => {
    const b = campaignToBrief(FULL, MARKET)
    assert.deepEqual(b.content, {
      link: 'https://acme.example.test',
      includeHowTo: true,
      edge: 'faster setup',
    })
  })

  test('a stored link the user turned off is not sent', () => {
    const b = campaignToBrief(
      { brief: { content: { includeLink: false, link: 'https://acme.example.test', includeHowTo: false, includeEdge: false } } },
      MARKET
    )
    assert.equal(b.content, undefined)
  })

  test('an opted-in but blank link is dropped rather than sent empty', () => {
    const b = campaignToBrief({ brief: { content: { includeLink: true, link: '   ', includeHowTo: false, includeEdge: false } } }, MARKET)
    assert.equal(b.content, undefined)
  })

  test('how-to alone still produces a content block', () => {
    const b = campaignToBrief({ brief: { content: { includeLink: false, includeHowTo: true, includeEdge: false } } }, MARKET)
    assert.deepEqual(b.content, { includeHowTo: true })
  })
})

describe('campaignToBrief — the brief is safe to send as JSON', () => {
  test('no key is ever undefined or null (Firestore/JSON round-trips cleanly)', () => {
    for (const doc of [FULL, {}, { language: 'ar', aspect: 'banner' } as CampaignDoc]) {
      const b = campaignToBrief(doc, MARKET) as unknown as Record<string, unknown>
      for (const [k, v] of Object.entries(b)) {
        assert.notEqual(v, null, `${k} must not be null`)
        assert.notEqual(v, undefined, `${k} must not be undefined`)
      }
      // Serialising must not drop a required field.
      const round = JSON.parse(JSON.stringify(b))
      for (const required of ['brand', 'goal', 'audience', 'tone', 'language', 'market', 'style', 'aspect', 'postCount']) {
        assert.ok(required in round, `${required} must survive serialisation`)
      }
    }
  })
})
