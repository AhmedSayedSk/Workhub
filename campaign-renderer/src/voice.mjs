import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const run = promisify(execFile)

const BASE = process.env.TTS_API_BASE
const KEY = process.env.TTS_API_KEY

// Scene-timing knobs: a narrated scene lasts its speech + a little breathing
// room, clamped so no scene is jarringly short or drags on.
export const VOICE_PAD_MS = 650
export const VOICE_MIN_MS = 2200
export const VOICE_MAX_MS = 9000

// A narrated scene lasts speech + breathing room, clamped to [MIN, MAX] — but
// NEVER shorter than the speech itself (+ a small tail), otherwise the built
// audio track would truncate the line and drift out of sync with the frames.
export function clampSceneMs(audioMs, baseMs) {
  if (!audioMs) return baseMs
  const ms = Math.round(audioMs)
  const want = Math.min(VOICE_MAX_MS, Math.max(VOICE_MIN_MS, ms + VOICE_PAD_MS))
  return Math.max(want, ms + 200)
}

async function pollJob(id, { intervalMs = 1200, timeoutMs = 120000 } = {}) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(`${BASE}/v1/jobs/${id}`, { headers: { 'X-API-Key': KEY } })
    if (!res.ok) throw new Error('voice job status failed')
    const data = await res.json()
    if (data.status === 'done') return data
    if (data.status === 'failed' || data.status === 'error') throw new Error('voice job failed')
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('voice job timed out')
}

// Synthesizes one narration line to a WAV at outPath. Returns
// { path, durationSec } or null on ANY failure (missing config, empty text,
// network/provider error) — callers treat null as "this scene has no narration"
// and fall back to silence, so a voiceover hiccup never fails the render.
export async function synthLine(text, { language = 'en', gender = 'female', voice, model, rate, style } = {}, outPath) {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (!BASE || !KEY || !clean) return null
  try {
    const speed = Number(rate)
    const genRes = await fetch(`${BASE}/v1/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
      // No `style` sent → the service applies its ad-friendly default delivery.
      // A named `voice` (aria/nova/sami/omar) overrides the gender default.
      body: JSON.stringify({
        text: clean.slice(0, 800), language, gender, format: 'wav',
        ...(voice ? { voice } : {}),
        ...(model ? { model } : {}),
        ...(style ? { style: String(style).slice(0, 480) } : {}),
        ...(Number.isFinite(speed) && speed > 0 && speed !== 1 ? { rate: speed } : {}),
      }),
    })
    if (!genRes.ok) return null
    const { id } = await genRes.json()
    if (!id) return null

    const job = await pollJob(id)
    const url = job && job.audio && job.audio.url
    if (!url) return null

    const audioRes = await fetch(url)
    if (!audioRes.ok) return null
    const buf = Buffer.from(await audioRes.arrayBuffer())
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, buf)

    const durationSec = typeof job.audio.durationSec === 'number' && job.audio.durationSec > 0
      ? job.audio.durationSec
      : Math.max(1, buf.length / (24000 * 2)) // wav 24kHz mono 16-bit fallback
    return { path: outPath, durationSec }
  } catch {
    return null
  }
}

// Synthesizes many narration lines concurrently (bounded). `items` is a list of
// { text } (in play order). Returns a same-length array of { audioPath, durationSec }
// | null, aligned to the input order. Never throws.
export async function synthLines(items, voice, scratchDir, concurrency = 3, onEach) {
  const out = new Array(items.length).fill(null)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      const text = items[i] && items[i].text
      if (text) {
        const p = path.join(scratchDir, `voice-${String(i).padStart(3, '0')}.wav`)
        // Per-line override (mixed-voice casting): gender + matching named voice.
        const lineVoice = (items[i].gender || items[i].voice)
          ? { ...voice, ...(items[i].gender ? { gender: items[i].gender } : {}), ...(items[i].voice ? { voice: items[i].voice } : {}) }
          : voice
        const r = await synthLine(text, lineVoice, p)
        if (r) out[i] = { audioPath: r.path, durationSec: r.durationSec }
      }
      done++
      if (onEach) { try { await onEach(done, items.length) } catch { /* progress is best-effort */ } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

// Builds a single voiceover WAV whose length equals the video: for each scene,
// a segment whose length is that scene's exact FRAME span (frames/fps) — the
// line's audio (if any) followed by silence to fill, or pure silence when the
// scene has no narration. Concatenated in order. Returns the track path, or null
// if there's no audio at all (all-silent) OR on any failure — callers fall back
// to a silent track, so a voiceover glitch never fails the render.
export async function buildVoiceTrack(segments, scratchDir, fps = 30) {
  if (!segments.some((s) => s && s.audioPath)) return null
  try {
    const segDir = path.join(scratchDir, 'voseg')
    fs.mkdirSync(segDir, { recursive: true })
    const segPaths = []
    for (let i = 0; i < segments.length; i++) {
      const { audioPath, durMs } = segments[i]
      // Match the video's exact frame span for this scene so the audio total
      // equals the video total (no drift, no -shortest clipping).
      const frames = Math.max(1, Math.round((durMs / 1000) * fps))
      const durSec = (frames / fps).toFixed(3)
      const segPath = path.join(segDir, `s${String(i).padStart(3, '0')}.wav`)
      if (audioPath && fs.existsSync(audioPath)) {
        // Real line: normalize to 24kHz mono, pad with trailing silence, cap at durSec.
        await run('ffmpeg', ['-y', '-i', audioPath, '-af', 'apad', '-t', durSec, '-ar', '24000', '-ac', '1', segPath])
      } else {
        // Silent scene.
        await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', durSec, '-ar', '24000', '-ac', '1', segPath])
      }
      segPaths.push(segPath)
    }
    const listFile = path.join(segDir, 'list.txt')
    fs.writeFileSync(listFile, segPaths.map((p) => `file '${p}'`).join('\n'))
    const trackPath = path.join(scratchDir, 'voiceover.wav')
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', trackPath])
    return trackPath
  } catch {
    return null
  }
}

// Narration text for a creative script scene.
export function creativeSceneNarration(scene) {
  if (!scene) return ''
  switch (scene.type) {
    case 'hook': return String(scene.headline || '').replace(/\n/g, ' ')
    case 'beat': return [scene.title, scene.sub].filter(Boolean).join('. ')
    case 'stat': return [scene.value, scene.label].filter(Boolean).join(' ')
    case 'showcase': return [scene.caption, scene.sub].filter(Boolean).join('. ')
    case 'cta': return String(scene.text || '')
    default: return ''
  }
}
