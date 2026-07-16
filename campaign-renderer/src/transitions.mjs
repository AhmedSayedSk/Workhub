import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const run = promisify(execFile)

const frameName = (i) => `f${String(i).padStart(5, '0')}.jpg`

// Cross-dissolves each scene boundary IN PLACE on the rendered frame sequence:
// the previous scene's final frame melts into the next scene's entrance over
// `frames` frames. The timeline length never changes, so the voiceover track
// stays perfectly aligned. Never throws — a failed blend just leaves the
// original (hard-cut) frames.
export async function applyDissolves(framesDir, boundaries, totalFrames, { frames = 10, concurrency = 4 } = {}) {
  const jobs = []
  for (const b of boundaries) {
    if (b <= 0 || b >= totalFrames) continue
    const fromFrame = path.join(framesDir, frameName(b - 1)) // prev scene's last frame
    for (let j = 0; j < frames; j++) {
      const idx = b + j
      if (idx >= totalFrames) break
      const alpha = 1 - (j + 1) / (frames + 1) // weight of the frozen previous frame
      jobs.push({ fromFrame, target: path.join(framesDir, frameName(idx)), alpha })
    }
  }
  if (!jobs.length) return

  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const { fromFrame, target, alpha } = jobs[next++]
      const tmp = `${target}.blend.jpg`
      try {
        await run('ffmpeg', [
          '-y', '-i', fromFrame, '-i', target,
          '-filter_complex', `[0:v][1:v]blend=all_expr='A*${alpha.toFixed(4)}+B*${(1 - alpha).toFixed(4)}'`,
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
