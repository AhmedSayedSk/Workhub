import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { renderScene } from './render.mjs'
import { renderScenes } from './scenes.mjs'
import { generateHookBg } from './hook.mjs'
import { encode, thumbFromFrame } from './encode.mjs'
import { upload } from './upload.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOOK_TEMPLATE = path.join(__dirname, '..', 'templates', 'hook.html')

const DIMS = {
  portrait: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
  square: { w: 1080, h: 1080 },
}
const FPS = 30
const HOOK_DUR_MS = 3000

// Renders a full campaign post video: hook opener + post scenes, encodes to
// MP4 (+ silent AAC), uploads the MP4 + a thumbnail to Firebase Storage.
// Returns { videoUrl, thumbnailUrl }.
export async function renderJob(job) {
  const dims = DIMS[job.aspect] || DIMS.portrait
  const scratch = path.join('/tmp/render', String(job.id))
  const framesDir = path.join(scratch, 'frames')

  fs.rmSync(scratch, { recursive: true, force: true })
  fs.mkdirSync(framesDir, { recursive: true })

  try {
    const brand = job.brand || {}
    const hook = job.hook || {}
    const color = brand.color || '#34e5a4'

    // Best-effort AI background; null falls back to a brand-color gradient
    // in templates/hook.html, so the job still succeeds either way.
    const bgPath = await generateHookBg(hook.bgPrompt, job.aspect, path.join(scratch, 'hook-bg.jpg'))

    const hookData = {
      bg: bgPath ? pathToFileURL(bgPath).href : null,
      headline: hook.headline || brand.name || '',
      subtext: hook.subtext || '',
      logo: brand.logoUrl || null,
      color,
    }

    const hookFrames = await renderScene(HOOK_TEMPLATE, hookData, {
      w: dims.w,
      h: dims.h,
      durMs: HOOK_DUR_MS,
      fps: FPS,
      outDir: framesDir,
      startIndex: 0,
    })
    // A frame ~1s in, once the hook's entrance animation has settled.
    const thumbFrameIndex = Math.min(FPS, Math.max(0, hookFrames - 1))

    await renderScenes(job.scenes || [], {
      w: dims.w,
      h: dims.h,
      outDir: framesDir,
      startIndex: hookFrames,
      color,
      fps: FPS,
    })

    const outMp4 = path.join(scratch, `${job.id}.mp4`)
    const outThumb = path.join(scratch, `${job.id}.jpg`)
    await encode(framesDir, FPS, outMp4)
    await thumbFromFrame(framesDir, outThumb, thumbFrameIndex)

    const folder = job.campaignId || job.id
    const videoUrl = await upload(outMp4, `campaigns/${folder}/${job.id}.mp4`, 'video/mp4')
    const thumbnailUrl = await upload(outThumb, `campaigns/${folder}/${job.id}.jpg`, 'image/jpeg')

    return { videoUrl, thumbnailUrl }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
}
