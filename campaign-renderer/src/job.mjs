import { db } from './firebase.mjs'
const STALE_MS = 10 * 60 * 1000

// Jobs marked with an `engine` are rendered elsewhere and mirrored back into
// this collection. This worker must never claim one: it would double-render the
// campaign and its progress writes would fight the mirror's.
const isOurs = (j) => !j.engine

export async function claimNext(workerId) {
  const snap = await db.collection('renderJobs').where('status', 'in', ['queued', 'rendering']).get()
  const now = Date.now()
  const candidates = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((j) => isOurs(j) && (j.status === 'queued' || (j.status === 'rendering' && now - (j.startedAt || 0) > STALE_MS)))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  for (const c of candidates) {
    const ref = db.collection('renderJobs').doc(c.id)
    try {
      const claimed = await db.runTransaction(async (tx) => {
        const d = await tx.get(ref)
        const j = d.data()
        if (!j || !isOurs(j)) return null
        const stale = j.status === 'rendering' && now - (j.startedAt || 0) > STALE_MS
        if (j.status !== 'queued' && !stale) return null
        tx.update(ref, { status: 'rendering', workerId, startedAt: now, progress: 0, stage: 'preparing', error: null })
        return { id: d.id, ...j }
      })
      if (claimed) return claimed
    } catch { /* contended, try next */ }
  }
  return null
}

export async function finishJob(id, patch) {
  await db.collection('renderJobs').doc(id).update({ ...patch, finishedAt: Date.now() })
}

export async function updateProgress(id, progress, stage) {
  await db.collection('renderJobs').doc(id).update({ progress: Math.round(progress), stage }).catch(() => {})
}
