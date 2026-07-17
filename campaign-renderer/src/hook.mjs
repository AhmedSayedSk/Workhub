import fs from 'fs'
import path from 'path'

const BASE = process.env.IMG_GEN_API_BASE
const KEY = process.env.IMG_GEN_API_KEY

const ASPECT_RATIO = { portrait: '9:16', landscape: '16:9', square: '1:1' }

export function aspectToRatio(aspect) {
  return ASPECT_RATIO[aspect] || '1:1'
}

async function pollJob(id, { intervalMs = 5000, timeoutMs = 180000, onTick } = {}) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(`${BASE}/v1/jobs/${id}`, { headers: { 'X-API-Key': KEY } })
    if (!res.ok) throw new Error('job status check failed')
    const data = await res.json()
    if (data.status === 'done') return data
    if (data.status === 'failed' || data.status === 'error') throw new Error('background job failed')
    if (onTick) { try { await onTick() } catch { /* progress is best-effort */ } }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('background job timed out')
}

// Generates the hook's AI background image and downloads it to outPath.
// The headline/logo are overlaid by our templates, so the generated image must
// be PURELY visual — models otherwise paint their own headline onto it. This
// guard is appended to every prompt (defense-in-depth: covers legacy jobs too).
const NO_TEXT_GUARD =
  ' Purely visual imagery with clean empty negative space — absolutely NO text of any kind:' +
  ' no words, letters, numbers, typography, captions, headlines, logos, watermarks, UI or signage anywhere in the image.'

// Returns the local file path, or null on ANY failure — callers fall back
// to a brand-color gradient background in the template. Never throws.
export async function generateHookBg(bgPrompt, aspect, outPath, onTick) {
  if (!BASE || !KEY || !bgPrompt) return null
  try {
    const prompt = /absolutely NO text/i.test(bgPrompt) ? bgPrompt : bgPrompt + NO_TEXT_GUARD
    const genRes = await fetch(`${BASE}/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
      body: JSON.stringify({
        model: 'studio',
        aspectRatio: aspectToRatio(aspect),
        count: 1,
        prompt,
      }),
    })
    if (!genRes.ok) return null
    const { id } = await genRes.json()
    if (!id) return null

    const job = await pollJob(id, { onTick })
    const url = job && job.images && job.images[0] && job.images[0].url
    if (!url) return null

    const imgRes = await fetch(url)
    if (!imgRes.ok) return null
    const buf = Buffer.from(await imgRes.arrayBuffer())

    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, buf)
    return outPath
  } catch {
    // Swallow everything here — never let provider-identifying error
    // details bubble up to the job/worker error surface.
    return null
  }
}
