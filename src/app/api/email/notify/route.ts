import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email/client'
import { getAppSettingsServer } from '@/lib/server/app-settings'
import {
  taskAssignedEmail,
  taskCommentMentionEmail,
  taskCompletedEmail,
  taskQuestionAskedEmail,
} from '@/lib/email/templates'

// Constant-time comparison to prevent timing attacks on the internal token.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function authenticate(request: NextRequest): Promise<{ ok: boolean; uid: string | null; internal: boolean }> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return { ok: false, uid: null, internal: false }
  const token = auth.slice(7)

  // Path A: internal token (for MCP server / Cloud Functions)
  const internalToken = process.env.INTERNAL_API_TOKEN
  if (internalToken && safeEqual(token, internalToken)) {
    return { ok: true, uid: null, internal: true }
  }

  // Path B: user JWT
  const decoded = await verifyAuth(request)
  if (decoded) return { ok: true, uid: decoded.uid, internal: false }

  return { ok: false, uid: null, internal: false }
}

async function isEmailNotificationsEnabled(): Promise<boolean> {
  const settings = await getAppSettingsServer()
  // Default to true when settings doc is unreadable (dev) or the field is unset
  return settings?.emailNotificationsEnabled !== false
}

type NotifyEvent =
  | { type: 'task_assigned'; payload: TaskAssignedPayload }
  | { type: 'task_comment_mention'; payload: TaskCommentMentionPayload }
  | { type: 'task_question_asked'; payload: TaskQuestionAskedPayload }
  | { type: 'task_completed'; payload: TaskCompletedPayload }

interface RecipientRef {
  email: string
  name: string
}

interface TaskAssignedPayload {
  recipients: RecipientRef[]
  actorName: string
  taskName: string
  projectName: string
  projectId: string
  taskId: string
  taskDescription?: string
  deadline?: string | null
}

interface TaskCommentMentionPayload {
  recipients: RecipientRef[]
  actorName: string
  taskName: string
  projectName: string
  projectId: string
  taskId: string
  commentSnippet: string
}

interface TaskQuestionAskedPayload {
  recipients: RecipientRef[]
  actorName: string
  taskName: string
  projectName: string
  projectId: string
  taskId: string
  question: string
}

interface TaskCompletedPayload {
  recipients: RecipientRef[]
  actorName: string
  taskName: string
  projectName: string
  projectId: string
  taskId: string
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (!auth.ok) {
    console.warn('[email/api] 401 — authentication failed (no valid JWT or internal token)')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  console.info(`[email/api] auth ok — caller=${auth.internal ? 'internal' : `user:${auth.uid}`}`)

  const rateLimited = checkRateLimit(`email:${auth.uid || (auth.internal ? 'internal' : 'anon')}`, 60, 60_000)
  if (rateLimited) {
    console.warn('[email/api] rate-limited')
    return rateLimited
  }

  if (!(await isEmailNotificationsEnabled())) {
    console.warn('[email/api] skipped — emailNotificationsEnabled=false in AppSettings')
    return NextResponse.json({ ok: true, skipped: 'Email notifications disabled by admin' })
  }

  let body: NotifyEvent
  try {
    body = (await request.json()) as NotifyEvent
  } catch {
    console.warn('[email/api] 400 — invalid JSON')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || !body.type || !body.payload) {
    console.warn('[email/api] 400 — missing type or payload')
    return NextResponse.json({ error: 'Missing type or payload' }, { status: 400 })
  }

  const recipients = body.payload.recipients?.filter((r) => r?.email) ?? []
  console.info(`[email/api] event=${body.type} recipients=${recipients.length}:`, recipients.map((r) => r.email))
  if (recipients.length === 0) {
    console.warn('[email/api] skipped — recipients list is empty after filtering')
    return NextResponse.json({ ok: true, skipped: 'No recipients' })
  }

  const results: Array<{ to: string; ok: boolean; reason?: string; messageId?: string }> = []

  for (const r of recipients) {
    let template: { subject: string; html: string; text: string }
    if (body.type === 'task_assigned') {
      template = taskAssignedEmail({ recipientName: r.name, ...body.payload })
    } else if (body.type === 'task_comment_mention') {
      template = taskCommentMentionEmail({ recipientName: r.name, ...body.payload })
    } else if (body.type === 'task_question_asked') {
      template = taskQuestionAskedEmail({ recipientName: r.name, ...body.payload })
    } else if (body.type === 'task_completed') {
      template = taskCompletedEmail({ recipientName: r.name, ...body.payload })
    } else {
      return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
    }
    const result = await sendEmail({
      to: r.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
    results.push({ to: r.email, ok: result.ok, reason: result.reason, messageId: result.messageId })
  }

  return NextResponse.json({ ok: true, results })
}
