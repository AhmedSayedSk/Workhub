import { claimNext, finishJob, updateProgress } from './job.mjs'
import { renderJob } from './pipeline.mjs'
import { db } from './firebase.mjs'

const WORKER_ID = 'vps2-' + Math.floor(Date.now() / 1000)
const IDLE_MS = 5000
// Renders run CONCURRENTLY (bounded) so one campaign's video never has to wait
// for another campaign's render to finish. Each job still renders its own
// scenes in parallel internally; the OS scheduler shares the cores.
const MAX_ACTIVE = Math.max(1, Number(process.env.MAX_ACTIVE_JOBS) || 2)
console.log('[renderer] up as', WORKER_ID, `(max ${MAX_ACTIVE} concurrent jobs)`)

let active = 0

async function runJob(job) {
  console.log('[renderer] claimed', job.id, `(${active}/${MAX_ACTIVE} active)`)
  // Live cancel flag: the UI sets cancelRequested; the pipeline checks it at
  // every progress checkpoint AND every rendered frame, so it aborts fast.
  let cancelled = false
  const unsub = db.collection('renderJobs').doc(job.id).onSnapshot(
    (s) => { if (s.data()?.cancelRequested) cancelled = true },
    () => { /* listener errors are non-fatal */ }
  )
  try {
    const out = await renderJob(job, (progress, stage) => updateProgress(job.id, progress, stage), () => cancelled)
    await finishJob(job.id, { status: 'done', progress: 100, stage: 'done', videoUrl: out.videoUrl, thumbnailUrl: out.thumbnailUrl })
    console.log('[renderer] done', job.id)
  } catch (e) {
    if (e && e.message === 'CANCELLED') {
      console.log('[renderer] cancelled', job.id)
      await finishJob(job.id, { status: 'cancelled', stage: 'cancelled', error: null }).catch(() => {})
    } else {
      console.error('[renderer] job failed', job.id, e.message)
      await finishJob(job.id, { status: 'failed', error: 'Video render failed. Please retry.' }).catch(() => {})
    }
  } finally {
    try { unsub() } catch { /* noop */ }
  }
}

async function loop() {
  for (;;) {
    if (active < MAX_ACTIVE) {
      let job = null
      try { job = await claimNext(WORKER_ID) } catch (e) { console.error('[renderer] claim error', e.message) }
      if (job) {
        active++
        runJob(job).finally(() => { active-- })
        continue // fill remaining slots immediately
      }
    }
    await new Promise((r) => setTimeout(r, IDLE_MS))
  }
}
loop()
