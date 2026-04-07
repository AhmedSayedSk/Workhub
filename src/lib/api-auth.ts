import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  let credential: admin.credential.Credential | undefined

  // Option 1: Service account JSON from env var (production/Railway)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  }

  // Option 2: Local service account file (development)
  if (!credential) {
    const localPath = join(process.cwd(), 'firebase-service-account.json')
    if (existsSync(localPath)) {
      const sa = JSON.parse(readFileSync(localPath, 'utf-8'))
      credential = admin.credential.cert(sa)
    }
  }

  if (credential) {
    admin.initializeApp({ credential })
  }
  // If no credential found, auth verification will be skipped (dev convenience)
}

const UNAUTHORIZED = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const isAdminInitialized = admin.apps.length > 0

/**
 * Verify Firebase ID token from Authorization header.
 * Returns the decoded token if valid, or null.
 */
export async function verifyAuth(request: NextRequest): Promise<admin.auth.DecodedIdToken | null> {
  if (!isAdminInitialized) return null

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  try {
    const token = authHeader.slice(7)
    return await admin.auth().verifyIdToken(token)
  } catch {
    return null
  }
}

/**
 * Middleware-style auth check. Returns an error response if not authenticated.
 * In development without Firebase Admin, allows all requests through.
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  // If Firebase Admin isn't configured, skip auth in development
  if (!isAdminInitialized) {
    if (process.env.NODE_ENV === 'production') return UNAUTHORIZED
    return null
  }

  const decoded = await verifyAuth(request)
  if (!decoded) return UNAUTHORIZED
  return null
}
