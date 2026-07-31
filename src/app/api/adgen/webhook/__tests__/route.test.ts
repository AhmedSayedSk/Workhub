import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  handleAdgenWebhook,
  decideMirror,
  normalizeStage,
  verifyAdgenSignature,
  type MirrorStore,
  type RenderJobSnapshot,
} from '../../../../../lib/adgenWebhook.ts'

// The webhook is the ONLY channel that moves a render out of its spinner, and
// it is reachable by anyone who can find the URL. Everything below runs against
// a fake store — no network, no Firestore, no real credentials.

// A fake secret. It exists only in this file and is never a real value.
const SECRET = 'whsec_test_only_not_a_real_secret_0123456789'
const OTHER_SECRET = 'whsec_test_only_a_different_secret_98765'

const NOW = 1_780_000_000_000 // fixed clock, ms

/** Build the header AdGen sends: `t=<unix-seconds>,v1=<hex>` over `t.rawBody`. */
function sign(rawBody: string, opts: { secret?: string; tsMs?: number } = {}): string {
  const t = Math.floor((opts.tsMs ?? NOW) / 1000)
  const v1 = createHmac('sha256', opts.secret ?? SECRET).update(`${t}.${rawBody}`).digest('hex')
  return `t=${t},v1=${v1}`
}

interface FakeDoc extends RenderJobSnapshot {
  adgenJobId?: string
}

interface Fake extends MirrorStore {
  docs: Record<string, FakeDoc>
  writes: Array<{ id: string; patch: Record<string, unknown> }>
}

/** A stand-in for the Firestore-backed store, with the same read-decide-write shape. */
function fakeStore(docs: Record<string, FakeDoc> = {}): Fake {
  const writes: Array<{ id: string; patch: Record<string, unknown> }> = []
  return {
    docs,
    writes,
    async mirror(adgenJobId, decide) {
      const hit = Object.entries(docs).find(([, d]) => d.adgenJobId === adgenJobId)
      if (!hit) return 'missing'
      const [id, current] = hit
      const patch = decide(current)
      if (!patch) return 'noop'
      writes.push({ id, patch })
      Object.assign(current, patch)
      return 'written'
    },
  }
}

/** Post a payload at the handler, signing it correctly unless told otherwise. */
function post(
  body: string | Record<string, unknown>,
  opts: { signature?: string; secret?: string; tsMs?: number; deliveryId?: string | null } = {}
): Request {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  const headers = new Headers({ 'content-type': 'application/json' })
  headers.set('x-adgen-signature', opts.signature ?? sign(raw, { secret: opts.secret, tsMs: opts.tsMs }))
  if (opts.deliveryId !== null) headers.set('x-adgen-delivery-id', opts.deliveryId ?? 'dlv_1')
  return new Request('https://workhub.example.test/api/adgen/webhook', { method: 'POST', headers, body: raw })
}

const COMPLETED = {
  event: 'job.completed',
  jobId: 'adgen_job_1',
  data: {
    status: 'done',
    progress: 100,
    stage: 'done',
    videoUrl: 'https://cdn.example.test/v.mp4',
    thumbnailUrl: 'https://cdn.example.test/t.jpg',
  },
}

const FAILED = {
  event: 'job.failed',
  jobId: 'adgen_job_1',
  data: { status: 'failed', error: 'encoder ran out of memory' },
}

/** A job mid-render, as the render route leaves it. */
const rendering = (): Record<string, FakeDoc> => ({
  job_a: { adgenJobId: 'adgen_job_1', status: 'rendering', progress: 40, stage: 'rendering' },
})

beforeEach(() => {
  process.env.ADGEN_WEBHOOK_SECRET = SECRET
})

afterEach(() => {
  delete process.env.ADGEN_WEBHOOK_SECRET
})

describe('handleAdgenWebhook — signature', () => {
  test('a valid signature mirrors the payload onto the matching job', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(post(COMPLETED), { store, nowMs: NOW })

    assert.equal(res.status, 200)
    assert.equal(store.writes.length, 1)
    assert.equal(store.writes[0].id, 'job_a')
    const doc = store.docs.job_a
    assert.equal(doc.status, 'done')
    assert.equal(doc.progress, 100)
    assert.equal(doc.stage, 'done')
    assert.equal(doc.videoUrl, 'https://cdn.example.test/v.mp4')
    assert.equal(doc.thumbnailUrl, 'https://cdn.example.test/t.jpg')
    assert.equal(typeof doc.finishedAt, 'number')
  })

  test('a wrong signature is 401 and writes nothing', async () => {
    const store = fakeStore(rendering())
    const raw = JSON.stringify(COMPLETED)
    const bad = `t=${Math.floor(NOW / 1000)},v1=${'a'.repeat(64)}`
    const res = await handleAdgenWebhook(post(raw, { signature: bad }), { store, nowMs: NOW })

    assert.equal(res.status, 401)
    assert.deepEqual(store.writes, [])
    assert.equal(store.docs.job_a.status, 'rendering')
  })

  test('a signature made with a different secret is 401', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(post(COMPLETED, { secret: OTHER_SECRET }), { store, nowMs: NOW })

    assert.equal(res.status, 401)
    assert.deepEqual(store.writes, [])
  })

  test('a body tampered with after signing is 401', async () => {
    const store = fakeStore(rendering())
    const signed = JSON.stringify(COMPLETED)
    const tampered = JSON.stringify({ ...COMPLETED, jobId: 'adgen_job_other' })
    const res = await handleAdgenWebhook(
      post(tampered, { signature: sign(signed) }),
      { store, nowMs: NOW }
    )

    assert.equal(res.status, 401)
    assert.deepEqual(store.writes, [])
  })

  test('the signature covers the RAW bytes, not a re-serialised payload', async () => {
    // Byte-identical JSON with different whitespace: verifying against
    // JSON.stringify(JSON.parse(raw)) would reject this valid delivery.
    const store = fakeStore(rendering())
    const raw = '{  "event" : "job.completed" ,  "jobId" : "adgen_job_1" , "data" : { "status" : "done" } }'
    const res = await handleAdgenWebhook(post(raw), { store, nowMs: NOW })

    assert.equal(res.status, 200)
    assert.equal(store.docs.job_a.status, 'done')
  })

  test('a stale timestamp (older than 5 minutes) is 401', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(
      post(COMPLETED, { tsMs: NOW - 6 * 60_000 }),
      { store, nowMs: NOW }
    )

    assert.equal(res.status, 401)
    assert.deepEqual(store.writes, [])
  })

  test('a timestamp far in the future is 401', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(
      post(COMPLETED, { tsMs: NOW + 6 * 60_000 }),
      { store, nowMs: NOW }
    )

    assert.equal(res.status, 401)
    assert.deepEqual(store.writes, [])
  })

  test('a timestamp inside the skew window is accepted', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(
      post(COMPLETED, { tsMs: NOW - 4 * 60_000 }),
      { store, nowMs: NOW }
    )

    assert.equal(res.status, 200)
    assert.equal(store.docs.job_a.status, 'done')
  })

  test('a missing or malformed signature header is 401', async () => {
    for (const header of ['', 'garbage', 'v1=abc', `t=${Math.floor(NOW / 1000)}`, 't=notanumber,v1=abc', `t=${Math.floor(NOW / 1000)},v1=zz`]) {
      const store = fakeStore(rendering())
      const res = await handleAdgenWebhook(post(COMPLETED, { signature: header }), { store, nowMs: NOW })
      assert.equal(res.status, 401, `header ${JSON.stringify(header)} should be rejected`)
      assert.deepEqual(store.writes, [])
    }
  })

  test('a signature of the wrong length is rejected without throwing', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(
      post(COMPLETED, { signature: `t=${Math.floor(NOW / 1000)},v1=abcd` }),
      { store, nowMs: NOW }
    )
    assert.equal(res.status, 401)
  })

  test('an unconfigured secret rejects every delivery and writes nothing', async () => {
    delete process.env.ADGEN_WEBHOOK_SECRET
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(post(COMPLETED, { signature: 't=1,v1=00' }), { store, nowMs: NOW })

    assert.equal(res.status, 500)
    assert.deepEqual(store.writes, [])
  })

  test('verifyAdgenSignature accepts what it signs and nothing else', () => {
    const raw = '{"a":1}'
    assert.equal(verifyAdgenSignature({ header: sign(raw), rawBody: raw, secret: SECRET, nowMs: NOW }), true)
    assert.equal(verifyAdgenSignature({ header: sign(raw), rawBody: '{"a":2}', secret: SECRET, nowMs: NOW }), false)
    assert.equal(verifyAdgenSignature({ header: sign(raw), rawBody: raw, secret: OTHER_SECRET, nowMs: NOW }), false)
    assert.equal(verifyAdgenSignature({ header: null, rawBody: raw, secret: SECRET, nowMs: NOW }), false)
    assert.equal(verifyAdgenSignature({ header: sign(raw), rawBody: raw, secret: '', nowMs: NOW }), false)
  })
})

describe('handleAdgenWebhook — unknown and malformed deliveries', () => {
  test('an unknown adgenJobId is 200 and writes nothing', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(
      post({ ...COMPLETED, jobId: 'adgen_job_we_never_started' }),
      { store, nowMs: NOW }
    )

    assert.equal(res.status, 200)
    assert.deepEqual(store.writes, [])
  })

  test('a payload with no job id is 200 and writes nothing', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(post({ event: 'job.completed', data: {} }), { store, nowMs: NOW })

    assert.equal(res.status, 200)
    assert.deepEqual(store.writes, [])
  })

  test('an unrecognised event is 200 and writes nothing', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(
      post({ event: 'job.progress', jobId: 'adgen_job_1', data: { progress: 55 } }),
      { store, nowMs: NOW }
    )

    assert.equal(res.status, 200)
    assert.deepEqual(store.writes, [])
  })

  test('a correctly signed but non-JSON body is 400 and writes nothing', async () => {
    const store = fakeStore(rendering())
    const res = await handleAdgenWebhook(post('not json at all'), { store, nowMs: NOW })

    assert.equal(res.status, 400)
    assert.deepEqual(store.writes, [])
  })

  test('a store failure is 500 so the sender retries', async () => {
    const store = fakeStore(rendering())
    store.mirror = async () => {
      throw new Error('firestore unavailable')
    }
    const res = await handleAdgenWebhook(post(COMPLETED), { store, nowMs: NOW })

    assert.equal(res.status, 500)
    const body = await res.json()
    assert.ok(!JSON.stringify(body).includes('firestore'), 'must not echo the internal failure')
  })
})

describe('handleAdgenWebhook — at-least-once delivery', () => {
  test('a replayed delivery id is a no-op', async () => {
    const store = fakeStore({
      job_a: { adgenJobId: 'adgen_job_1', status: 'rendering', progress: 40, lastDeliveryId: 'dlv_7' },
    })
    const res = await handleAdgenWebhook(post(COMPLETED, { deliveryId: 'dlv_7' }), { store, nowMs: NOW })

    assert.equal(res.status, 200)
    assert.deepEqual(store.writes, [])
    assert.equal(store.docs.job_a.status, 'rendering')
  })

  test('the same delivery sent twice writes once', async () => {
    const store = fakeStore(rendering())
    await handleAdgenWebhook(post(COMPLETED, { deliveryId: 'dlv_9' }), { store, nowMs: NOW })
    await handleAdgenWebhook(post(COMPLETED, { deliveryId: 'dlv_9' }), { store, nowMs: NOW })

    assert.equal(store.writes.length, 1)
    assert.equal(store.docs.job_a.lastDeliveryId, 'dlv_9')
  })

  test('the delivery id is recorded so a later replay can be recognised', async () => {
    const store = fakeStore(rendering())
    await handleAdgenWebhook(post(COMPLETED, { deliveryId: 'dlv_3' }), { store, nowMs: NOW })
    assert.equal(store.writes[0].patch.lastDeliveryId, 'dlv_3')
  })
})

describe('handleAdgenWebhook — terminal state guard', () => {
  test('a late completion never resurrects a job the user cancelled', async () => {
    const store = fakeStore({
      job_a: { adgenJobId: 'adgen_job_1', status: 'cancelled', stage: 'cancelled', finishedAt: NOW - 1000 },
    })
    const res = await handleAdgenWebhook(post(COMPLETED, { deliveryId: 'dlv_late' }), { store, nowMs: NOW })

    assert.equal(res.status, 200)
    assert.deepEqual(store.writes, [])
    assert.equal(store.docs.job_a.status, 'cancelled')
    assert.equal(store.docs.job_a.videoUrl, undefined)
  })

  test('a failure never overwrites a job that already finished', async () => {
    const store = fakeStore({
      job_a: { adgenJobId: 'adgen_job_1', status: 'done', progress: 100, videoUrl: 'https://cdn.example.test/v.mp4' },
    })
    const res = await handleAdgenWebhook(post(FAILED, { deliveryId: 'dlv_late2' }), { store, nowMs: NOW })

    assert.equal(res.status, 200)
    assert.deepEqual(store.writes, [])
    assert.equal(store.docs.job_a.status, 'done')
    assert.equal(store.docs.job_a.videoUrl, 'https://cdn.example.test/v.mp4')
  })

  test('a completion for a job the user asked to stop settles as cancelled', async () => {
    const store = fakeStore({
      job_a: { adgenJobId: 'adgen_job_1', status: 'rendering', progress: 80, cancelRequested: true },
    })
    await handleAdgenWebhook(post(COMPLETED), { store, nowMs: NOW })

    assert.equal(store.docs.job_a.status, 'cancelled')
    assert.equal(store.docs.job_a.stage, 'cancelled')
    assert.equal(store.docs.job_a.videoUrl, undefined)
    assert.equal(typeof store.docs.job_a.finishedAt, 'number')
  })
})

describe('handleAdgenWebhook — field mapping', () => {
  test('job.failed records a terminal failure with the reason', async () => {
    const store = fakeStore(rendering())
    await handleAdgenWebhook(post(FAILED), { store, nowMs: NOW })

    assert.equal(store.docs.job_a.status, 'failed')
    assert.equal(store.docs.job_a.error, 'encoder ran out of memory')
    assert.equal(typeof store.docs.job_a.finishedAt, 'number')
  })

  test('job.failed with no reason still reaches a terminal state with a message', async () => {
    const store = fakeStore(rendering())
    await handleAdgenWebhook(post({ event: 'job.failed', jobId: 'adgen_job_1' }), { store, nowMs: NOW })

    assert.equal(store.docs.job_a.status, 'failed')
    assert.equal(typeof store.docs.job_a.error, 'string')
    assert.ok((store.docs.job_a.error || '').length > 0)
  })

  test('a cancellation reported as a failure is stored as cancelled', async () => {
    const store = fakeStore(rendering())
    await handleAdgenWebhook(
      post({ event: 'job.failed', jobId: 'adgen_job_1', data: { status: 'cancelled' } }),
      { store, nowMs: NOW }
    )

    assert.equal(store.docs.job_a.status, 'cancelled')
    assert.equal(store.docs.job_a.stage, 'cancelled')
  })

  test('the job id is read from any of the shapes AdGen may use', async () => {
    for (const body of [
      { event: 'job.completed', jobId: 'adgen_job_1' },
      { event: 'job.completed', data: { jobId: 'adgen_job_1' } },
      { event: 'job.completed', data: { id: 'adgen_job_1' } },
      { event: 'job.completed', job: { id: 'adgen_job_1' } },
    ]) {
      const store = fakeStore(rendering())
      const res = await handleAdgenWebhook(post(body), { store, nowMs: NOW })
      assert.equal(res.status, 200)
      assert.equal(store.docs.job_a.status, 'done', `id not found in ${JSON.stringify(body)}`)
    }
  })

  test('a flat payload (no data envelope) is mapped too', async () => {
    const store = fakeStore(rendering())
    await handleAdgenWebhook(
      post({ event: 'job.completed', jobId: 'adgen_job_1', status: 'done', videoUrl: 'https://cdn.example.test/f.mp4' }),
      { store, nowMs: NOW }
    )

    assert.equal(store.docs.job_a.status, 'done')
    assert.equal(store.docs.job_a.videoUrl, 'https://cdn.example.test/f.mp4')
  })

  test('an over-long error message is truncated before it is stored', async () => {
    const store = fakeStore(rendering())
    await handleAdgenWebhook(
      post({ event: 'job.failed', jobId: 'adgen_job_1', data: { error: 'x'.repeat(5000) } }),
      { store, nowMs: NOW }
    )

    assert.ok((store.docs.job_a.error || '').length <= 500)
  })

  test('a non-string url is ignored rather than written', async () => {
    const store = fakeStore(rendering())
    await handleAdgenWebhook(
      post({ event: 'job.completed', jobId: 'adgen_job_1', data: { status: 'done', videoUrl: { url: 'x' } } }),
      { store, nowMs: NOW }
    )

    assert.equal(store.docs.job_a.status, 'done')
    assert.equal(store.docs.job_a.videoUrl, undefined)
  })
})

describe('normalizeStage', () => {
  test('keeps the stages the progress card can label', () => {
    for (const s of ['preparing', 'hook', 'voiceover', 'rendering', 'encoding', 'uploading', 'done', 'cancelled']) {
      assert.equal(normalizeStage(s), s)
    }
  })

  test('maps anything it cannot label onto rendering', () => {
    for (const s of ['compositing', 'MUXING', 'stage-7', '', 42, null, undefined, {}]) {
      assert.equal(normalizeStage(s), 'rendering')
    }
  })

  test('is case- and whitespace-insensitive for known stages', () => {
    assert.equal(normalizeStage(' Encoding '), 'encoding')
  })
})

describe('decideMirror — the poll fallback path', () => {
  const base = (): RenderJobSnapshot => ({ status: 'rendering', progress: 30, stage: 'rendering' })

  test('moves progress and stage forward', () => {
    const patch = decideMirror(base(), { status: 'rendering', progress: 55, stage: 'encoding' }, { nowMs: NOW })
    assert.ok(patch)
    assert.equal(patch!.progress, 55)
    assert.equal(patch!.stage, 'encoding')
  })

  test('never moves progress backwards', () => {
    const patch = decideMirror(base(), { status: 'rendering', progress: 5, stage: 'rendering' }, { nowMs: NOW })
    assert.equal(patch, null)
  })

  test('writes nothing when nothing changed', () => {
    assert.equal(decideMirror(base(), { status: 'rendering', progress: 30, stage: 'rendering' }, { nowMs: NOW }), null)
  })

  test('clamps progress into 0-100', () => {
    const up = decideMirror(base(), { status: 'rendering', progress: 4000 }, { nowMs: NOW })
    assert.equal(up!.progress, 100)
    // A negative reading can never be written: it is clamped to 0 and 0 never
    // beats what is already stored.
    const down = decideMirror({ status: 'queued', progress: 0 }, { status: 'rendering', progress: -20 }, { nowMs: NOW })
    assert.equal(down!.progress, undefined)
    assert.equal(down!.status, 'rendering')
  })

  test('stamps startedAt on the first move out of queued', () => {
    const patch = decideMirror({ status: 'queued', progress: 0 }, { status: 'rendering', progress: 3 }, { nowMs: NOW })
    assert.equal(patch!.status, 'rendering')
    assert.equal(patch!.startedAt, NOW)
  })

  test('does not restamp startedAt', () => {
    const patch = decideMirror(
      { status: 'rendering', progress: 30, startedAt: NOW - 5000 },
      { status: 'rendering', progress: 45 },
      { nowMs: NOW }
    )
    assert.equal(patch!.startedAt, undefined)
  })

  test('never regresses a rendering job back to queued', () => {
    const patch = decideMirror(base(), { status: 'queued', progress: 40 }, { nowMs: NOW })
    assert.equal(patch?.status, undefined)
  })

  test('an unlabelable stage becomes rendering', () => {
    const patch = decideMirror(
      { status: 'rendering', progress: 30, stage: 'preparing' },
      { status: 'rendering', progress: 44, stage: 'compositing' },
      { nowMs: NOW }
    )
    assert.equal(patch!.stage, 'rendering')
  })

  test('refuses to touch a job that already reached a terminal state', () => {
    for (const status of ['done', 'failed', 'cancelled']) {
      assert.equal(
        decideMirror({ status, progress: 100 }, { status: 'rendering', progress: 10 }, { nowMs: NOW }),
        null,
        `${status} must stay put`
      )
    }
  })

  test('an unknown incoming status is ignored rather than written', () => {
    const patch = decideMirror(base(), { status: 'transcoding' as never, progress: 60 }, { nowMs: NOW })
    assert.equal(patch?.status, undefined)
    assert.equal(patch!.progress, 60)
  })
})
