import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { spawn, ChildProcess, execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 900 // 15 minutes max

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * Global registry: processId → session info.
 * Stores the Claude CLI session_id so the /respond endpoint can spawn
 * a follow-up `claude -p --resume <session_id>` process.
 */
export const processRegistry = new Map<string, {
  claudeSessionId: string | null  // Captured from stream-json init event
  repoPath: string
  cleanEnv: Record<string, string>
  claudePath: string
  createdAt: number
}>()

// Cleanup stale entries every 60s (remove anything older than 30 min)
setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of processRegistry) {
    if (now - entry.createdAt > 30 * 60 * 1000) {
      processRegistry.delete(id)
    }
  }
}, 60_000)

/** Resolve the full path to the `claude` binary */
function resolveClaudePath(): string {
  const localBin = join(getWslHome(), '.local', 'bin', 'claude')
  if (existsSync(localBin)) return localBin

  try {
    return execSync('which claude', { encoding: 'utf-8' }).trim()
  } catch {
    return 'claude'
  }
}

/** Get the real home directory — respects HOME env (set in docker-compose) */
function getWslHome(): string {
  // Prefer HOME env var — we explicitly set it in docker-compose
  const envHome = process.env.HOME
  if (envHome && existsSync(envHome)) return envHome

  // Fallback: check /etc/passwd
  try {
    const uid = process.getuid?.()
    if (uid !== undefined) {
      const passwd = readFileSync('/etc/passwd', 'utf-8')
      const line = passwd.split('\n').find(l => l.split(':')[2] === String(uid))
      if (line) return line.split(':')[5]
    }
  } catch { /* ignore */ }

  // Fallback: check if /home/<USER> exists
  const user = process.env.USER || process.env.LOGNAME
  if (user && existsSync(`/home/${user}`)) return `/home/${user}`

  // Last resort
  return envHome || homedir()
}

/** Normalize a path: expand ~, convert backslashes, convert Windows drive paths, remap /root */
function normalizePath(raw: string): string {
  let p = raw.trim()

  // Convert backslashes to forward slashes
  p = p.replace(/\\/g, '/')

  // Expand ~ using the real home
  if (p.startsWith('~/') || p === '~') {
    p = p.replace(/^~/, getWslHome())
  }

  // Convert Windows drive paths (C:/...) to mount paths (/mnt/c/...)
  const driveMatch = p.match(/^([A-Za-z]):\/(.*)$/)
  if (driveMatch) {
    p = `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`
  }

  // Remap /root/... to actual home (Docker runs as root but home is mounted elsewhere)
  const home = getWslHome()
  if (p.startsWith('/root/') && home !== '/root' && !existsSync(p)) {
    const remapped = p.replace(/^\/root/, home)
    if (existsSync(remapped)) {
      p = remapped
    }
  }

  return p
}

/** Build a clean env without CLAUDE* vars */
export function buildCleanEnv(): Record<string, string> {
  const cleanEnv: Record<string, string> = {}
  for (const [key, val] of Object.entries(process.env)) {
    if (val !== undefined && !key.startsWith('CLAUDE')) {
      cleanEnv[key] = val
    }
  }
  const userLocalBin = join(homedir(), '.local', 'bin')
  if (cleanEnv['PATH'] && !cleanEnv['PATH'].includes(userLocalBin)) {
    cleanEnv['PATH'] = `${userLocalBin}:${cleanEnv['PATH']}`
  }
  return cleanEnv
}

/**
 * Spawn a Claude CLI process and return a ReadableStream of its output.
 * Also intercepts the stream-json init event to capture the Claude session_id.
 */
export function spawnClaudeStream(
  args: string[],
  cwd: string,
  cleanEnv: Record<string, string>,
  onSessionId?: (sid: string) => void,
): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      const child: ChildProcess = spawn('runuser', [
        '-u', 'node', '-p', '--',
        '/usr/bin/setsid',
        ...args,
      ], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: cleanEnv as NodeJS.ProcessEnv,
        windowsHide: true,
      })

      // Intercept stdout to capture session_id from init event
      let stdoutBuffer = ''
      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString()

        // Parse lines to find session_id in init event
        if (onSessionId) {
          stdoutBuffer += text
          const lines = stdoutBuffer.split('\n')
          stdoutBuffer = lines.pop() || ''
          for (const line of lines) {
            try {
              const evt = JSON.parse(line)
              if (evt.type === 'system' && evt.subtype === 'init' && evt.session_id) {
                onSessionId(evt.session_id)
              }
            } catch { /* not JSON */ }
          }
        }

        try {
          controller.enqueue(encoder.encode(text))
        } catch { /* Stream closed */ }
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        try {
          const errLine = JSON.stringify({ type: 'stderr', text: chunk.toString() }) + '\n'
          controller.enqueue(encoder.encode(errLine))
        } catch { /* Stream closed */ }
      })

      child.on('close', (code: number | null) => {
        try {
          const endLine = JSON.stringify({ type: 'process_exit', code }) + '\n'
          controller.enqueue(encoder.encode(endLine))
          controller.close()
        } catch { /* Stream closed */ }
      })

      child.on('error', (err: Error) => {
        try {
          const errLine = JSON.stringify({ type: 'process_error', message: err.message }) + '\n'
          controller.enqueue(encoder.encode(errLine))
          controller.close()
        } catch { /* Stream closed */ }
      })
    },
  })
}

export async function POST(request: NextRequest) {
  if (IS_PRODUCTION) {
    return new Response(JSON.stringify({ error: 'Claude task processing is only available in local development.' }), { status: 403 })
  }

  const authError = await requireAuth(request)
  if (authError) return authError

  const { projectId, projectName, repoPath: rawRepoPath, taskIds } = await request.json()

  if (!projectId || !projectName || !taskIds?.length) {
    return new Response(JSON.stringify({ error: 'Missing projectId, projectName, or taskIds' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Normalize path for WSL2 environment
  const repoPath = rawRepoPath ? normalizePath(String(rawRepoPath)) : null
  if (!repoPath) {
    return new Response(JSON.stringify({
      error: `Project "${projectName}" has no repository path configured. Go to Project Settings → Edit and set the Repository Path.`,
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!existsSync(repoPath)) {
    return new Response(JSON.stringify({
      error: `Repository path "${repoPath}" does not exist on disk.`,
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const claudePath = resolveClaudePath()
  const taskIdsArg = taskIds.join(',')

  const prompt = [
    `You are processing specific tasks from the WorkHub project "${projectName}" (ID: ${projectId}).`,
    `Task IDs to process: ${taskIdsArg}`,
    '',
    'For each task ID, do the following sequentially:',
    '',
    '1. Use `get_task_details` to read the full task spec.',
    '2. Use `update_task_status` to set it to `in_progress`.',
    '3. Use `start_timer` with projectId and taskId.',
    '4. Use the Task tool with `isolation: "worktree"` and `subagent_type: "general-purpose"` to spawn an agent that:',
    '   - Works in an isolated git worktree',
    '   - Creates a branch named `task/<slug>` (slug = lowercase kebab-case of task name, max 40 chars)',
    '   - Implements the changes described in the task description and subtasks',
    '   - Commits all changes with a descriptive commit message',
    '   - The agent prompt must include the full task details',
    '5. Use `add_task_comment` with ONLY a brief 1-2 sentence summary and the branch name.',
    '   CRITICAL: Do NOT list files, do NOT list line changes, do NOT describe per-file changes.',
    '   BAD example: "Files Changed (5 files): src/foo.tsx — updated X, src/bar.php — added Y"',
    '   GOOD example: "Implemented price-based budget limits replacing token-based limits. Branch: task/ai-budget-limits"',
    '6. Use `update_task_status` to set it to `review`.',
    '7. Use `stop_timer`.',
    '',
    'On error for any task: reset it to `todo` with `update_task_status`, comment the error with `add_task_comment`, stop the timer, and continue to the next task.',
    '',
    'If a task title or description is unclear or ambiguous, ask the user for clarification.',
    'Output your question as a normal assistant message — the user will see it and respond.',
    'Wait for their response before proceeding with that task.',
    '',
    'After all tasks, print a summary table of results.',
  ].join('\n')

  const cleanEnv = buildCleanEnv()
  const processId = randomUUID()

  // Emit processId as the first event, then stream Claude output
  const encoder = new TextEncoder()
  const processIdLine = JSON.stringify({ type: 'process_id', processId }) + '\n'

  const claudeStream = spawnClaudeStream(
    [claudePath, '-p', '--verbose', '--output-format', 'stream-json', '--dangerously-skip-permissions', prompt],
    repoPath,
    cleanEnv,
    (claudeSessionId) => {
      // Store in registry so /respond can use --resume
      processRegistry.set(processId, {
        claudeSessionId,
        repoPath,
        cleanEnv,
        claudePath,
        createdAt: Date.now(),
      })
    },
  )

  // Prepend the processId event to the Claude stream
  const combinedStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(processIdLine))
      const reader = claudeStream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
      } catch { /* stream error */ }
      controller.close()
    },
  })

  return new Response(combinedStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
