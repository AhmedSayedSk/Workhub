import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getRenderStatus, publicRenderJob, MAX_RENDER_MS, type AdGenJobState } from '../renderMirror.ts'

// The body of GET /api/render-jobs/[id]/status, minus the framework.

const NOW = 1_780_000_000_000

function deps(
  job: Record<string, unknown> | null,
  getJob: () => Promise<AdGenJobState>,
  calls: { asked: number; wrote: Array<Record<string, unknown> | null> } = { asked: 0, wrote: [] }
) {
  return {
    calls,
    read: async () => (job ? ({ id: 'job_a', ...job } as never) : null),
    getJob: async () => {
      calls.asked += 1
      return getJob()
    },
    mirror: async (_id: string, decide: (c: never) => Record<string, unknown> | null) => {
      const patch = decide((job || {}) as never)
      calls.wrote.push(patch)
      return patch ? ('written' as const) : ('noop' as const)
    },
    nowMs: NOW,
  }
}

describe('getRenderStatus', () => {
  test('reports a job that is not there', async () => {
    const out = await getRenderStatus('gone', deps(null, async () => ({ status: 'done' })))
    assert.deepEqual(out, { found: false })
  })

  test('a settled job costs no service call and no write', async () => {
    const d = deps({ status: 'done', progress: 100, videoUrl: 'https://cdn.example.test/v.mp4' }, async () => ({ status: 'done' }))
    const out = await getRenderStatus('job_a', d)

    assert.equal(out.found && out.job.status, 'done')
    assert.equal(out.found && out.job.videoUrl, 'https://cdn.example.test/v.mp4')
    assert.equal(d.calls.asked, 0)
    assert.deepEqual(d.calls.wrote, [])
  })

  test('an in-flight job is refreshed from the service and mirrored', async () => {
    const d = deps(
      { status: 'rendering', progress: 20, stage: 'rendering', adgenJobId: 'adgen_1', engine: 'adgen', createdAt: NOW - 30_000 },
      async () => ({ status: 'rendering', progress: 70, stage: 'encoding' })
    )
    const out = await getRenderStatus('job_a', d)

    assert.equal(d.calls.asked, 1)
    assert.equal(out.found && out.job.progress, 70)
    assert.equal(out.found && out.job.stage, 'encoding')
    assert.equal(d.calls.wrote[0]?.progress, 70)
  })

  test('the response reflects the write that just happened', async () => {
    const d = deps(
      { status: 'rendering', progress: 20, adgenJobId: 'adgen_1', engine: 'adgen', createdAt: NOW - 30_000 },
      async () => ({ status: 'done', progress: 100, videoUrl: 'https://cdn.example.test/v.mp4' })
    )
    const out = await getRenderStatus('job_a', d)

    assert.equal(out.found && out.job.status, 'done')
    assert.equal(out.found && out.job.videoUrl, 'https://cdn.example.test/v.mp4')
  })

  test('a job the service has lost is settled rather than left spinning', async () => {
    const gone = Object.assign(new Error('not found'), { status: 404 })
    const d = deps(
      { status: 'rendering', progress: 20, adgenJobId: 'adgen_1', engine: 'adgen', createdAt: NOW - 30_000 },
      async () => { throw gone }
    )
    const out = await getRenderStatus('job_a', d)

    assert.equal(out.found && out.job.status, 'failed')
    assert.ok(out.found && out.job.error)
  })

  test('a transient service failure returns the last known state', async () => {
    const d = deps(
      { status: 'rendering', progress: 20, stage: 'rendering', adgenJobId: 'adgen_1', engine: 'adgen', createdAt: NOW - 30_000 },
      async () => { throw Object.assign(new Error('boom'), { status: 503 }) }
    )
    const out = await getRenderStatus('job_a', d)

    assert.equal(out.found && out.job.status, 'rendering')
    assert.equal(out.found && out.job.progress, 20)
    assert.deepEqual(d.calls.wrote, [])
  })

  test('a stuck job is eventually settled by a plain status check', async () => {
    const d = deps(
      { status: 'rendering', progress: 20, adgenJobId: 'adgen_1', engine: 'adgen', createdAt: NOW - MAX_RENDER_MS - 1 },
      async () => ({ status: 'rendering', progress: 20 })
    )
    const out = await getRenderStatus('job_a', d)

    assert.equal(out.found && out.job.status, 'failed')
  })
})

describe('publicRenderJob', () => {
  test('exposes only what the UI renders', async () => {
    const view = publicRenderJob({
      id: 'job_a',
      status: 'rendering',
      progress: 40,
      stage: 'encoding',
      adgenJobId: 'adgen_secret_1',
      engine: 'adgen',
      deliveryIds: ['dlv_1'],
    } as never)

    assert.deepEqual(Object.keys(view).sort(), ['id', 'progress', 'stage', 'status'])
    assert.ok(!JSON.stringify(view).includes('adgen_secret_1'), 'internal ids must not be published')
  })

  test('fills in the fields a fresh job has not written yet', async () => {
    const view = publicRenderJob({ id: 'job_a' } as never)
    assert.equal(view.status, 'queued')
    assert.equal(view.progress, 0)
    assert.equal(view.stage, 'preparing')
  })
})
