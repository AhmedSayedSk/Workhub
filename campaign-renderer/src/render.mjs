import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/chromium'
const READY_TIMEOUT_MS = 8000

// Renders one seek(t)-style HTML scene to a sequence of PNG frames.
// htmlPath: absolute path to a template (templates/hook.html or templates/scene.html)
// data: plumbed into the page as window.__DATA before any page script runs
// opts: { w, h, durMs, fps, outDir, startIndex }
// Returns the number of frames written.
export async function renderScene(htmlPath, data, { w, h, durMs, fps, outDir, startIndex = 0 }) {
  fs.mkdirSync(outDir, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: h })

    // Must run before the template's own <script> executes, so window.__DATA
    // is already populated when the page builds its DOM from it.
    await page.evaluateOnNewDocument((d) => { window.__DATA = d }, data || {})
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })

    // Templates expose window.__ready (image preload + document.fonts.ready).
    // Race against a timeout so a stalled network fetch can't hang the render.
    await Promise.race([
      page
        .evaluate(() => (window.__ready ? window.__ready : (document.fonts ? document.fonts.ready : Promise.resolve())))
        .catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT_MS)),
    ])

    const frameCount = Math.max(1, Math.round((durMs / 1000) * fps))
    for (let i = 0; i < frameCount; i++) {
      const t = (i / fps) * 1000
      await page.evaluate((t) => window.render(t), t)
      // Double-rAF flush: guarantees the style mutations above have been
      // painted before we screenshot, avoiding blank/stale frames.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      const idx = startIndex + i
      await page.screenshot({
        path: path.join(outDir, `f${String(idx).padStart(5, '0')}.jpg`),
        type: 'jpeg',
        quality: 92,
        clip: { x: 0, y: 0, width: w, height: h },
      })
    }
    return frameCount
  } finally {
    await browser.close()
  }
}
