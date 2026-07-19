import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { renderScene } from './render.mjs'
import { SCENE_DUR_MS } from './scenes.mjs'
import { generateHookBg } from './hook.mjs'
import { encode, thumbFromFrame } from './encode.mjs'
import { upload } from './upload.mjs'
import { synthLines, buildVoiceTrack, clampSceneMs, creativeSceneNarration } from './voice.mjs'
import { applyDissolves, applyXfades, applyLoopTail } from './transitions.mjs'
import { scheduleSfx, buildSfxTrack, mixTracks } from './sfx.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOOK_TEMPLATE = path.join(__dirname, '..', 'templates', 'hook.html')
const SCENE_TEMPLATE = path.join(__dirname, '..', 'templates', 'scene.html')

const DIMS = {
  portrait: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
  square: { w: 1080, h: 1080 },
}
const FPS = 30
const HOOK_DUR_MS = 3000
const CREATIVE_DIR = path.join(__dirname, '..', 'templates', 'creative')
const SCENE_DUR = { hook: 3200, beat: 2800, stat: 2600, showcase: 3200, cta: 3000 }
// Use every vCPU: the hook + each post scene render in parallel, each writing
// its own pre-assigned frame range (order preserved). Override with RENDER_CONCURRENCY.
const CONCURRENCY = Math.max(1, Number(process.env.RENDER_CONCURRENCY) || os.cpus().length)

const framesFor = (durMs) => Math.max(1, Math.round((durMs / 1000) * FPS))

// Content-aware showcase variant picker: each image scene gets a composition
// that FITS its copy — short punchlines go big-type, number-led copy gets the
// split panel with a stat chip, longer copy keeps the roomy card — with a
// job-seeded rotation that never repeats the previous scene's layout.
// a = full-height card + overlay · b = split panel + stat chip
// c = magazine collage · d = kinetic full-bleed type
function pickShowcaseVariant(scene, idx, seedStr, prev, allowed) {
  const cap = (scene.caption || '').trim()
  const body = `${cap} ${scene.sub || ''}`
  const hasNum = /[\d٠-٩]/.test(body)
  let pool
  if (cap && cap.length <= 30 && !scene.sub) pool = ['d', 'e', 'g', 'c']
  else if (hasNum) pool = ['b', 'g', 'c', 'a']
  else if (scene.sub && cap.length > 45) pool = ['a', 'f', 'b', 'e']
  else pool = ['b', 'c', 'd', 'f', 'e', 'g', 'a']
  // Respect the workspace's enabled styles (from the Scene Styles table).
  if (Array.isArray(allowed) && allowed.length) {
    const filtered = pool.filter((v) => allowed.includes(v))
    pool = filtered.length ? filtered : allowed
  }
  let h = 2166136261
  const str = `${seedStr}#${idx}`
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  for (let k = 0; k < pool.length; k++) {
    const v = pool[(Math.abs(h) + k) % pool.length]
    if (v !== prev) return v
  }
  return pool[0]
}

const showcaseTemplate = (v) => (v === 'a' ? 'showcase.html' : `showcase-${v}.html`)

// Word-level karaoke timing for a narrated line: the measured audio duration
// split across words proportionally to their length (+lead). No forced
// alignment needed — proportional timing reads naturally at caption speed.
function captionWords(text, durationSec) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length || !durationSec) return null
  const total = durationSec * 1000
  const lead = Math.min(120, total * 0.05)
  const speakable = total - lead - 150 // small tail so the last word doesn't cling to the cut
  const weights = words.map((w) => w.length + 1.5)
  const wsum = weights.reduce((a, b) => a + b, 0)
  let t = lead
  return words.map((w, i) => {
    const d = Math.max(120, (weights[i] / wsum) * speakable)
    const seg = { w, s: Math.round(t), e: Math.round(t + d) }
    t += d
    return seg
  })
}

// Mixed casting → named voice per gender (white-labeled ids).
const MIXED_VOICE = { female: 'nova', male: 'omar' }

// Mixed-voice casting: assigns a narrator per scene by its role — warm female
// opens (hook) and closes (cta), scenes alternate for contrast, stats get the
// authoritative male read. Deterministic.
function castVoices(types, base) {
  let toggle = 'male' // first scene after the female hook contrasts
  return types.map((ty) => {
    if (ty === 'hook' || ty === 'basicHook' || ty === 'cta') return 'female'
    if (ty === 'stat') return 'male'
    const g = toggle
    toggle = toggle === 'male' ? 'female' : 'male'
    return g
  })
}

// Runs task thunks with at most `limit` in flight; calls onEach(done,total) as
// each finishes (for progress). Rejects if any task throws.
async function runPool(tasks, limit, onEach) {
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++
      await tasks[i]()
      done++
      if (onEach) await onEach(done, tasks.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
}

// Renders a full campaign post video: hook opener + post scenes, encodes to
// MP4 (+ silent AAC), uploads the MP4 + a thumbnail to Firebase Storage.
// Returns { videoUrl, thumbnailUrl }.
export async function renderJob(job, onProgress = () => {}, shouldCancel = null) {
  const dims = DIMS[job.aspect] || DIMS.portrait
  const scratch = path.join('/tmp/render', String(job.id))
  const framesDir = path.join(scratch, 'frames')
  const report = async (progress, stage) => {
    if (shouldCancel && shouldCancel()) throw new Error('CANCELLED')
    try { await onProgress(progress, stage) } catch { /* best-effort */ }
  }

  fs.rmSync(scratch, { recursive: true, force: true })
  fs.mkdirSync(framesDir, { recursive: true })

  try {
    const brand = job.brand || {}
    const hook = job.hook || {}
    const color = brand.color || '#34e5a4'

    await report(3, 'preparing')
    // Best-effort AI background; null falls back to a brand-color gradient
    // in templates/hook.html, so the job still succeeds either way. Ticks the
    // progress up while waiting on the (slow) AI generation so it feels live.
    let bgPct = 5
    const bgPath = await generateHookBg(hook.bgPrompt, job.aspect, path.join(scratch, 'hook-bg.jpg'), async () => {
      bgPct = Math.min(38, bgPct + 5)
      await report(bgPct, 'hook')
    })
    await report(40, 'hook')

    // Optional AI voiceover: synth each scene's line first, so scenes can pace
    // to speech. null-safe — a voiceover failure just yields a silent scene.
    const vo = job.voiceover && job.voiceover.enabled ? job.voiceover : null
    // Scene transitions: 'smooth' (exit-fade + cross-dissolve, default),
    // 'simple' (exit-fade only), 'none' (hard cuts, legacy).
    const transition = ['smooth', 'simple', 'none', 'cinematic', 'push'].includes(job.transition) ? job.transition : 'smooth'

    if (job.mode === 'creative' && Array.isArray(job.script) && job.script.length) {
      const brand = { name: (job.brand || {}).name || '', color, logoUrl: (job.brand || {}).logoUrl || null, domain: (job.brand || {}).domain || null }
      const bgUrl = bgPath ? pathToFileURL(bgPath).href : null

      let voiceSegs = null
      let voLines = null
      if (vo) {
        await report(40, 'voiceover')
        const mixed = vo.gender === 'mixed'
        const cast = mixed ? castVoices(job.script.map((s) => s.type)) : null
        const lines = job.script.map((s, li) => ({ text: creativeSceneNarration(s, (job.brand || {}).name, vo.language), ...(mixed ? { gender: cast[li], voice: MIXED_VOICE[cast[li]] } : {}) }))
        voLines = lines
        voiceSegs = await synthLines(lines, { language: vo.language, gender: mixed ? 'female' : vo.gender, voice: mixed ? undefined : vo.voice, model: vo.model, rate: vo.rate, style: vo.style }, scratch, 3,
          async (d, total) => { await report(40 + Math.round((d / total) * 2), 'voiceover') })
      }

      const tasks = []
      const segments = []
      const boundaries = []
      const timeline = [] // scene timing for the SFX scheduler
      let cursor = 0
      let hookStart = 0
      // Per-type ordinals so templates can show "2 / 3" chips / ghost digits.
      const typeTotals = {}
      for (const sc of job.script) typeTotals[sc.type] = (typeTotals[sc.type] || 0) + 1
      const typeSeen = {}
      let prevVariant = null
      job.script.forEach((scene, i) => {
        const baseMs = SCENE_DUR[scene.type] || 2800
        const seg = voiceSegs ? voiceSegs[i] : null
        const isLast = i === job.script.length - 1
        // The video ends on a 3s quiet hold: the final scene lingers with no
        // narration (its audio segment is silence-padded to the full length).
        const durMs = (seg ? clampSceneMs(seg.durationSec * 1000, baseMs) : baseMs) + (isLast ? 3000 : 0)
        const start = cursor
        if (start > 0) boundaries.push(start)
        cursor += framesFor(durMs)
        if (scene.type === 'hook') hookStart = start
        typeSeen[scene.type] = (typeSeen[scene.type] || 0) + 1
        const data = {
          ...scene, brand, bg: scene.type === 'hook' ? bgUrl : null, lang: job.lang || 'en', arFont: job.arFont || 'cairo',
          ...(job.captions !== false && seg && seg.durationSec && voLines && voLines[i]
            ? (() => { const wds = captionWords(voLines[i].text, seg.durationSec); return wds ? { captions: { words: wds } } : {} })()
            : {}),
          index: typeSeen[scene.type], total: typeTotals[scene.type],
          palette: job.palette || null,
          // The final scene HOLDS (no exit) so the CTA lingers on screen.
          durMs, transition: isLast ? 'none' : transition,
        }
        // Showcases rotate through content-matched layout variants for a
        // designed-edit feel; other scene types keep their single template.
        let tplFile = `${scene.type}.html`
        if (scene.type === 'showcase') {
          const v = pickShowcaseVariant(scene, i, String(job.id || 'job'), prevVariant, job.sceneStyles)
          prevVariant = v
          tplFile = showcaseTemplate(v)
        }
        tasks.push(() => renderScene(path.join(CREATIVE_DIR, tplFile), data, { w: dims.w, h: dims.h, durMs, fps: FPS, outDir: framesDir, startIndex: start, shouldCancel }))
        segments.push({ audioPath: seg ? seg.audioPath : null, durMs })
        timeline.push({ type: scene.type, startMs: Math.round((start / FPS) * 1000), durMs })
      })
      const thumbFrameIndex = Math.min(hookStart + FPS, Math.max(0, cursor - 1))
      await report(42, 'rendering')
      await runPool(tasks, CONCURRENCY, async (d, total) => { await report(42 + Math.round((d / total) * 43), 'rendering') })
      if (transition === 'smooth') await applyDissolves(framesDir, boundaries, cursor)
      else if (transition === 'cinematic' || transition === 'push') await applyXfades(framesDir, boundaries, cursor, { pool: transition })
      // Loop-friendly ending: the tail dissolves back into frame 0 so replays are seamless.
      if (transition !== 'none') await applyLoopTail(framesDir, cursor)
      await report(88, 'encoding')
      const voiceTrack = vo ? await buildVoiceTrack(segments, scratch, FPS) : null
      // Sound effects (default ON): scheduled from the exact scene timeline,
      // mixed under the narration. Any failure -> silently no SFX.
      const sfxOn = !(job.sfx && job.sfx.enabled === false)
      const sfxTrack = sfxOn ? await buildSfxTrack(scheduleSfx(timeline), Math.round((cursor / FPS) * 1000), scratch, job.id) : null
      const audioTrack = await mixTracks(voiceTrack, sfxTrack, scratch)
      const outMp4 = path.join(scratch, `${job.id}.mp4`)
      const outThumb = path.join(scratch, `${job.id}.jpg`)
      await encode(framesDir, FPS, outMp4, audioTrack)
      await thumbFromFrame(framesDir, outThumb, thumbFrameIndex)
      await report(92, 'encoding')
      const folder = job.campaignId || job.id
      await report(94, 'uploading')
      const videoUrl = await upload(outMp4, `campaigns/${folder}/${job.id}.mp4`, 'video/mp4')
      const thumbnailUrl = await upload(outThumb, `campaigns/${folder}/${job.id}.jpg`, 'image/jpeg')
      await report(99, 'uploading')
      return { videoUrl, thumbnailUrl }
    }

    const hookData = {
      bg: bgPath ? pathToFileURL(bgPath).href : null,
      headline: hook.headline || brand.name || '',
      subtext: hook.subtext || '',
      logo: brand.logoUrl || null,
      color,
    }

    // Basic mode voiceover: narrate the hook line + each post's caption/headline.
    let voiceSegs = null
    if (vo) {
      await report(40, 'voiceover')
      const mixedB = vo.gender === 'mixed'
      const castB = mixedB ? castVoices(['basicHook', ...(job.scenes || []).map(() => 'basicScene')]) : null
      const lines = [
        { text: [hookData.headline, hookData.subtext].filter(Boolean).join('. '), ...(mixedB ? { gender: castB[0], voice: MIXED_VOICE[castB[0]] } : {}) },
        ...(job.scenes || []).map((s, li) => ({ text: s.caption || s.headline || '', ...(mixedB ? { gender: castB[li + 1], voice: MIXED_VOICE[castB[li + 1]] } : {}) })),
      ]
      voiceSegs = await synthLines(lines, { language: vo.language, gender: mixedB ? 'female' : vo.gender, voice: mixedB ? undefined : vo.voice, model: vo.model, rate: vo.rate, style: vo.style }, scratch, 3,
        async (d, total) => { await report(40 + Math.round((d / total) * 2), 'voiceover') })
    }

    // Pre-assign a contiguous frame range to the hook + each scene, so they can
    // render in PARALLEL across all vCPUs without frame collisions and still
    // concat in order.
    const tasks = []
    const segments = []
    const boundaries = []
    const timeline = [] // scene timing for the SFX scheduler
    let cursor = 0
    const hookSeg = voiceSegs ? voiceSegs[0] : null
    const hookDurMs = hookSeg ? clampSceneMs(hookSeg.durationSec * 1000, HOOK_DUR_MS) : HOOK_DUR_MS
    const hookFrames = framesFor(hookDurMs)
    const hookStart = cursor
    cursor += hookFrames
    tasks.push(() =>
      renderScene(HOOK_TEMPLATE, hookData, { w: dims.w, h: dims.h, durMs: hookDurMs, fps: FPS, outDir: framesDir, startIndex: hookStart, shouldCancel })
    )
    segments.push({ audioPath: hookSeg ? hookSeg.audioPath : null, durMs: hookDurMs })
    timeline.push({ type: 'basicHook', startMs: 0, durMs: hookDurMs })
    const sceneCount = (job.scenes || []).length
    ;(job.scenes || []).forEach((scene, i) => {
      const seg = voiceSegs ? voiceSegs[i + 1] : null
      const isLast = i === sceneCount - 1
      // 3s quiet hold at the very end (see creative branch).
      const durMs = (seg ? clampSceneMs(seg.durationSec * 1000, SCENE_DUR_MS) : SCENE_DUR_MS) + (isLast ? 3000 : 0)
      const start = cursor
      boundaries.push(start)
      cursor += framesFor(durMs)
      const data = {
        image: scene.imageUrl || null, headline: scene.headline || '', caption: scene.caption || '', color, lang: job.lang || 'en',
        palette: job.palette || null,
        durMs, transition: isLast ? 'none' : transition, // final scene holds
      }
      tasks.push(() =>
        renderScene(SCENE_TEMPLATE, data, { w: dims.w, h: dims.h, durMs, fps: FPS, outDir: framesDir, startIndex: start, shouldCancel })
      )
      segments.push({ audioPath: seg ? seg.audioPath : null, durMs })
      timeline.push({ type: 'basicScene', startMs: Math.round((start / FPS) * 1000), durMs })
    })
    // A frame ~1s into the hook, once its entrance animation has settled.
    const thumbFrameIndex = Math.min(FPS, Math.max(0, hookFrames - 1))

    await report(42, 'rendering')
    await runPool(tasks, CONCURRENCY, async (d, total) => {
      await report(42 + Math.round((d / total) * 43), 'rendering') // 42 → 85
    })
    if (transition === 'smooth') await applyDissolves(framesDir, boundaries, cursor)
      else if (transition === 'cinematic' || transition === 'push') await applyXfades(framesDir, boundaries, cursor, { pool: transition })
      // Loop-friendly ending: the tail dissolves back into frame 0 so replays are seamless.
      if (transition !== 'none') await applyLoopTail(framesDir, cursor)
    await report(85, 'rendering')

    const voiceTrack = vo ? await buildVoiceTrack(segments, scratch, FPS) : null
    // Sound effects (default ON) — same engine as the creative branch.
    const sfxOn = !(job.sfx && job.sfx.enabled === false)
    const sfxTrack = sfxOn ? await buildSfxTrack(scheduleSfx(timeline), Math.round((cursor / FPS) * 1000), scratch, job.id) : null
    const audioTrack = await mixTracks(voiceTrack, sfxTrack, scratch)
    const outMp4 = path.join(scratch, `${job.id}.mp4`)
    const outThumb = path.join(scratch, `${job.id}.jpg`)
    await encode(framesDir, FPS, outMp4, audioTrack)
    await thumbFromFrame(framesDir, outThumb, thumbFrameIndex)
    await report(92, 'encoding')

    const folder = job.campaignId || job.id
    await report(94, 'uploading')
    const videoUrl = await upload(outMp4, `campaigns/${folder}/${job.id}.mp4`, 'video/mp4')
    const thumbnailUrl = await upload(outThumb, `campaigns/${folder}/${job.id}.jpg`, 'image/jpeg')
    await report(99, 'uploading')

    return { videoUrl, thumbnailUrl }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
}
