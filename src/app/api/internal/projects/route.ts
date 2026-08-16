import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import '@/lib/api-auth' // side effect: initializes Firebase Admin

// Internal projects feed for sibling Sikasio systems (e.g. Publish).
// Implements the generic "project source" contract:
//   GET + Bearer INTERNAL_API_TOKEN →
//   { projects: [{ id, name, color, parentId, status, description, group, logo,
//                  notes, type, stages }] }
// notes/type/stages give a writer enough of the project's brief to write about
// it without a per-project style guide on the other side.

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function GET(request: NextRequest) {
  const internalToken = process.env.INTERNAL_API_TOKEN
  const auth = request.headers.get('Authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!internalToken || !token || !safeEqual(token, internalToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!admin.apps.length) {
    return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 503 })
  }

  const snap = await admin
    .firestore()
    .collection('projects')
    .where('status', '==', 'active')
    .get()

  const projects = snap.docs
    .map((d) => {
      const p = d.data()
      return {
        id: d.id,
        name: (p.name as string) || d.id,
        color: (p.color as string) || null,
        parentId: (p.parentProjectId as string) || null,
        status: (p.status as string) || 'active',
        description: (p.description as string) || null,
        group: (p.group as string) || null,
        logo: (p.coverImageUrl as string) || null,
        notes: (p.notes as string) || null,
        type: (p.projectType as string) || null,
        stages: Array.isArray(p.enabledStages) ? (p.enabledStages as string[]) : [],
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ projects })
}
