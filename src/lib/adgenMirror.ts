// The document side of the AdGen render mirror.
//
// `renderJobs` is server-write-only (`allow write: if false` in
// firestore.rules), so every update here runs through firebase-admin — but this
// module never imports it. The store is built over a minimal structural view of
// Firestore (`MirrorDb`), which the real client satisfies as-is and a test
// double can implement in a few lines. The wiring lives in
// `lib/server/renderJobMirror.ts`.
//
// The read-decide-write runs inside a transaction: the webhook, the status poll
// and the sweep can all land at the same moment, and only one may win. The
// decision itself lives in `renderMirror.ts`, which knows nothing about
// Firebase — this file only hands it a document.

import type { MirrorResult, MirrorStore, RenderJobSnapshot } from './renderMirror'

/** Marks a job rendered by the campaign service. The legacy worker skips these. */
export const RENDER_ENGINE = 'adgen'

const COLLECTION = 'renderJobs'

/** How many unsettled jobs one sweep pass looks at. */
export const SWEEP_LIMIT = 50

// ── The slice of Firestore this module uses ─────────────────────────────────

export interface MirrorSnapshot {
  exists: boolean
  id: string
  data(): Record<string, unknown> | undefined
}

export interface MirrorDocRef {
  readonly id: string
  get(): Promise<MirrorSnapshot>
}

export interface MirrorTransaction {
  get(ref: MirrorDocRef): Promise<MirrorSnapshot>
  update(ref: MirrorDocRef, patch: Record<string, unknown>): unknown
}

export interface MirrorQuerySnapshot {
  empty: boolean
  docs: Array<MirrorSnapshot & { ref: MirrorDocRef }>
}

export interface MirrorQuery {
  where(field: string, op: string, value: unknown): MirrorQuery
  limit(n: number): MirrorQuery
  get(): Promise<MirrorQuerySnapshot>
}

export interface MirrorCollection extends MirrorQuery {
  doc(id: string): MirrorDocRef
}

export interface MirrorDb {
  collection(path: string): MirrorCollection
  runTransaction<T>(fn: (tx: MirrorTransaction) => Promise<T>): Promise<T>
}

export type Decide = (current: RenderJobSnapshot) => Record<string, unknown> | null

/** A job document as the settle logic and the sweep see it. */
export interface RenderJobDoc extends RenderJobSnapshot {
  id: string
  adgenJobId?: string
  engine?: string
  createdAt?: number
}

export interface RenderJobMirror {
  /** Mirror onto a render job by its Firestore id (poll and sweep paths). */
  byDocId(docId: string, decide: Decide): Promise<MirrorResult>
  /** Mirror onto the render job carrying this service job id (webhook path). */
  byAdgenJobId(adgenJobId: string, decide: Decide): Promise<MirrorResult>
  /** Read one job document. */
  read(docId: string): Promise<RenderJobDoc | null>
  /** Service-rendered jobs that have not reached a terminal state. */
  unsettled(): Promise<RenderJobDoc[]>
  /** The `MirrorStore` the webhook handler writes through. */
  store: MirrorStore
}

export function createRenderJobMirror(getDb: () => MirrorDb): RenderJobMirror {
  const col = (): MirrorCollection => getDb().collection(COLLECTION)

  async function apply(ref: MirrorDocRef, decide: Decide): Promise<MirrorResult> {
    return getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return 'missing' as MirrorResult
      const patch = decide((snap.data() || {}) as RenderJobSnapshot)
      if (!patch) return 'noop' as MirrorResult
      tx.update(ref, patch)
      return 'written' as MirrorResult
    })
  }

  function byDocId(docId: string, decide: Decide): Promise<MirrorResult> {
    return apply(col().doc(docId), decide)
  }

  async function byAdgenJobId(adgenJobId: string, decide: Decide): Promise<MirrorResult> {
    // Single-field equality — no composite index needed. `adgenJobId` is
    // written once and never changes, so resolving the ref outside the
    // transaction is safe.
    const q = await col().where('adgenJobId', '==', adgenJobId).limit(1).get()
    if (q.empty || !q.docs.length) return 'missing'
    return apply(q.docs[0].ref, decide)
  }

  return {
    byDocId,
    byAdgenJobId,

    async read(docId) {
      const snap = await col().doc(docId).get()
      if (!snap.exists) return null
      return { ...(snap.data() || {}), id: snap.id } as RenderJobDoc
    },

    async unsettled() {
      // One filter only: `status in [...]` plus `engine ==` would need a
      // composite index, so `engine` is filtered here (the same trade the rest
      // of the app makes — see lib/firestore.ts).
      const q = await col().where('status', 'in', ['queued', 'rendering']).limit(SWEEP_LIMIT).get()
      return q.docs
        .map((d) => ({ ...(d.data() || {}), id: d.id }) as RenderJobDoc)
        .filter((j) => j.engine === RENDER_ENGINE)
    },

    store: { mirror: byAdgenJobId },
  }
}
