import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

function normalizePath(raw: string): string {
  let p = raw.trim().replace(/\\/g, '/')
  const driveMatch = p.match(/^([A-Za-z]):\/(.*)$/)
  if (driveMatch) {
    p = `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`
  }
  return p
}

/**
 * POST /api/cleanup-worktrees
 * Body: { repoPath: string, branches: string[] }
 * Removes git worktrees and branches associated with AI sessions.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production.' }, { status: 403 })
  }

  const authError = await requireAuth(req)
  if (authError) return authError

  try {
    const { repoPath: rawPath, branches } = await req.json()
    const repoPath = rawPath ? normalizePath(String(rawPath)) : null

    if (!rawPath || !repoPath || !Array.isArray(branches) || branches.length === 0) {
      return NextResponse.json({ error: 'Missing repoPath or branches' }, { status: 400 })
    }

    // Validate branch names to prevent injection
    const safeBranchPattern = /^[\w./-]+$/
    const safeBranches = branches.filter((b: string) => safeBranchPattern.test(b))

    if (safeBranches.length === 0) {
      return NextResponse.json({ error: 'No valid branch names provided' }, { status: 400 })
    }

    const results: { branch: string; worktreeRemoved: boolean; branchRemoved: boolean; error?: string }[] = []

    // List existing worktrees once
    let worktreeList = ''
    try {
      worktreeList = execSync('git worktree list --porcelain', { cwd: repoPath, encoding: 'utf-8' })
    } catch {
      // No worktrees or not a git repo
    }

    for (const branch of safeBranches) {
      const result: { branch: string; worktreeRemoved: boolean; branchRemoved: boolean; error?: string } = {
        branch,
        worktreeRemoved: false,
        branchRemoved: false,
      }

      // Check if there's a worktree for this branch
      const lines = worktreeList.split('\n')
      let worktreePath: string | null = null
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('branch ') && lines[i].includes(branch)) {
          for (let j = i - 1; j >= 0; j--) {
            if (lines[j].startsWith('worktree ')) {
              worktreePath = lines[j].replace('worktree ', '')
              break
            }
          }
          break
        }
      }

      // Remove worktree if found
      if (worktreePath) {
        try {
          execSync(`git worktree remove --force "${worktreePath}"`, { cwd: repoPath, encoding: 'utf-8' })
          result.worktreeRemoved = true
        } catch (e) {
          result.error = `worktree remove failed: ${(e as Error).message}`
        }
      }

      // Delete the branch
      try {
        execSync(`git branch -D "${branch}"`, { cwd: repoPath, encoding: 'utf-8' })
        result.branchRemoved = true
      } catch {
        // Branch may not exist or already deleted
      }

      results.push(result)
    }

    return NextResponse.json({ results })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
