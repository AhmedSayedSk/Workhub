import { NextRequest, NextResponse } from 'next/server'
import { listAllRepos } from '@/lib/sikagit-server'
import { SIKAGIT_ENABLED } from '@/lib/sikagit-flag'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!SIKAGIT_ENABLED) return NextResponse.json({ error: 'sikagit integration is disabled' }, { status: 404 })

  const dbPath = req.nextUrl.searchParams.get('dbPath')
  const pathPrefix = req.nextUrl.searchParams.get('pathPrefix')

  if (!dbPath) {
    return NextResponse.json({ error: 'Missing dbPath query param' }, { status: 400 })
  }

  try {
    const repos = listAllRepos({ dbPath, pathPrefix })
    return NextResponse.json({ repos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sikagit read failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
