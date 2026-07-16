import { claimNext, finishJob, updateProgress } from './job.mjs'
import { renderJob } from './pipeline.mjs'

const WORKER_ID = 'vps2-' + Math.floor(Date.now() / 1000)
const IDLE_MS = 5000
console.log('[renderer] up as', WORKER_ID)

async function tick() {
  let job = null
  try { job = await claimNext(WORKER_ID) } catch (e) { console.error('[renderer] claim error', e.message) }
  if (!job) return
  console.log('[renderer] claimed', job.id)
  try {
    const out = await renderJob(job, (progress, stage) => updateProgress(job.id, progress, stage))
    await finishJob(job.id, { status: 'done', progress: 100, stage: 'done', videoUrl: out.videoUrl, thumbnailUrl: out.thumbnailUrl })
    console.log('[renderer] done', job.id)
  } catch (e) {
    console.error('[renderer] job failed', job.id, e.message)
    await finishJob(job.id, { status: 'failed', error: 'Video render failed. Please retry.' }).catch(() => {})
  }
}
async function loop() { for (;;) { await tick(); await new Promise((r) => setTimeout(r, IDLE_MS)) } }
loop()
