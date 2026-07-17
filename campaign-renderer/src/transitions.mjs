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
