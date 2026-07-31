// The Firestore side of the AdGen render mirror.
//
// `renderJobs` is server-write-only (`allow write: if false` in
// firestore.rules), so every update below goes through firebase-admin. The
// read-decide-write runs inside a transaction: the webhook and the poll
// fallback can land at the same moment, and only one of them may win.
//
// The decision itself lives in `adgenWebhook.ts`, which knows nothing about
// Firebase — this file is the adapter that gives it a document.

import * as admin from 'firebase-admin'
import type { MirrorResult, MirrorStore, RenderJobSnapshot } from './adgenWebhook'

const db = () => admin.firestore()

type Decide = (current: RenderJobSnapshot) => Record<string, unknown> | null

async function apply(
  ref: admin.firestore.DocumentReference,
  decide: Decide
): Promise<MirrorResult> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return 'missing' as MirrorResult
    const patch = decide(snap.data() as RenderJobSnapshot)
    if (!patch) return 'noop' as MirrorResult
    tx.update(ref, patch)
    return 'written' as MirrorResult
  })
}

/** Mirror onto the render job carrying this AdGen job id (the webhook path). */
export async function mirrorByAdgenJobId(adgenJobId: string, decide: Decide): Promise<MirrorResult> {
  // Single-field equality — no composite index needed. `adgenJobId` is written
  // once and never changes, so resolving the ref outside the transaction is safe.
  const q = await db().collection('renderJobs').where('adgenJobId', '==', adgenJobId).limit(1).get()
  if (q.empty) return 'missing'
  return apply(q.docs[0].ref, decide)
}

/** Mirror onto a render job by its Firestore id (the poll-fallback path). */
export function mirrorByDocId(docId: string, decide: Decide): Promise<MirrorResult> {
  return apply(db().collection('renderJobs').doc(docId), decide)
}

/** The store the webhook handler writes through. */
export function renderJobMirror(): MirrorStore {
  return { mirror: mirrorByAdgenJobId }
}
