import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const { email, password, displayName } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Check if Firebase Admin is initialized
    if (!admin.apps.length) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 })
    }

    // Create the Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || undefined,
    })

    // Also create a userProfile document for sharing lookups
    const db = admin.firestore()
    await db.collection('userProfiles').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || null,
      photoURL: null,
      lastLoginAt: admin.firestore.Timestamp.now(),
    })

    return NextResponse.json({ uid: userRecord.uid })
  } catch (error: any) {
    if (error?.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to create user' },
      { status: 500 }
    )
  }
}
