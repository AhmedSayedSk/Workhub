import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const { email, newPassword } = await request.json()

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    if (!admin.apps.length) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 })
    }

    const userRecord = await admin.auth().getUserByEmail(email)
    await admin.auth().updateUser(userRecord.uid, { password: newPassword })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 })
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to reset password' },
      { status: 500 }
    )
  }
}
