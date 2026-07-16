import path from 'path'
import { fileURLToPath } from 'url'
import { renderScene } from './render.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCENE_TEMPLATE = path.join(__dirname, '..', 'templates', 'scene.html')

export const SCENE_DUR_MS = 3000

// Renders job.scenes[] sequentially, appending frames after startIndex.
// Returns the total number of frames written across all scenes.
export async function renderScenes(scenes, { w, h, outDir, startIndex, color, fps, durMs = SCENE_DUR_MS }) {
  let idx = startIndex
  for (const scene of scenes || []) {
    const data = {
      image: scene.imageUrl || null,
      headline: scene.headline || '',
      caption: scene.caption || '',
      color,
    }
    const count = await renderScene(SCENE_TEMPLATE, data, { w, h, durMs, fps, outDir, startIndex: idx })
    idx += count
  }
  return idx - startIndex
}
