import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const run = promisify(execFile)

// Stock-footage hook backgrounds via the Pexels Videos API (free license, no
// attribution required). The search query comes from the campaign topic; the
// orientation matches the render aspect so the crop stays minimal.
const KEY = process.env.PEXELS_API_KEY

const ORIENT = { portrait: 'portrait', landscape: 'landscape', square: 'square' }

// Searches Pexels and downloads the best-fitting clip to outPath.
// Returns outPath, or null on ANY failure — callers fall back to the AI image
// hook, so stock footage never breaks a render.
export async function fetchHookVideo(query, aspect, outPath, { minDurationSec = 3, pick = 0 } = {}) {
  if (!KEY || !query) return null
  try {
    const orientation = ORIENT[aspect] || 'portrait'
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&size=medium&per_page=8`,
      { headers: { Authorization: KEY }, signal: ctrl.signal }
    )
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    const wantH = aspect === 'landscape' ? 1080 : 1920
    const wantW = aspect === 'landscape' ? 1920 : aspect === 'square' ? 1080 : 1080

    // Nth suitable clip (pick lets different scenes use different footage),
    // with the smallest file that still covers our target.
    let suitableSeen = 0
    for (const v of data.videos || []) {
      if ((v.duration || 0) < minDurationSec) continue
      const files = (v.video_files || [])
        .filter((f) => f.file_type === 'video/mp4' && (f.height || 0) >= wantH * 0.9 && (f.width || 0) >= wantW * 0.9)
        .sort((a, b) => (a.height || 0) * (a.width || 0) - (b.height || 0) * (b.width || 0))
      const file = files[0]
      if (!file) continue
      if (suitableSeen++ < pick) continue
      const dl = await fetch(file.link)
      if (!dl.ok) continue
      const buf = Buffer.from(await dl.arrayBuffer())
      if (buf.length < 50_000) continue // sanity: not an error page
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, buf)
      return outPath
    }
    return null
  } catch {
    return null
  }
}

// Composites the hook's transparent overlay frames (PNG, from the template)
// onto the stock clip: cover-crop to the render size, 30fps, looped if the
// clip is shorter than the hook. Writes final JPEG frames straight into the
// master frames dir at the hook's frame range.
export async function composeVideoHook(clipPath, overlayDir, framesDir, { frames, fps, w, h, startIndex = 0 }) {
  const durSec = (frames / fps).toFixed(3)
  await run('ffmpeg', [
    '-y',
    '-stream_loop', '-1', '-t', durSec, '-i', clipPath,
    '-framerate', String(fps), '-i', path.join(overlayDir, 'f%05d.png'),
    '-filter_complex',
    `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${fps}[bg];` +
    `[bg][1:v]overlay=0:0`,
    '-frames:v', String(frames),
    '-q:v', '3',
    '-start_number', String(startIndex),
    path.join(framesDir, 'f%05d.jpg'),
  ])
}
