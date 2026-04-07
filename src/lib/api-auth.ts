import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  // In production, use GOOGLE_APPLICATION_CREDENTIALS or service account env var
  // In development, use the local service account file
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : undefined

  admin.initializeApp(
    serviceAccount
      ? { credential: admin.credential.cert(serviceAccount) }
      : { credential: admin.credential.applicationDefault() }
  )
}

const UNAUTHORIZED = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

/**
 * Verify Firebase ID token from Authorization header.
 * Returns the decoded token if valid, or null.
 */
export async function verifyAuth(request: NextRequest): Promise<admin.auth.DecodedIdToken | null> {
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
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const decoded = await verifyAuth(request)
  if (!decoded) return UNAUTHORIZED
  return null
}
