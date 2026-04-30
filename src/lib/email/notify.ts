import { authFetch } from '@/lib/api-client'

export interface RecipientRef {
  email: string
  name: string
}

interface BaseTaskContext {
  recipients: RecipientRef[]
  actorName: string
  taskName: string
  projectName: string
  projectId: string
  taskId: string
}

export type NotifyEventInput =
  | { type: 'task_assigned'; payload: BaseTaskContext & { taskDescription?: string; deadline?: string | null } }
  | { type: 'task_comment_mention'; payload: BaseTaskContext & { commentSnippet: string } }
  | { type: 'task_question_asked'; payload: BaseTaskContext & { question: string } }
  | { type: 'task_completed'; payload: BaseTaskContext }

/**
 * Fire-and-forget email notification.
 * Server-side logs (Next.js terminal: `[email/api] ...` and `[email] sent ...`)
 * remain authoritative for debugging.
 */
export async function notifyByEmail(event: NotifyEventInput): Promise<void> {
  if (!event.payload.recipients || event.payload.recipients.length === 0) return
  try {
    await authFetch('/api/email/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
  } catch {
    // Silent — server logs the failure.
  }
}
