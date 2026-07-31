import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRenderJobMirror, SWEEP_LIMIT, type MirrorDb } from '../adgenMirror.ts'

// The document adapter. A fake Firestore stands in for the real one so the
// query, the transaction and the sweep filter are exercised without a database.

interface Row {
  [k: string]: unknown
}

interface Log {
  queries: Array<{ field: string; op: string; value: unknown; limit?: number }>
  transactions: number
  updates: Array<{ id: string; patch: Record<string, unknown> }>
}

/** A fake Firestore holding one collection of documents. */
function fakeDb(docs: Record<string, Row>): { db: MirrorDb; log: Log; docs: Record<string, Row> } {
  const log: Log = { queries: [], transactions: 0, updates: [] }

  const snapOf = (id: string) => ({
    exists: Object.prototype.hasOwnProperty.call(docs, id),
    id,
    data: () => docs[id],
    ref: refOf(id),
  })

  function refOf(id: string) {
    return { id, get: async () => snapOf(id) }
  }

  function query(filters: Array<{ field: string; op: string; value: unknown }>, limit?: number) {
    return {
      where(field: string, op: string, value: unknown) {
        return query([...filters, { field, op, value }], limit)
      },
      limit(n: number) {
        return query(filters, n)
      },
      async get() {
        for (const f of filters) log.queries.push({ ...f, limit })
        let hits = Object.entries(docs).filter(([, d]) =>
          filters.every((f) => (f.op === 'in' ? (f.value as unknown[]).includes(d[f.field]) : d[f.field] === f.value))
        )
        if (limit !== undefined) hits = hits.slice(0, limit)
        return { empty: hits.length === 0, docs: hits.map(([id]) => snapOf(id)) }
      },
    }
  }

  const db: MirrorDb = {
    collection(path: string) {
      assert.equal(path, 'renderJobs', 'the mirror must only touch renderJobs')
      return Object.assign(query([]), { doc: (id: string) => refOf(id) })
    },
    async runTransaction(fn) {
      log.transactions += 1
      return fn({
        get: async (ref) => snapOf(ref.id),
        update: (ref, patch) => {
          log.updates.push({ id: ref.id, patch })
          docs[ref.id] = { ...docs[ref.id], ...patch }
        },
      })
    },
  }

  return { db, log, docs }
}

const seed = (): Record<string, Row> => ({
  job_a: { engine: 'adgen', adgenJobId: 'adgen_1', status: 'rendering', progress: 20 },
  job_b: { engine: 'adgen', adgenJobId: 'adgen_2', status: 'done', progress: 100 },
  job_legacy: { status: 'queued', progress: 0 },
})

describe('createRenderJobMirror — byDocId', () => {
  test('applies a patch inside a transaction', async () => {
    const { db, log, docs } = fakeDb(seed())
    const mirror = createRenderJobMirror(() => db)

    const result = await mirror.byDocId('job_a', () => ({ progress: 60 }))

    assert.equal(result, 'written')
    assert.equal(log.transactions, 1)
    assert.deepEqual(log.updates, [{ id: 'job_a', patch: { progress: 60 } }])
    assert.equal(docs.job_a.progress, 60)
  })

  test('the decision sees the document as it is INSIDE the transaction', async () => {
    const { db } = fakeDb(seed())
    const mirror = createRenderJobMirror(() => db)

    let seen: unknown = null
    await mirror.byDocId('job_a', (current) => {
      seen = current
      return null
    })

    assert.equal((seen as { status?: string })?.status, 'rendering')
    assert.equal((seen as { progress?: number })?.progress, 20)
  })

  test('a null decision writes nothing', async () => {
    const { db, log } = fakeDb(seed())
    const mirror = createRenderJobMirror(() => db)

    assert.equal(await mirror.byDocId('job_a', () => null), 'noop')
    assert.deepEqual(log.updates, [])
  })

  test('a missing document is reported, not written', async () => {
    const { db, log } = fakeDb(seed())
    const mirror = createRenderJobMirror(() => db)

    assert.equal(await mirror.byDocId('nope', () => ({ progress: 1 })), 'missing')
    assert.deepEqual(log.updates, [])
  })
})

describe('createRenderJobMirror — byAdgenJobId', () => {
  test('finds the document carrying the service job id', async () => {
    const { db, log, docs } = fakeDb(seed())
    const mirror = createRenderJobMirror(() => db)

    const result = await mirror.byAdgenJobId('adgen_1', () => ({ status: 'done' }))

    assert.equal(result, 'written')
    assert.equal(docs.job_a.status, 'done')
    assert.deepEqual(log.queries[0], { field: 'adgenJobId', op: '==', value: 'adgen_1', limit: 1 })
  })

  test('an unknown service job id is missing, never a write', async () => {
    const { db, log } = fakeDb(seed())
    const mirror = createRenderJobMirror(() => db)

    assert.equal(await mirror.byAdgenJobId('adgen_unknown', () => ({ status: 'done' })), 'missing')
    assert.deepEqual(log.updates, [])
    assert.equal(log.transactions, 0, 'a missing job must not open a transaction')
  })

  test('the webhook store and byAdgenJobId are the same code path', async () => {
    const { db, docs } = fakeDb(seed())
    const mirror = createRenderJobMirror(() => db)

    assert.equal(await mirror.store.mirror('adgen_1', () => ({ stage: 'uploading' })), 'written')
    assert.equal(docs.job_a.stage, 'uploading')
    assert.equal(await mirror.store.mirror('adgen_unknown', () => ({ stage: 'x' })), 'missing')
  })
})

describe('createRenderJobMirror — read', () => {
  test('returns the document with its id', async () => {
    const { db } = fakeDb(seed())
    const mirror = createRenderJobMirror(() => db)

    const job = await mirror.read('job_a')
    assert.equal(job?.id, 'job_a')
    assert.equal(job?.adgenJobId, 'adgen_1')
  })

  test('returns null for a document that is not there', async () => {
    const { db } = fakeDb(seed())
    assert.equal(await createRenderJobMirror(() => db).read('nope'), null)
  })
})

describe('createRenderJobMirror — unsettled', () => {
  test('returns only unsettled jobs this service renders', async () => {
    const { db, log } = fakeDb({
      ...seed(),
      job_c: { engine: 'adgen', adgenJobId: 'adgen_3', status: 'queued' },
    })
    const mirror = createRenderJobMirror(() => db)

    const jobs = await mirror.unsettled()

    assert.deepEqual(jobs.map((j) => j.id).sort(), ['job_a', 'job_c'])
    // Excluded: job_b is done, job_legacy belongs to the previous worker.
    assert.deepEqual(log.queries[0], { field: 'status', op: 'in', value: ['queued', 'rendering'], limit: SWEEP_LIMIT })
  })

  test('is a single-field query — a composite index is never required', async () => {
    const { db, log } = fakeDb(seed())
    await createRenderJobMirror(() => db).unsettled()

    assert.equal(log.queries.length, 1, 'a second filter would need a composite index')
  })

  test('is bounded so one pass cannot run away', async () => {
    const many: Record<string, Row> = {}
    for (let i = 0; i < SWEEP_LIMIT + 25; i++) many[`j${i}`] = { engine: 'adgen', status: 'rendering' }
    const { db } = fakeDb(many)

    assert.equal((await createRenderJobMirror(() => db).unsettled()).length, SWEEP_LIMIT)
  })
})
