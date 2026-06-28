import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getLinkedInStatus, disconnectLinkedIn } from '@/lib/server/linkedin/accounts'

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  const status = await getLinkedInStatus(projectId)
  return NextResponse.json(status)
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  await disconnectLinkedIn(projectId)
  return NextResponse.json({ ok: true })
}
