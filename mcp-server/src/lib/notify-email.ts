/**
 * Fire-and-forget email notification from the MCP server.
 * Calls the Next.js /api/email/notify endpoint with the shared INTERNAL_API_TOKEN.
 * Failures are logged but never thrown — email delivery should not fail the MCP tool.
 */

interface RecipientRef {
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

type NotifyEvent =
  | { type: 'task_question_asked'; payload: BaseTaskContext & { question: string } }
  | { type: 'task_assigned'; payload: BaseTaskContext & { taskDescription?: string; deadline?: string | null } }

export async function notifyEmail(event: NotifyEvent): Promise<void> {
  const token = process.env.INTERNAL_API_TOKEN;
  const baseUrl = process.env.WORKHUB_API_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3090';
  if (!token) {
    // Email triggers are optional. Silently no-op when not configured.
    return;
  }
  if (!event.payload.recipients || event.payload.recipients.length === 0) return;

  try {
    const res = await fetch(`${baseUrl}/api/email/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.warn(`[mcp-email] notify ${event.type} failed: ${res.status} ${text}`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[mcp-email] notify ${event.type} error:`, err);
  }
}
