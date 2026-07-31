import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  credentialRejection,
  handleImageAction,
  normalizeModel,
  normalizeAspectRatio,
  clampCount,
  IMAGE_MODELS,
  type ImageGenDeps,
} from '../../../../../lib/imageGen.ts'

// The image playground used to hand the browser a real API credential: it was
// stored in Firestore, read by the client, and sent back both in the POST body
// and in the *query string*. Everything below pins the replacement: the key
// lives in the environment, the browser never sends one, and nothing the
// browser can see names a backing vendor or carries an account identity.
//
// No network. Every upstream call goes through an injected fetch double.

// Not a real key — invented here, never a value that exists anywhere else.
const FAKE_KEY = 'igk_test_only_0123456789_not_a_real_key'
const FAKE_BASE = 'https://images.example.test'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

/** Records every upstream request and replays scripted responses. */
function fetchDouble(responses: Array<{ status?: number; json?: unknown; body?: string; throws?: Error }>) {
  const calls: Call[] = []
  let i = 0
  const impl = async (input: unknown, init?: RequestInit) => {
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries((init?.headers as Record<string, string>) || {})) {
      headers[k.toLowerCase()] = v
    }
    calls.push({
      url: String(input),
      method: init?.method || 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    })
    const next = responses[Math.min(i, responses.length - 1)]
    i++
    if (next.throws) throw next.throws
    const status = next.status ?? 200
    const text = next.body ?? JSON.stringify(next.json ?? {})
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() { return JSON.parse(text) },
      async text() { return text },
    } as unknown as Response
  }
  return { calls, impl: impl as unknown as typeof fetch }
}

/** A clock the polling loop can burn through instantly. */
function fakeClock(startMs = 1_780_000_000_000) {
  let t = startMs
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms },
    advance: (ms: number) => { t += ms },
  }
}

function deps(fetchImpl: typeof fetch, extra: Partial<ImageGenDeps> = {}): ImageGenDeps {
  const clock = fakeClock()
  return { fetchImpl, now: clock.now, sleep: clock.sleep, ...extra }
}

const GOOD_JOB = {
  id: 'job_1',
  status: 'done',
  images: [
    { url: 'https://images.example.test/files/a.jpg', seed: 42, id: 'img_a', bytes: 1 },
    { url: 'https://images.example.test/files/b.jpg', seed: 43, id: 'img_b', bytes: 2 },
  ],
}

/** Strings that must never reach a browser. */
const VENDOR_WORDS = [
  'useapi', 'google', 'gemini', 'imagen', 'nano-banana', 'nano banana',
  'capsolver', 'anticaptcha', 'recaptcha', 'labs.google', 'fifeurl',
]

function assertNeutral(value: unknown, what: string) {
  const s = JSON.stringify(value ?? '').toLowerCase()
  for (const word of VENDOR_WORDS) {
    assert.ok(!s.includes(word), `${what} must not name a vendor, found "${word}" in: ${s}`)
  }
  assert.ok(!s.includes(FAKE_KEY.toLowerCase()), `${what} leaked the API key: ${s}`)
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(s), `${what} must not contain an account email: ${s}`)
  assert.ok(!s.includes('usedemail'), `${what} must not carry usedEmail: ${s}`)
}

beforeEach(() => {
  process.env.IMG_GEN_API_BASE = FAKE_BASE
  process.env.IMG_GEN_API_KEY = FAKE_KEY
})

afterEach(() => {
  delete process.env.IMG_GEN_API_BASE
  delete process.env.IMG_GEN_API_KEY
})

// ── The hole this task closes ────────────────────────────────────────────────

describe('credentialRejection — a client-supplied token is refused, never honoured', () => {
  test('rejects apiToken in the POST body', () => {
    const r = credentialRejection({ body: { action: 'generate', apiToken: 'user:whatever' } })
    assert.ok(r, 'a body carrying apiToken must be rejected')
    assert.equal(r.status, 400)
    assert.equal(r.body.success, false)
    assertNeutral(r.body, 'credential rejection body')
  })

  test('rejects an EMPTY apiToken — presence of the field is the signal', () => {
    const r = credentialRejection({ body: { action: 'generate', apiToken: '' } })
    assert.ok(r, 'an empty apiToken is still a client that has not been migrated')
  })

  test('rejects a null apiToken', () => {
    const r = credentialRejection({ body: { action: 'generate', apiToken: null } })
    assert.ok(r)
  })

  test('rejects a bare `token` field in the body too', () => {
    const r = credentialRejection({ body: { action: 'generate', token: 'user:whatever' } })
    assert.ok(r)
  })

  test('rejects ?token= in the query string (the access-log / Referer leak)', () => {
    const r = credentialRejection({ query: new URLSearchParams('action=accounts&token=user%3Asecret') })
    assert.ok(r, 'a token in the URL must be rejected')
    assert.equal(r.status, 400)
    assertNeutral(r.body, 'credential rejection body')
  })

  test('rejects an EMPTY ?token= in the query string', () => {
    const r = credentialRejection({ query: new URLSearchParams('action=accounts&token=') })
    assert.ok(r)
  })

  test('rejects ?apiToken= in the query string', () => {
    const r = credentialRejection({ query: new URLSearchParams('action=accounts&apiToken=x') })
    assert.ok(r)
  })

  test('the rejection message never echoes the supplied credential', () => {
    const r = credentialRejection({ body: { apiToken: 'user:SUPER-SECRET-VALUE' } })
    assert.ok(r)
    assert.ok(!JSON.stringify(r.body).includes('SUPER-SECRET-VALUE'))
  })

  test('a clean request is not rejected', () => {
    assert.equal(credentialRejection({ body: { action: 'generate', prompt: 'a cat' } }), null)
    assert.equal(credentialRejection({ query: new URLSearchParams('action=accounts') }), null)
    assert.equal(credentialRejection({}), null)
    assert.equal(credentialRejection({ body: null, query: null }), null)
  })

  test('a generate carrying a credential is refused and never reaches the service', async () => {
    const { calls, impl } = fetchDouble([
      { status: 202, json: { id: 'job_1', status: 'queued' } },
      { json: GOOD_JOB },
    ])
    const res = await handleImageAction('generate', { prompt: 'a cat', apiToken: 'user:whatever' }, deps(impl))
    assert.equal(res!.status, 400)
    assert.equal(res!.body.success, false)
    assert.equal(calls.length, 0, 'a credential-bearing request must not be served')
    assertNeutral(res!.body, 'refused generate')
  })

  test('upscale and upload_asset carrying a credential are refused too', async () => {
    const { impl } = fetchDouble([{ json: {} }])
    for (const action of ['upscale', 'upload_asset']) {
      const res = await handleImageAction(action, { token: 'user:whatever' }, deps(impl))
      assert.equal(res!.status, 400, `${action} must refuse a credential`)
    }
  })

  test('an identical request without the credential IS served — the guard is not a blanket refusal', async () => {
    const { calls, impl } = fetchDouble([
      { status: 202, json: { id: 'job_1', status: 'queued' } },
      { json: GOOD_JOB },
    ])
    const res = await handleImageAction('generate', { prompt: 'a cat' }, deps(impl))
    assert.equal(res!.status, 200)
    assert.equal(calls.length, 2)
  })
})

// ── generate ────────────────────────────────────────────────────────────────

describe('generate — server-side key, job submit + poll', () => {
  test('submits to /v1/generate with the key in a header and polls the job', async () => {
    const { calls, impl } = fetchDouble([
      { status: 202, json: { id: 'job_1', status: 'queued' } },
      { json: GOOD_JOB },
    ])
    const res = await handleImageAction('generate', {
      prompt: 'a neon coffee cup', aspectRatio: 'square', count: 2, model: 'studio',
    }, deps(impl))

    assert.ok(res)
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)

    assert.equal(calls.length, 2)
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].url, `${FAKE_BASE}/v1/generate`)
    assert.equal(calls[0].headers['x-api-key'], FAKE_KEY)
    assert.deepEqual(calls[0].body, { model: 'studio', aspectRatio: '1:1', count: 2, prompt: 'a neon coffee cup' })

    assert.equal(calls[1].method, 'GET')
    assert.equal(calls[1].url, `${FAKE_BASE}/v1/jobs/job_1`)
    assert.equal(calls[1].headers['x-api-key'], FAKE_KEY)
  })

  test('the key is NEVER placed in a URL', async () => {
    const { calls, impl } = fetchDouble([
      { status: 202, json: { id: 'job_1', status: 'queued' } },
      { json: GOOD_JOB },
    ])
    await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    for (const c of calls) {
      assert.ok(!c.url.includes(FAKE_KEY), `key leaked into a URL: ${c.url}`)
      assert.ok(!/[?&](api)?token=/i.test(c.url), `token query parameter in ${c.url}`)
    }
  })

  test('returns the hosted image urls and seeds', async () => {
    const { impl } = fetchDouble([
      { status: 202, json: { id: 'job_1', status: 'queued' } },
      { json: GOOD_JOB },
    ])
    const res = await handleImageAction('generate', { prompt: 'x', count: 2 }, deps(impl))
    const data = res!.body.data as { images: { url: string; seed?: number; id?: string }[]; model: string }
    assert.equal(data.images.length, 2)
    assert.equal(data.images[0].url, 'https://images.example.test/files/a.jpg')
    assert.equal(data.images[0].seed, 42)
    assert.equal(data.images[0].id, 'img_a')
  })

  test('a job already done on submit needs no poll', async () => {
    const { calls, impl } = fetchDouble([{ status: 200, json: GOOD_JOB }])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.status, 200)
    assert.equal(calls.length, 1)
  })

  test('keeps polling while the job is queued/running', async () => {
    const { calls, impl } = fetchDouble([
      { status: 202, json: { id: 'job_1', status: 'queued' } },
      { json: { id: 'job_1', status: 'queued' } },
      { json: { id: 'job_1', status: 'running' } },
      { json: GOOD_JOB },
    ])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.status, 200)
    assert.equal(calls.length, 4)
  })

  test('forwards seed and references when supplied, omits them otherwise', async () => {
    const withExtras = fetchDouble([{ status: 202, json: { id: 'j', status: 'queued' } }, { json: GOOD_JOB }])
    await handleImageAction('generate', { prompt: 'x', seed: 7, references: ['a', 'b'] }, deps(withExtras.impl))
    assert.equal((withExtras.calls[0].body as Record<string, unknown>).seed, 7)
    assert.deepEqual((withExtras.calls[0].body as Record<string, unknown>).references, ['a', 'b'])

    const without = fetchDouble([{ status: 202, json: { id: 'j', status: 'queued' } }, { json: GOOD_JOB }])
    await handleImageAction('generate', { prompt: 'x' }, deps(without.impl))
    assert.ok(!('seed' in (without.calls[0].body as Record<string, unknown>)))
    assert.ok(!('references' in (without.calls[0].body as Record<string, unknown>)))
  })

  test('caps references at 10 and drops non-strings', async () => {
    const { calls, impl } = fetchDouble([{ status: 202, json: { id: 'j', status: 'queued' } }, { json: GOOD_JOB }])
    const refs = [...Array(14).keys()].map(String)
    await handleImageAction('generate', { prompt: 'x', references: [...refs, 5, null] }, deps(impl))
    const sent = (calls[0].body as { references: string[] }).references
    assert.equal(sent.length, 10)
    assert.ok(sent.every((r) => typeof r === 'string'))
  })

  test('an empty prompt is refused before any upstream call', async () => {
    const { calls, impl } = fetchDouble([{ json: GOOD_JOB }])
    const res = await handleImageAction('generate', { prompt: '   ' }, deps(impl))
    assert.equal(res!.status, 400)
    assert.equal(res!.body.success, false)
    assert.equal(calls.length, 0)
    assertNeutral(res!.body, 'empty-prompt error')
  })

  test('an over-long prompt is refused before any upstream call', async () => {
    const { calls, impl } = fetchDouble([{ json: GOOD_JOB }])
    const res = await handleImageAction('generate', { prompt: 'x'.repeat(4001) }, deps(impl))
    assert.equal(res!.status, 400)
    assert.equal(calls.length, 0)
  })

  test('a job that returns no images is a clean 422', async () => {
    const { impl } = fetchDouble([
      { status: 202, json: { id: 'j', status: 'queued' } },
      { json: { id: 'j', status: 'done', images: [] } },
    ])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.status, 422)
    assertNeutral(res!.body, 'no-images error')
  })

  test('images without a url are dropped', async () => {
    const { impl } = fetchDouble([
      { status: 202, json: { id: 'j', status: 'queued' } },
      { json: { id: 'j', status: 'done', images: [{ seed: 1 }, { url: 'https://images.example.test/files/c.jpg' }] } },
    ])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    const data = res!.body.data as { images: unknown[] }
    assert.equal(data.images.length, 1)
  })
})

describe('generate — request shaping', () => {
  test('normalizeModel maps the public names, legacy ids and junk', () => {
    for (const m of IMAGE_MODELS) assert.equal(normalizeModel(m), m)
    // Model ids that predate this migration are stored in user settings and in
    // historical rows; they must map onto a public model, never be sent as-is.
    assert.equal(normalizeModel('nano-banana-pro'), 'studio')
    assert.equal(normalizeModel('nano-banana-2'), 'studio')
    assert.equal(normalizeModel('nano-banana'), 'flash')
    assert.equal(normalizeModel('imagen-4'), 'vivid')
    assert.equal(normalizeModel(undefined), 'studio')
    assert.equal(normalizeModel('whatever'), 'studio')
    assert.equal(normalizeModel(42), 'studio')
  })

  test('normalizeAspectRatio maps the app vocabulary onto the service vocabulary', () => {
    assert.equal(normalizeAspectRatio('square'), '1:1')
    assert.equal(normalizeAspectRatio('portrait'), '9:16')
    assert.equal(normalizeAspectRatio('landscape'), '16:9')
    assert.equal(normalizeAspectRatio('16:9'), '16:9')
    assert.equal(normalizeAspectRatio('3:4'), '3:4')
    assert.equal(normalizeAspectRatio('nonsense'), '1:1')
    assert.equal(normalizeAspectRatio(undefined), '1:1')
  })

  test('clampCount keeps the service contract of 1-4', () => {
    assert.equal(clampCount(undefined), 1)
    assert.equal(clampCount(0), 1)
    assert.equal(clampCount(-3), 1)
    assert.equal(clampCount(2), 2)
    assert.equal(clampCount(4), 4)
    assert.equal(clampCount(9), 4)
    assert.equal(clampCount('3'), 3)
    assert.equal(clampCount('abc'), 1)
  })

  test('a legacy model id from stored settings is translated, not forwarded', async () => {
    const { calls, impl } = fetchDouble([{ status: 202, json: { id: 'j', status: 'queued' } }, { json: GOOD_JOB }])
    await handleImageAction('generate', { prompt: 'x', model: 'nano-banana-pro' }, deps(impl))
    assert.equal((calls[0].body as { model: string }).model, 'studio')
  })
})

// ── configuration ───────────────────────────────────────────────────────────

describe('configuration is read from the environment only', () => {
  test('a missing key fails loudly and calls nothing', async () => {
    delete process.env.IMG_GEN_API_KEY
    const { calls, impl } = fetchDouble([{ json: GOOD_JOB }])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.status, 500)
    assert.equal(res!.body.success, false)
    assert.equal(calls.length, 0)
    assertNeutral(res!.body, 'unconfigured error')
  })

  test('a missing base fails loudly and calls nothing', async () => {
    delete process.env.IMG_GEN_API_BASE
    const { calls, impl } = fetchDouble([{ json: GOOD_JOB }])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.status, 500)
    assert.equal(calls.length, 0)
  })

  test('a whitespace-only key counts as missing', async () => {
    process.env.IMG_GEN_API_KEY = '   '
    const { calls, impl } = fetchDouble([{ json: GOOD_JOB }])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.status, 500)
    assert.equal(calls.length, 0)
  })

  test('a trailing slash on the base does not double up', async () => {
    process.env.IMG_GEN_API_BASE = `${FAKE_BASE}/`
    const { calls, impl } = fetchDouble([{ status: 202, json: { id: 'j', status: 'queued' } }, { json: GOOD_JOB }])
    await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(calls[0].url, `${FAKE_BASE}/v1/generate`)
  })
})

// ── error taxonomy ──────────────────────────────────────────────────────────

describe('error taxonomy — flat, neutral, credential-free', () => {
  const cases: Array<{ label: string; status: number; expect: number }> = [
    { label: 'bad request', status: 400, expect: 400 },
    { label: 'rejected key', status: 401, expect: 500 },
    { label: 'forbidden', status: 403, expect: 500 },
    { label: 'not found', status: 404, expect: 502 },
    { label: 'rate limited', status: 429, expect: 429 },
    { label: 'upstream failure', status: 500, expect: 502 },
    { label: 'generation failed', status: 502, expect: 502 },
    { label: 'unavailable', status: 503, expect: 502 },
  ]

  for (const c of cases) {
    test(`${c.label} (${c.status}) becomes a neutral ${c.expect}`, async () => {
      // The upstream body is hostile on purpose: it names vendors, echoes the
      // key and carries an account email. None of it may be relayed.
      const hostile = {
        error: {
          code: 'bad',
          message: `useapi.net rejected key ${FAKE_KEY} for account someone@example.com (nano-banana-pro / CapSolver)`,
        },
      }
      const { impl } = fetchDouble([{ status: c.status, json: hostile }])
      const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
      assert.equal(res!.status, c.expect)
      assert.equal(res!.body.success, false)
      assert.equal(typeof res!.body.error, 'string')
      assertNeutral(res!.body, `error body for upstream ${c.status}`)
    })
  }

  test('a failure never carries usedEmail or any account identity', async () => {
    const { impl } = fetchDouble([
      { status: 202, json: { id: 'j', status: 'queued' } },
      { json: { id: 'j', status: 'failed', error: 'account someone@example.com hit DAILY_QUOTA on nano-banana-pro' } },
    ])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.status, 422)
    assert.ok(!('usedEmail' in res!.body))
    assertNeutral(res!.body, 'failed-job error')
  })

  test('a failing poll call is a neutral error, not an upstream echo', async () => {
    const { impl } = fetchDouble([
      { status: 202, json: { id: 'j', status: 'queued' } },
      { status: 500, json: { error: { message: `key ${FAKE_KEY} revoked` } } },
    ])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.body.success, false)
    assertNeutral(res!.body, 'poll error')
  })

  test('a transport failure is neutral — the thrown error can carry the request', async () => {
    const { impl } = fetchDouble([{ throws: new Error(`connect ECONNREFUSED with X-API-Key: ${FAKE_KEY}`) }])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.status, 503)
    assertNeutral(res!.body, 'transport error')
  })

  test('non-JSON garbage from the service is neutral too', async () => {
    const { impl } = fetchDouble([{ status: 200, body: '<html>gateway</html>' }])
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.body.success, false)
    assertNeutral(res!.body, 'garbage-response error')
  })

  test('a job that never finishes ends in a bounded, neutral timeout', async () => {
    const responses: Array<{ status?: number; json?: unknown }> = [{ status: 202, json: { id: 'j', status: 'queued' } }]
    for (let i = 0; i < 500; i++) responses.push({ json: { id: 'j', status: 'running' } })
    const { calls, impl } = fetchDouble(responses)
    const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
    assert.equal(res!.status, 504)
    assertNeutral(res!.body, 'timeout error')
    // Bounded: it gives up rather than polling forever.
    assert.ok(calls.length < 100, `poll loop unbounded: ${calls.length} calls`)
  })
})

// ── actions with no equivalent on the new service ───────────────────────────

describe('upscale and upload_asset have no equivalent — they fail cleanly', () => {
  test('upscale never calls out and returns a neutral 501', async () => {
    const { calls, impl } = fetchDouble([{ json: {} }])
    const res = await handleImageAction('upscale', { mediaGenerationId: 'x' }, deps(impl))
    assert.equal(res!.status, 501)
    assert.equal(res!.body.success, false)
    assert.equal(calls.length, 0)
    assertNeutral(res!.body, 'upscale response')
  })

  test('upload_asset never calls out and returns a neutral 501', async () => {
    const { calls, impl } = fetchDouble([{ json: {} }])
    const res = await handleImageAction('upload_asset', { asset: 'data:image/png;base64,AAAA' }, deps(impl))
    assert.equal(res!.status, 501)
    assert.equal(res!.body.success, false)
    assert.equal(calls.length, 0)
    assertNeutral(res!.body, 'upload_asset response')
  })

  test('upload_asset does not fan out to accounts — no account is ever named', async () => {
    const { impl } = fetchDouble([{ json: {} }])
    const res = await handleImageAction('upload_asset', { asset: 'data:image/png;base64,AAAA' }, deps(impl))
    assert.ok(!('perAccount' in res!.body))
  })
})

describe('the accounts actions are not claimed by this handler', () => {
  for (const action of ['accounts', 'captcha-providers', 'register_account', 'delete_account', 'set_captcha_providers', 'jobs', 'status']) {
    test(`${action} is left to the legacy path`, async () => {
      const { calls, impl } = fetchDouble([{ json: {} }])
      const res = await handleImageAction(action, {}, deps(impl))
      assert.equal(res, null, `${action} must not be handled here`)
      assert.equal(calls.length, 0)
    })
  }
})

// ── the browser-visible surface as a whole ──────────────────────────────────

describe('nothing the browser can see names a vendor or a credential', () => {
  test('a successful response is neutral', async () => {
    const { impl } = fetchDouble([{ status: 202, json: { id: 'j', status: 'queued' } }, { json: GOOD_JOB }])
    const res = await handleImageAction('generate', { prompt: 'x', model: 'nano-banana-pro' }, deps(impl))
    assertNeutral(res!.body, 'success body')
    assert.equal((res!.body.data as { model: string }).model, 'studio')
  })

  test('every reachable error message is neutral', async () => {
    const messages: unknown[] = []
    for (const status of [400, 401, 403, 404, 429, 500, 502, 503, 596]) {
      const { impl } = fetchDouble([{ status, json: { error: { message: 'useapi.net says nano-banana-pro quota for a@b.com' } } }])
      const res = await handleImageAction('generate', { prompt: 'x' }, deps(impl))
      messages.push(res!.body.error)
    }
    for (const m of messages) assertNeutral(m, 'error message')
    assert.ok(messages.every((m) => typeof m === 'string' && (m as string).length > 0))
  })
})
