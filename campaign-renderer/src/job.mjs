import { db } from './firebase.mjs'
const STALE_MS = 10 * 60 * 1000

export async function claimNext(workerId) {
  const snap = await db.collection('renderJobs').where('status', 'in', ['queued', 'rendering']).get()
  const now = Date.now()
  const candidates = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((j) => j.status === 'queued' || (j.status === 'rendering' && now - (j.startedAt || 0) > STALE_MS))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  for (const c of candidates) {
    const ref = db.collection('renderJobs').doc(c.id)
    try {
      const claimed = await db.runTransaction(async (tx) => {
        const d = await tx.get(ref)
        const j = d.data()
        if (!j) return null
        const stale = j.status === 'rendering' && now - (j.startedAt || 0) > STALE_MS
        if (j.status !== 'queued' && !stale) return null
        tx.update(ref, { status: 'rendering', workerId, startedAt: now })
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
