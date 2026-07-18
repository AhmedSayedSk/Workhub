import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const run = promisify(execFile)

const frameName = (i) => `f${String(i).padStart(5, '0')}.jpg`

// Premium ZOOM-dissolve at each scene boundary, IN PLACE on the rendered frame
// sequence: the previous scene's final frame both scales up (pushing toward the
// viewer) and melts into the next scene's entrance over `frames` frames. The
// timeline length never changes, so the voiceover track stays perfectly
// aligned. Never throws — a failed blend just leaves the original frames.
export async function applyDissolves(framesDir, boundaries, totalFrames, { frames = 14, concurrency = 4 } = {}) {
  const jobs = []
  for (const b of boundaries) {
    if (b <= 0 || b >= totalFrames) continue
    const fromFrame = path.join(framesDir, frameName(b - 1)) // prev scene's last frame
    for (let j = 0; j < frames; j++) {
      const idx = b + j
      if (idx >= totalFrames) break
      const p = (j + 1) / (frames + 1)
      const alpha = 1 - p // weight of the frozen previous frame
      const zoom = 1 + 0.14 * p // outgoing frame pushes toward the viewer as it melts
      jobs.push({ fromFrame, target: path.join(framesDir, frameName(idx)), alpha, zoom })
    }
  }
  if (!jobs.length) return

  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const { fromFrame, target, alpha, zoom } = jobs[next++]
      const tmp = `${target}.blend.jpg`
      try {
        const z = zoom.toFixed(4)
        await run('ffmpeg', [
          '-y', '-i', fromFrame, '-i', target,
          '-filter_complex',
          `[0:v]crop=iw/${z}:ih/${z},scale=iw*${z}:ih*${z}:flags=bicubic[zoomed];` +
          `[zoomed][1:v]blend=all_expr='A*${alpha.toFixed(4)}+B*${(1 - alpha).toFixed(4)}'`,
          '-q:v', '3', tmp,
        ])
        fs.renameSync(tmp, target)
      } catch {
        fs.rmSync(tmp, { force: true }) // keep the original frame — hard cut here only
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))
}

// Premium ANIMATED transitions via ffmpeg's xfade engine, applied IN PLACE at
// each scene boundary (same frame count — voiceover stays aligned). The frozen
// previous frame transitions into the next scene's real frames using a
// per-boundary variant from the chosen pool, so consecutive cuts differ.
// Never throws — a failed boundary keeps its original (hard-cut) frames.
export const XFADE_POOLS = {
  cinematic: ['circleopen', 'radial', 'smoothup', 'diagtl', 'wipetl'],
  push: ['slideup', 'slideleft', 'slideright', 'smoothleft'],
}

export async function applyXfades(framesDir, boundaries, totalFrames, { frames = 14, fps = 30, pool = 'cinematic' } = {}) {
  const variants = XFADE_POOLS[pool] || XFADE_POOLS.cinematic
  for (let bi = 0; bi < boundaries.length; bi++) {
    const b = boundaries[bi]
    if (b <= 0 || b >= totalFrames) continue
    const count = Math.min(frames, totalFrames - b)
    if (count < 4) continue
    const dur = (count / fps).toFixed(4)
    const prev = path.join(framesDir, frameName(b - 1))
    const tmpDir = path.join(framesDir, `.xf${b}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    const variant = variants[bi % variants.length]
    try {
      await run('ffmpeg', [
        '-y',
        '-loop', '1', '-framerate', String(fps), '-t', dur, '-i', prev,
        '-framerate', String(fps), '-start_number', String(b), '-i', path.join(framesDir, 'f%05d.jpg'),
        '-filter_complex', `[0:v][1:v]xfade=transition=${variant}:duration=${dur}:offset=0`,
        '-frames:v', String(count), '-q:v', '3',
        '-start_number', '0', path.join(tmpDir, 'x%05d.jpg'),
      ])
      for (let j = 0; j < count; j++) {
        const src = path.join(tmpDir, `x${String(j).padStart(5, '0')}.jpg`)
        if (fs.existsSync(src)) fs.renameSync(src, path.join(framesDir, frameName(b + j)))
      }
    } catch { /* keep original frames at this boundary */ }
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
