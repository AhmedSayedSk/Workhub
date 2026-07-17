import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
const db = () => admin.firestore()

// The scene-style catalog: one row per showcase composition the render worker
// can use. Seeded once; the table UI toggles `enabled` — only enabled styles
// are used in campaign videos.
const DEFAULT_STYLES = [
  { id: 'a', name: 'Classic Card', description: 'Full-height framed image with the copy overlaid on a gradient scrim at the bottom.', bestFor: 'Longer copy with a sub-line', order: 1, previewUrl: 'https://storage.googleapis.com/workhub-c288f.firebasestorage.app/scene-styles/v1/a.jpg' },
  { id: 'b', name: 'Split Panel', description: 'Slant-cut image over a solid copy panel, with an automatic stat chip pulled from the first number in the copy.', bestFor: 'Number-led copy', order: 2, previewUrl: 'https://storage.googleapis.com/workhub-c288f.firebasestorage.app/scene-styles/v1/b.jpg' },
  { id: 'c', name: 'Magazine', description: 'Rotated photo card with an offset accent frame, a giant outlined ghost word and the caption in an accent chip.', bestFor: 'Editorial / brand moments', order: 3, previewUrl: 'https://storage.googleapis.com/workhub-c288f.firebasestorage.app/scene-styles/v1/c.jpg' },
  { id: 'd', name: 'Kinetic Type', description: 'Near full-bleed image with huge centered type; the key word gets an accent highlight box.', bestFor: 'Short punchlines', order: 4, previewUrl: 'https://storage.googleapis.com/workhub-c288f.firebasestorage.app/scene-styles/v1/d.jpg' },
  { id: 'e', name: 'Duotone Poster', description: 'Brand-tinted duotone image with heavy stacked poster type and an accent block bar.', bestFor: 'Bold statements / brand looks', order: 5, previewUrl: 'https://storage.googleapis.com/workhub-c288f.firebasestorage.app/scene-styles/v1/e.jpg' },
  { id: 'f', name: 'Panel Reveal', description: 'The image split into three staggered vertical slices over a solid caption band.', bestFor: 'Detailed copy / broadcast feel', order: 6, previewUrl: 'https://storage.googleapis.com/workhub-c288f.firebasestorage.app/scene-styles/v1/f.jpg' },
  { id: 'g', name: 'Spotlight', description: 'Square image card zooming in over a slowly rotating accent ring, copy centered beneath.', bestFor: 'Product focus / feature highlights', order: 7, previewUrl: 'https://storage.googleapis.com/workhub-c288f.firebasestorage.app/scene-styles/v1/g.jpg' },
]

async function ensureSeeded() {
  const col = db().collection('sceneStyles')
  const snap = await col.get()
  const have = new Set(snap.docs.map((d) => d.id))
  const batch = db().batch()
  let added = 0
  for (const s of DEFAULT_STYLES) {
    if (!have.has(s.id)) { batch.set(col.doc(s.id), { ...s, enabled: true, updatedAt: Date.now() }); added++ }
    else { batch.set(col.doc(s.id), { previewUrl: (s as any).previewUrl, description: s.description, bestFor: s.bestFor, name: s.name, order: s.order }, { merge: true }); added++ }
  }
  if (added) await batch.commit()
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError
  await ensureSeeded()
  const snap = await db().collection('sceneStyles').get()
  const styles = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
  return NextResponse.json({ styles })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => ({}))
  const id = String(body.id || '')
  const enabled = !!body.enabled
  if (!DEFAULT_STYLES.some((s) => s.id === id)) return NextResponse.json({ error: 'Unknown style' }, { status: 400 })
  if (!enabled) {
    // Never allow disabling the last enabled style — videos need at least one.
    const snap = await db().collection('sceneStyles').where('enabled', '==', true).get()
    const enabledIds = snap.docs.map((d) => d.id)
    if (enabledIds.length <= 1 && enabledIds.includes(id)) {
      return NextResponse.json({ error: 'At least one scene style must stay enabled' }, { status: 400 })
    }
  }
  await db().collection('sceneStyles').doc(id).set({ enabled, updatedAt: Date.now() }, { merge: true })
  return NextResponse.json({ ok: true })
}
