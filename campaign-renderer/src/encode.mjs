import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const run = promisify(execFile)

// Encodes a contiguous f%05d.png frame sequence into an MP4 with a silent
// AAC audio track (required by IG/FB for video posts).
export async function encode(framesDir, fps, outMp4) {
  fs.mkdirSync(path.dirname(outMp4), { recursive: true })
  const args = [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'f%05d.png'),
    '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=stereo',
    '-shortest',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '20',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outMp4,
  ]
  await run('ffmpeg', args)
  return outMp4
}

// Copies the hook's settled frame (text/logo fully faded in) out as a JPG
// thumbnail. frameIndex defaults to ~1s in, which is well past the hook's
// entrance animation.
export async function thumbFromFrame(framesDir, outPath, frameIndex = 30) {
  const padded = String(Math.max(0, frameIndex)).padStart(5, '0')
  let src = path.join(framesDir, `f${padded}.png`)
  if (!fs.existsSync(src)) src = path.join(framesDir, 'f00000.png')

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  await run('ffmpeg', ['-y', '-i', src, outPath])
  return outPath
}
