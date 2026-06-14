import { NextRequest, NextResponse } from 'next/server'
import { getRepoById, readReadme } from '@/lib/sikagit-server'
import { SIKAGIT_ENABLED } from '@/lib/sikagit-flag'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!SIKAGIT_ENABLED) return NextResponse.json({ error: 'sikagit integration is disabled' }, { status: 404 })

  const { id } = await params
  const dbPath = req.nextUrl.searchParams.get('dbPath')
  const pathPrefix = req.nextUrl.searchParams.get('pathPrefix')

  if (!dbPath) {
    return NextResponse.json({ error: 'Missing dbPath query param' }, { status: 400 })
  }

  try {
    const repo = getRepoById({ dbPath, pathPrefix }, id)
    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 })
    }
    const readme = await readReadme(repo.hostPath)
    return NextResponse.json({
      repo: { id: repo.id, name: repo.name, hostPath: repo.hostPath, displayPath: repo.displayPath },
      readme: readme,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sikagit read failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
