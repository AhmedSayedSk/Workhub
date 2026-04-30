import 'server-only'
import * as admin from 'firebase-admin'
import type { AppSettings } from '@/types'

/**
 * Server-side AppSettings reader using Firebase Admin SDK.
 * Bypasses Firestore security rules (which require an authenticated user),
 * so this works from API routes that don't have user auth context.
 *
 * Returns null when:
 * - Firebase Admin isn't configured (no service account in dev)
 * - The settings doc doesn't exist
 * - Any read error occurs
 */
export async function getAppSettingsServer(): Promise<AppSettings | null> {
  if (!admin.apps.length) return null
  try {
    const snap = await admin.firestore().collection('settings').doc('app_settings').get()
    if (!snap.exists) return null
    return { id: snap.id, ...(snap.data() as Omit<AppSettings, 'id'>) }
  } catch (e) {
    console.warn('[server/app-settings] read failed:', e)
    return null
  }
}
