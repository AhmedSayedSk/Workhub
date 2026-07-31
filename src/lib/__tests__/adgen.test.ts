import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { inspect } from 'node:util'
import { adgen, AdGenError } from '../adgen.ts'

// The AdGen client talks to a service we own over HTTP. Every test here mocks
// `fetch` — the suite must never touch the network.

const BASE = 'https://adgen.example.test'
// A fake credential. It exists only in this file, is never a real key, and the
// leak tests below assert it can never escape through an error.
const FAKE_KEY = 'k_test_S3CRET_do_not_leak_0123456789'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

let calls: Call[] = []
let realFetch: typeof globalThis.fetch

/** Install a fetch mock that replies with `status` + `payload` for every call. */
function mockFetch(status: number, payload: unknown, opts: { raw?: string } = {}) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries((init?.headers || {}) as Record<string, string>)) {
      headers[k.toLowerCase()] = v
    }
    calls.push({
      url: String(input),
      method: init?.method || 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    const text = opts.raw !== undefined ? opts.raw : JSON.stringify(payload)
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as unknown as Response
  }) as typeof globalThis.fetch
}

/** Install a fetch mock that rejects, simulating a network failure. */
function mockFetchReject(err: Error) {
  globalThis.fetch = (async () => {
    throw err
  }) as typeof globalThis.fetch
}

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
  process.env.ADGEN_API_BASE = BASE
  process.env.ADGEN_API_KEY = FAKE_KEY
})

afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.ADGEN_API_BASE
  delete process.env.ADGEN_API_KEY
})

const BRIEF = {
  brand: { name: 'Acme', colors: ['#112233'], logoUrl: 'https://cdn.example.test/logo.png' },
  goal: 'grow signups',
  audience: 'small teams',
  tone: 'confident',
  language: 'en' as const,
  market: 'global',
  style: 'realistic',
  aspect: 'portrait' as const,
  postCount: 4,
  content: { link: 'https://acme.example.test', includeHowTo: true },
  consistentIdentity: true,
  imageInstructions: 'no text on the image',
}

describe('adgen client — transport', () => {
  test('createCampaign POSTs the brief to ADGEN_API_BASE with the X-API-Key header', async () => {
    mockFetch(200, { id: 'camp_1', posts: [{ caption: 'c', hashtags: ['a'], imagePrompt: 'p' }] })

    const out = await adgen.createCampaign(BRIEF)

    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, `${BASE}/v1/campaigns`)
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].headers['x-api-key'], FAKE_KEY)
    assert.equal(calls[0].headers['content-type'], 'application/json')
    assert.deepEqual(calls[0].body, BRIEF)
    assert.equal(out.id, 'camp_1')
    assert.equal(out.posts.length, 1)
  })

  test('a trailing slash on the base URL does not produce a double slash', async () => {
    process.env.ADGEN_API_BASE = `${BASE}/`
    mockFetch(200, { id: 'camp_1', posts: [] })

    await adgen.createCampaign(BRIEF)

    assert.equal(calls[0].url, `${BASE}/v1/campaigns`)
  })

  test('hooks POSTs to the campaign hooks path and returns the options', async () => {
    mockFetch(200, { options: [{ style: 'question', lang: 'ar', headline: 'مرحبا' }] })

    const out = await adgen.hooks('camp_1', { market: 'eg', force: true })

    assert.equal(calls[0].url, `${BASE}/v1/campaigns/camp_1/hooks`)
    assert.equal(calls[0].method, 'POST')
    assert.deepEqual(calls[0].body, { market: 'eg', force: true })
    assert.equal(out.options[0].headline, 'مرحبا')
  })

  test('hooks url-encodes the campaign id', async () => {
    mockFetch(200, { options: [] })

    await adgen.hooks('a/b c', {})

    assert.equal(calls[0].url, `${BASE}/v1/campaigns/a%2Fb%20c/hooks`)
  })

  test('renderVideo POSTs the options and returns the job id', async () => {
    mockFetch(200, { jobId: 'job_9' })

    const out = await adgen.renderVideo('camp_1', { aspect: 'portrait', mode: 'creative' })

    assert.equal(calls[0].url, `${BASE}/v1/campaigns/camp_1/video`)
    assert.equal(calls[0].method, 'POST')
    assert.deepEqual(calls[0].body, { aspect: 'portrait', mode: 'creative' })
    assert.equal(out.jobId, 'job_9')
  })

  test('getJob GETs the job and returns its progress fields', async () => {
    mockFetch(200, { status: 'rendering', progress: 42, stage: 'encoding' })

    const out = await adgen.getJob('job_9')

    assert.equal(calls[0].url, `${BASE}/v1/jobs/job_9`)
    assert.equal(calls[0].method, 'GET')
    assert.equal(calls[0].body, undefined)
    assert.equal(out.status, 'rendering')
    assert.equal(out.progress, 42)
    assert.equal(out.stage, 'encoding')
  })

  test('cancelJob DELETEs the job', async () => {
    mockFetch(200, { cancelled: true })

    const out = await adgen.cancelJob('job_9')

    assert.equal(calls[0].url, `${BASE}/v1/jobs/job_9`)
    assert.equal(calls[0].method, 'DELETE')
    assert.equal(out.cancelled, true)
  })
})

describe('adgen client — errors', () => {
  test('a non-2xx flat {error} body becomes an AdGenError carrying status + message', async () => {
    mockFetch(422, { error: 'Post count must be 8 or fewer' })

    const err = await adgen.createCampaign(BRIEF).then(
      () => null,
      (e: unknown) => e as AdGenError
    )

    assert.ok(err instanceof AdGenError)
    assert.equal(err.status, 422)
    assert.equal(err.message, 'Post count must be 8 or fewer')
    assert.equal(err.name, 'AdGenError')
  })

  test('a non-2xx body that is not JSON still yields an AdGenError with the status', async () => {
    mockFetch(502, null, { raw: '<html>bad gateway</html>' })

    const err = await adgen.getJob('job_9').then(
      () => null,
      (e: unknown) => e as AdGenError
    )

    assert.ok(err instanceof AdGenError)
    assert.equal(err.status, 502)
    assert.match(err.message, /502/)
  })

  test('a network failure becomes an AdGenError, not a raw TypeError', async () => {
    mockFetchReject(new TypeError('fetch failed'))

    const err = await adgen.getJob('job_9').then(
      () => null,
      (e: unknown) => e as AdGenError
    )

    assert.ok(err instanceof AdGenError)
    assert.equal(err.status, 503)
  })

  test('a timeout becomes an AdGenError with a timeout message', async () => {
    const abort = new Error('The operation was aborted due to timeout')
    abort.name = 'TimeoutError'
    mockFetchReject(abort)

    const err = await adgen.getJob('job_9').then(
      () => null,
      (e: unknown) => e as AdGenError
    )

    assert.ok(err instanceof AdGenError)
    assert.equal(err.status, 504)
    assert.match(err.message, /timed out/i)
  })
})

describe('adgen client — response guards', () => {
  // `id` and `jobId` are written straight to Firestore, and firebase-admin's
  // update() throws SYNCHRONOUSLY on an undefined value — escaping the caller's
  // trailing .catch() and stranding the campaign mid-status. The client must
  // reject a malformed response instead of passing undefined along.
  const badIds: Array<[string, unknown]> = [
    ['the id is missing', { posts: [] }],
    ['the id is empty', { id: '', posts: [] }],
    ['the id is null', { id: null, posts: [] }],
    ['the id is not a string', { id: 12345, posts: [] }],
    ['the body is not an object', 'ok'],
    ['the body is empty', null],
  ]

  for (const [label, payload] of badIds) {
    test(`createCampaign rejects when ${label}`, async () => {
      mockFetch(200, payload)

      const err = await adgen.createCampaign(BRIEF).then(
        () => null,
        (e: unknown) => e as AdGenError
      )

      assert.ok(err instanceof AdGenError, `expected an AdGenError for: ${label}`)
      assert.equal(err.status, 502)
      assert.match(err.message, /without an id/)
    })
  }

  test('createCampaign accepts a valid id and returns it', async () => {
    mockFetch(200, { id: 'camp_1', posts: [] })
    assert.equal((await adgen.createCampaign(BRIEF)).id, 'camp_1')
  })

  test('createCampaign always returns an array of posts', async () => {
    // The plan route iterates posts; a non-array would throw inside after().
    for (const posts of [undefined, null, 'nope', 42, { 0: 'x' }]) {
      mockFetch(200, { id: 'camp_1', posts })
      const out = await adgen.createCampaign(BRIEF)
      assert.ok(Array.isArray(out.posts), `posts must be an array, got ${JSON.stringify(posts)}`)
      assert.equal(out.posts.length, 0)
    }
  })

  test('createCampaign leaves a well-formed posts array untouched', async () => {
    mockFetch(200, { id: 'camp_1', posts: [{ caption: 'c', hashtags: [], imagePrompt: 'p' }] })
    const out = await adgen.createCampaign(BRIEF)
    assert.equal(out.posts.length, 1)
    assert.equal(out.posts[0].caption, 'c')
  })

  for (const [label, payload] of [
    ['the jobId is missing', {}],
    ['the jobId is empty', { jobId: '' }],
    ['the jobId is not a string', { jobId: { id: 'x' } }],
  ] as Array<[string, unknown]>) {
    test(`renderVideo rejects when ${label}`, async () => {
      mockFetch(200, payload)

      const err = await adgen.renderVideo('camp_1').then(
        () => null,
        (e: unknown) => e as AdGenError
      )

      assert.ok(err instanceof AdGenError, `expected an AdGenError for: ${label}`)
      assert.equal(err.status, 502)
      assert.match(err.message, /without an id/)
    })
  }

  test('renderVideo accepts a valid jobId', async () => {
    mockFetch(200, { jobId: 'job_9' })
    assert.equal((await adgen.renderVideo('camp_1')).jobId, 'job_9')
  })
})

describe('adgen client — configuration', () => {
  test('a missing ADGEN_API_BASE throws at call time and never reaches fetch', async () => {
    delete process.env.ADGEN_API_BASE
    mockFetch(200, { id: 'camp_1', posts: [] })

    const err = await adgen.createCampaign(BRIEF).then(
      () => null,
      (e: unknown) => e as AdGenError
    )

    assert.ok(err instanceof AdGenError)
    assert.match(err.message, /ADGEN_API_BASE/)
    assert.equal(calls.length, 0, 'must not call out with an unconfigured base URL')
  })

  test('a missing ADGEN_API_KEY throws at call time and never reaches fetch', async () => {
    delete process.env.ADGEN_API_KEY
    mockFetch(200, { id: 'camp_1', posts: [] })

    const err = await adgen.hooks('camp_1', {}).then(
      () => null,
      (e: unknown) => e as AdGenError
    )

    assert.ok(err instanceof AdGenError)
    assert.match(err.message, /ADGEN_API_KEY/)
    assert.equal(calls.length, 0, 'must not send an empty key and get a confusing 401')
  })

  test('an empty-string ADGEN_API_KEY is treated as missing', async () => {
    process.env.ADGEN_API_KEY = '   '
    mockFetch(200, { id: 'camp_1', posts: [] })

    await assert.rejects(() => adgen.createCampaign(BRIEF), AdGenError)
    assert.equal(calls.length, 0)
  })
})

describe('adgen client — the API key must never leak', () => {
  // Every surface an error can be observed through, for every failure mode.
  const surfaces = (e: unknown): string[] => {
    const err = e as Error
    return [
      err.message,
      err.stack || '',
      String(err),
      inspect(err, { depth: 6 }),
      JSON.stringify(err) || '',
      JSON.stringify(Object.getOwnPropertyDescriptors(err)) || '',
    ]
  }

  const failureModes: Array<[string, () => void]> = [
    ['non-2xx with a flat error body', () => mockFetch(401, { error: 'Invalid API key' })],
    ['non-2xx with a non-JSON body', () => mockFetch(500, null, { raw: 'boom' })],
    ['non-2xx echoing the key back', () => mockFetch(403, { error: `Key ${FAKE_KEY} is revoked` })],
    ['network failure', () => mockFetchReject(new TypeError('fetch failed'))],
    ['fetch throwing an error that embeds the request', () => mockFetchReject(new TypeError(`fetch failed for X-API-Key: ${FAKE_KEY}`))],
  ]

  for (const [label, install] of failureModes) {
    test(`the key is absent from every error surface — ${label}`, async () => {
      install()

      const err = await adgen.createCampaign(BRIEF).then(
        () => null,
        (e: unknown) => e
      )

      assert.ok(err, 'expected a rejection')
      for (const s of surfaces(err)) {
        assert.equal(s.includes(FAKE_KEY), false, `API key leaked into: ${s.slice(0, 200)}`)
      }
    })
  }

  test('the client never enumerates the request init (which carries the key) onto the error', async () => {
    mockFetch(429, { error: 'Rate limit exceeded' })

    const err = await adgen.createCampaign(BRIEF).then(
      () => null,
      (e: unknown) => e as AdGenError
    )

    // Only the documented public fields are enumerable — nothing that could
    // carry headers, an init object, or a config snapshot.
    assert.deepEqual(Object.keys(err as object).sort(), ['status'])
  })
})
