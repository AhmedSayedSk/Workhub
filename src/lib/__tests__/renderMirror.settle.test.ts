import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { settleRenderJob, MAX_RENDER_MS, START_GRACE_MS, type AdGenJobState } from '../renderMirror.ts'

// The backstop that lets a render finish with no browser tab open. Every branch
// here is a way a job could otherwise spin forever.

const NOW = 1_780_000_000_000

interface Recorded {
  patch: Record<string, unknown> | null
  current: Record<string, unknown>
}

/** Collects what the settle logic decided, given a document's current state. */
function recorder(current: Record<string, unknown> = {}) {
  const calls: Recorded[] = []
  return {
    calls,
    mirror: async (_docId: string, decide: (c: never) => Record<string, unknown> | null) => {
      const patch = decide(current as never)
      calls.push({ patch, current })
      return patch ? ('written' as const) : ('noop' as const)
    },
  }
}

function httpError(status: number): Error & { status: number } {
  const e = new Error('service said no') as Error & { status: number }
  e.status = status
  return e
}

const job = (over: Record<string, unknown> = {}) => ({
  id: 'job_a',
  engine: 'adgen',
  status: 'rendering',
  adgenJobId: 'adgen_job_1',
  createdAt: NOW - 60_000,
  ...over,
})

const alive: AdGenJobState = { status: 'rendering', progress: 55, stage: 'encoding' }

describe('settleRenderJob — healthy job', () => {
  test('mirrors the service state onto the document', async () => {
    const rec = recorder({ status: 'rendering', progress: 10 })
    const out = await settleRenderJob(job(), {
      getJob: async () => alive,
      mirror: rec.mirror,
      nowMs: NOW,
    })

    assert.equal(out.result, 'written')
    assert.equal(out.patch?.progress, 55)
    assert.equal(out.patch?.stage, 'encoding')
  })

  test('mirrors a completion the webhook never delivered', async () => {
    const rec = recorder({ status: 'rendering', progress: 40 })
    const out = await settleRenderJob(job(), {
      getJob: async () => ({ status: 'done', progress: 100, videoUrl: 'https://cdn.example.test/v.mp4' }),
      mirror: rec.mirror,
      nowMs: NOW,
    })

    assert.equal(out.patch?.status, 'done')
    assert.equal(out.patch?.videoUrl, 'https://cdn.example.test/v.mp4')
    assert.equal(typeof out.patch?.finishedAt, 'number')
  })

  test('does nothing for a job that already settled', async () => {
    const rec = recorder()
    let asked = false
    const out = await settleRenderJob(job({ status: 'done' }), {
      getJob: async () => { asked = true; return alive },
      mirror: rec.mirror,
      nowMs: NOW,
    })

    assert.equal(out.result, 'skipped')
    assert.equal(asked, false, 'a settled job must not cost a service call')
    assert.deepEqual(rec.calls, [])
  })
})

describe('settleRenderJob — the service lost the job', () => {
  for (const status of [404, 410]) {
    test(`a ${status} settles the job as failed instead of retrying forever`, async () => {
      const rec = recorder({ status: 'rendering', progress: 30 })
      const out = await settleRenderJob(job(), {
        getJob: async () => { throw httpError(status) },
        mirror: rec.mirror,
        nowMs: NOW,
      })

      assert.equal(out.patch?.status, 'failed')
      assert.equal(typeof out.patch?.error, 'string')
      assert.equal(typeof out.patch?.finishedAt, 'number')
    })
  }

  test('a transient failure leaves the job alone', async () => {
    for (const status of [500, 502, 503, 504, undefined]) {
      const rec = recorder({ status: 'rendering', progress: 30 })
      const out = await settleRenderJob(job(), {
        getJob: async () => { throw status ? httpError(status) : new Error('socket hang up') },
        mirror: rec.mirror,
        nowMs: NOW,
      })

      assert.equal(out.patch, null, `status ${status} must not settle the job`)
      assert.deepEqual(rec.calls, [])
    }
  })

  test('a transient failure DOES settle a job that has aged out', async () => {
    const rec = recorder({ status: 'rendering', progress: 30 })
    const out = await settleRenderJob(job({ createdAt: NOW - MAX_RENDER_MS - 1000 }), {
      getJob: async () => { throw httpError(503) },
      mirror: rec.mirror,
      nowMs: NOW,
    })

    assert.equal(out.patch?.status, 'failed')
  })

  test('a job still running long past any plausible render is abandoned', async () => {
    const rec = recorder({ status: 'rendering', progress: 30 })
    const out = await settleRenderJob(job({ createdAt: NOW - MAX_RENDER_MS - 1000 }), {
      getJob: async () => alive,
      mirror: rec.mirror,
      nowMs: NOW,
    })

    assert.equal(out.patch?.status, 'failed')
    assert.equal(typeof out.patch?.finishedAt, 'number')
  })

  test('a job the user stopped is abandoned as cancelled, not failed', async () => {
    const rec = recorder({ status: 'rendering', cancelRequested: true })
    const out = await settleRenderJob(job({ createdAt: NOW - MAX_RENDER_MS - 1000 }), {
      getJob: async () => { throw httpError(404) },
      mirror: rec.mirror,
      nowMs: NOW,
    })

    assert.equal(out.patch?.status, 'cancelled')
    assert.equal(out.patch?.error, undefined)
  })
})

describe('settleRenderJob — the render never started', () => {
  test('a job with no service id past the grace period is settled', async () => {
    const rec = recorder({ status: 'queued' })
    const out = await settleRenderJob(
      job({ adgenJobId: undefined, status: 'queued', createdAt: NOW - START_GRACE_MS - 1000 }),
      { getJob: async () => alive, mirror: rec.mirror, nowMs: NOW }
    )

    assert.equal(out.patch?.status, 'failed')
    assert.equal(typeof out.patch?.finishedAt, 'number')
  })

  test('a job with no service id INSIDE the grace period is left alone', async () => {
    const rec = recorder({ status: 'queued' })
    const out = await settleRenderJob(
      job({ adgenJobId: undefined, status: 'queued', createdAt: NOW - 1000 }),
      { getJob: async () => alive, mirror: rec.mirror, nowMs: NOW }
    )

    assert.equal(out.patch, null)
    assert.deepEqual(rec.calls, [])
  })

  test('a job from the previous render worker is never touched', async () => {
    // No `engine`: that worker owns its own documents and writes them directly.
    const rec = recorder({ status: 'queued' })
    const out = await settleRenderJob(
      { id: 'legacy', status: 'queued', createdAt: NOW - 3 * 60 * 60_000 },
      { getJob: async () => alive, mirror: rec.mirror, nowMs: NOW }
    )

    assert.equal(out.patch, null)
    assert.deepEqual(rec.calls, [])
  })
})

describe('settleRenderJob — races with the webhook', () => {
  test('a settle decision re-checks the document inside the transaction', async () => {
    // The read said 'rendering', but a webhook landed before the transaction ran.
    const rec = recorder({ status: 'done', progress: 100 })
    const out = await settleRenderJob(job({ createdAt: NOW - MAX_RENDER_MS - 1000 }), {
      getJob: async () => { throw httpError(404) },
      mirror: rec.mirror,
      nowMs: NOW,
    })

    assert.equal(out.patch, null, 'must not overwrite the state the webhook wrote')
    assert.equal(rec.calls.length, 1, 'the decision still ran, and declined')
  })

  test('a mirrored update also re-checks, via decideMirror', async () => {
    const rec = recorder({ status: 'cancelled', stage: 'cancelled' })
    const out = await settleRenderJob(job(), {
      getJob: async () => ({ status: 'done', progress: 100, videoUrl: 'https://cdn.example.test/v.mp4' }),
      mirror: rec.mirror,
      nowMs: NOW,
    })

    assert.equal(out.patch, null)
  })
})
