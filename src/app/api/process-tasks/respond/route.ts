import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { processRegistry, spawnClaudeStream } from '../route'

export const dynamic = 'force-dynamic'
export const maxDuration = 900 // 15 minutes max

/**
 * Send a user response to a waiting Claude session.
 * Spawns a new `claude -p --resume <session_id>` process and streams the output back.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new Response(JSON.stringify({ error: 'Not available in production.' }), { status: 403 })
  }

  const authError = await requireAuth(request)
  if (authError) return authError

  const { processId, message } = await request.json()

  if (!processId || !message) {
    return new Response(JSON.stringify({ error: 'Missing processId or message' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const entry = processRegistry.get(processId)
  if (!entry || !entry.claudeSessionId) {
    return new Response(JSON.stringify({ error: 'Session not found or not yet initialized' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { claudeSessionId, repoPath, cleanEnv, claudePath } = entry

  // Spawn a new Claude process that resumes the conversation
  const stream = spawnClaudeStream(
    [
      claudePath, '-p',
      '--verbose',
      '--output-format', 'stream-json',
      '--resume', claudeSessionId,
      '--dangerously-skip-permissions',
      message,
    ],
    repoPath,
    cleanEnv,
    (newSessionId) => {
      // Update the registry with the new session ID (--resume may create a continuation)
      entry.claudeSessionId = newSessionId
    },
  )

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
