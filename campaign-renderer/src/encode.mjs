import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const run = promisify(execFile)

// Encodes a contiguous f%05d.jpg frame sequence into an MP4. If `audioPath` is
// given (a real voiceover track whose length matches the video) it is muxed as
// the AAC track; otherwise a silent AAC track is added (required by IG/FB for
// video posts). The frames stay the master timeline via -shortest either way.
export async function encode(framesDir, fps, outMp4, audioPath = null) {
  fs.mkdirSync(path.dirname(outMp4), { recursive: true })
  const hasAudio = audioPath && fs.existsSync(audioPath)
  const args = [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'f%05d.jpg'),
    '-threads', '0',
    ...(hasAudio
      ? ['-i', audioPath]
      : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']),
    '-map', '0:v',
    '-map', '1:a',
    // Platform loudness standard: normalize the real audio mix to -14 LUFS
    // (TP -1.5) so the ad sits at the same level as native FB/IG/TikTok content.
    ...(hasAudio ? ['-af', 'loudnorm=I=-14:TP=-1.5:LRA=11'] : []),
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
  let src = path.join(framesDir, `f${padded}.jpg`)
  if (!fs.existsSync(src)) src = path.join(framesDir, 'f00000.jpg')

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  await run('ffmpeg', ['-y', '-i', src, outPath])
  return outPath
}
