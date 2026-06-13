import { NextRequest, NextResponse } from 'next/server'
import { listReposForProject } from '@/lib/sikagit-server'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const dbPath = req.nextUrl.searchParams.get('dbPath')
  const pathPrefix = req.nextUrl.searchParams.get('pathPrefix')

  if (!dbPath) {
    return NextResponse.json({ error: 'Missing dbPath query param' }, { status: 400 })
  }

  try {
    const repos = listReposForProject({ dbPath, pathPrefix }, id)
    return NextResponse.json({ repos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sikagit read failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
