import { NextRequest } from 'next/server'
import * as admin from 'firebase-admin'
import { verifyAuth } from '@/lib/api-auth'

// Server-side owner gate for /api/vps/*. The dashboard exposes infrastructure
// data, so this is the authoritative check — never trust the client gate alone.
//
// Mirrors the client rule `user.uid === settings.appOwnerUid`, reading the owner
// uid from Firestore `settings/app_settings` via the Admin SDK.
export async function isOwnerRequest(request: NextRequest): Promise<boolean> {
  // Dev convenience: with no Admin SDK configured locally, allow outside production.
  if (!admin.apps.length) {
    return process.env.NODE_ENV !== 'production'
  }

  const decoded = await verifyAuth(request)
  if (!decoded) return false

  try {
    const snap = await admin.firestore().doc('settings/app_settings').get()
    const ownerUid = snap.data()?.appOwnerUid as string | undefined
    return !!ownerUid && decoded.uid === ownerUid
  } catch {
    return false
  }
}
