import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

const run = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CACHE_DIR = process.env.SFX_CACHE_DIR || '/tmp/sfx-cache'

// Per-event mix level (dB) relative to the -6dBFS-normalized files — sits the
// effects clearly UNDER the narration (voice peaks ~-2dB).
const EVENT_GAIN = {
  intro: -11, transition: -10, pop: -12, underline: -14, showcase: -11,
  stat_tick: -18, stat_settle: -11, cta_shine: -12, cta_sting: -9, impact: -10,
}

let manifest = null
function loadManifest() {
  if (manifest) return manifest
  for (const p of [path.join(__dirname, '..', 'assets', 'sfx-manifest.json'), '/app/assets/sfx-manifest.json']) {
    try { manifest = JSON.parse(fs.readFileSync(p, 'utf8')); return manifest } catch { /* try next */ }
  }
  return null
}

// Deterministic per-job variant picking: same job -> same sounds (re-renders
// reproducible), different jobs -> different variants (videos vary).
function seededPick(list, seedStr, salt = 0) {
  if (!list || !list.length) return null
  let h = 2166136261 ^ salt
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619) }
  return list[Math.abs(h) % list.length]
}

async function ensureCached(sound) {
  const f = path.join(CACHE_DIR, `${sound.id}.wav`)
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) return f
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const res = await fetch(sound.url)
  if (!res.ok) throw new Error(`sfx fetch ${sound.id}: ${res.status}`)
  fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()))
  return f
}

// Template animation moments (ms into a scene) — mirror the reg() windows in
// templates/creative/*.html so sounds land exactly on the motion.
const SCENE_EVENTS = {
  hook: [
    { event: 'pop', at: 80 },        // kicker popback
    { event: 'underline', at: 1150 }, // underline draw start
  ],
  beat: [],                           // beats stay clean under narration
  stat: [
    { event: 'stat_tick', at: 150 }, { event: 'stat_tick', at: 360 }, { event: 'stat_tick', at: 570 },
    { event: 'stat_tick', at: 780 }, { event: 'stat_tick', at: 990 },
    { event: 'stat_settle', at: 1150 }, // count-up lands
  ],
  showcase: [
    { event: 'showcase', at: 60 },    // card clip-reveal
  ],
  cta: [
    { event: 'pop', at: 100 },        // brand mark pop
    { event: 'cta_sting', at: 480 },  // pill pop = the CTA moment
    { event: 'cta_shine', at: 1150 }, // shine sweep
  ],
  basicScene: [{ event: 'showcase', at: 60 }],
  basicHook: [{ event: 'pop', at: 150 }],
}

// Builds the schedule from the pipeline's scene timeline.
// scenes: [{ type, startMs, durMs }] in play order. Returns [{event, atMs}].
export function scheduleSfx(scenes) {
  const out = []
  scenes.forEach((s, i) => {
    if (i === 0) out.push({ event: 'intro', atMs: 0 })
    // transition whoosh leads the cut slightly so its swell peaks ON the cut
    if (i > 0) out.push({ event: 'transition', atMs: Math.max(0, s.startMs - 140) })
    for (const ev of SCENE_EVENTS[s.type] || []) {
      // skip moments that would land inside the scene's exit fade
      if (ev.at < s.durMs - 350) out.push({ event: ev.event, atMs: s.startMs + ev.at })
    }
  })
  return out
}

// Builds one SFX wav (44.1k stereo) of exactly totalMs, all events placed via
// adelay + per-event gain, mixed in a single ffmpeg pass. Returns the path or
// null on ANY failure — a missing/broken sound never fails the render.
export async function buildSfxTrack(schedule, totalMs, scratch, jobId) {
  try {
    const m = loadManifest()
    if (!m || !schedule.length) return null
    // one variant per event type per job (consistent within a video)
    const variant = {}
    for (const ev of Object.keys(m.events)) {
      const s = seededPick(m.events[ev], String(jobId || 'job'), ev.length)
      if (s) variant[ev] = m.sounds.find((x) => x.id === s)
    }
    // cache all needed files
    const files = {}
    for (const ev of new Set(schedule.map((e) => e.event))) {
      const snd = variant[ev]
      if (!snd) continue
      try { files[ev] = await ensureCached(snd) } catch { /* skip this event type */ }
    }
    const events = schedule.filter((e) => files[e.event])
    if (!events.length) return null

    // single ffmpeg: N inputs -> adelay+volume each -> amix -> pad/trim to length
    const args = ['-y']
    events.forEach((e) => { args.push('-i', files[e.event]) })
    const chains = events.map((e, i) => {
      const d = Math.max(0, Math.round(e.atMs))
      const g = EVENT_GAIN[e.event] ?? -12
      return `[${i}:a]adelay=${d}|${d},volume=${g}dB[s${i}]`
    })
    const mixIn = events.map((_, i) => `[s${i}]`).join('')
    const filter = `${chains.join(';')};${mixIn}amix=inputs=${events.length}:normalize=0,apad,atrim=0:${(totalMs / 1000).toFixed(3)}[out]`
    const outPath = path.join(scratch, 'sfx.wav')
    await run('ffmpeg', [...args, '-filter_complex', filter, '-map', '[out]', '-ar', '44100', '-ac', '2', outPath])
    return outPath
  } catch {
    return null
  }
}

// Pre-mixes narration + SFX into one track (voice on top, SFX under). Either
// input may be null; returns whichever single track exists, the mixed path,
// or null. Never throws.
export async function mixTracks(voicePath, sfxPath, scratch) {
  try {
    if (!voicePath && !sfxPath) return null
    if (!sfxPath) return voicePath
    if (!voicePath) return sfxPath
    const outPath = path.join(scratch, 'audio-mix.wav')
    await run('ffmpeg', [
      '-y', '-i', voicePath, '-i', sfxPath,
      '-filter_complex', '[0:a]aresample=44100,pan=stereo|c0=c0|c1=c0[v];[v][1:a]amix=inputs=2:duration=first:normalize=0[out]',
      '-map', '[out]', '-ar', '44100', outPath,
    ])
    return outPath
  } catch {
    return voicePath || sfxPath
  }
}
