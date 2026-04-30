import { getAppUrl } from './client'

// HTML escaping for user-supplied strings (names, task titles, comment bodies).
function esc(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface BaseLayoutInput {
  title: string
  preheader?: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
}

function layout({ title, preheader, body, ctaLabel, ctaUrl }: BaseLayoutInput): string {
  const cta =
    ctaLabel && ctaUrl
      ? `<div style="text-align:center;margin:32px 0 8px"><a href="${esc(ctaUrl)}" style="background:#0f172a;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">${esc(ctaLabel)}</a></div>`
      : ''
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;line-height:1.55">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent">${esc(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0"><div style="font-weight:700;font-size:18px;color:#0f172a">WorkHub</div></td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:600">${esc(title)}</h1>
        ${body}
        ${cta}
      </td></tr>
      <tr><td style="padding:18px 28px;background:#f1f5f9;color:#64748b;font-size:12px;text-align:center">You received this because you&apos;re part of a WorkHub project.</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

export interface TaskAssignedEmailInput {
  recipientName: string
  actorName: string
  taskName: string
  projectName: string
  projectId: string
  taskId: string
  taskDescription?: string
  deadline?: string | null
}

export function taskAssignedEmail(input: TaskAssignedEmailInput): { subject: string; html: string; text: string } {
  const url = `${getAppUrl()}/projects/${input.projectId}?taskId=${input.taskId}`
  const subject = `${input.actorName} assigned you to "${input.taskName}"`
  const desc = input.taskDescription?.trim()
  const body = `
    <p>Hi ${esc(input.recipientName)},</p>
    <p><strong>${esc(input.actorName)}</strong> assigned you to a task in <strong>${esc(input.projectName)}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
      <tr><td style="padding:14px 16px">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Task</div>
        <div style="font-size:15px;font-weight:600;color:#0f172a">${esc(input.taskName)}</div>
        ${input.deadline ? `<div style="font-size:12px;color:#64748b;margin-top:8px">Deadline: ${esc(input.deadline)}</div>` : ''}
        ${desc ? `<div style="font-size:13px;color:#334155;margin-top:10px;white-space:pre-wrap">${esc(desc.slice(0, 400))}${desc.length > 400 ? '…' : ''}</div>` : ''}
      </td></tr>
    </table>`
  const text = `${input.actorName} assigned you to "${input.taskName}" in ${input.projectName}.\n\nOpen: ${url}`
  return {
    subject,
    html: layout({ title: 'You were assigned a task', preheader: subject, body, ctaLabel: 'Open task', ctaUrl: url }),
    text,
  }
}

export interface TaskCommentMentionEmailInput {
  recipientName: string
  actorName: string
  taskName: string
  projectName: string
  projectId: string
  taskId: string
  commentSnippet: string
}

export function taskCommentMentionEmail(input: TaskCommentMentionEmailInput): { subject: string; html: string; text: string } {
  const url = `${getAppUrl()}/projects/${input.projectId}?taskId=${input.taskId}`
  const subject = `${input.actorName} mentioned you on "${input.taskName}"`
  const body = `
    <p>Hi ${esc(input.recipientName)},</p>
    <p><strong>${esc(input.actorName)}</strong> mentioned you in a comment on <strong>${esc(input.taskName)}</strong> (${esc(input.projectName)}).</p>
    <blockquote style="margin:18px 0;padding:12px 16px;border-left:3px solid #0f172a;background:#f8fafc;color:#334155;font-size:13px;white-space:pre-wrap">${esc(input.commentSnippet.slice(0, 500))}${input.commentSnippet.length > 500 ? '…' : ''}</blockquote>`
  const text = `${input.actorName} mentioned you on "${input.taskName}" (${input.projectName}).\n\n"${input.commentSnippet}"\n\nOpen: ${url}`
  return {
    subject,
    html: layout({ title: 'You were mentioned in a comment', preheader: subject, body, ctaLabel: 'View comment', ctaUrl: url }),
    text,
  }
}

export interface TaskCompletedEmailInput {
  recipientName: string
  actorName: string
  taskName: string
  projectName: string
  projectId: string
  taskId: string
}

export function taskCompletedEmail(input: TaskCompletedEmailInput): { subject: string; html: string; text: string } {
  const url = `${getAppUrl()}/projects/${input.projectId}?taskId=${input.taskId}`
  const subject = `${input.actorName} marked "${input.taskName}" as done`
  const body = `
    <p>Hi ${esc(input.recipientName)},</p>
    <p><strong>${esc(input.actorName)}</strong> marked a task as done in <strong>${esc(input.projectName)}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px">
      <tr><td style="padding:14px 16px">
        <div style="font-size:11px;color:#047857;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Completed</div>
        <div style="font-size:15px;font-weight:600;color:#064e3b">${esc(input.taskName)}</div>
      </td></tr>
    </table>`
  const text = `${input.actorName} marked "${input.taskName}" as done (${input.projectName}).\n\nView: ${url}`
  return {
    subject,
    html: layout({ title: 'Task completed', preheader: subject, body, ctaLabel: 'View task', ctaUrl: url }),
    text,
  }
}

export interface TaskQuestionAskedEmailInput {
  recipientName: string
  actorName: string
  taskName: string
  projectName: string
  projectId: string
  taskId: string
  question: string
}

export function taskQuestionAskedEmail(input: TaskQuestionAskedEmailInput): { subject: string; html: string; text: string } {
  const url = `${getAppUrl()}/projects/${input.projectId}?taskId=${input.taskId}`
  const subject = `New question on "${input.taskName}" — needs your answer`
  const body = `
    <p>Hi ${esc(input.recipientName)},</p>
    <p><strong>${esc(input.actorName)}</strong> asked a question on a task in <strong>${esc(input.projectName)}</strong>.</p>
    <blockquote style="margin:18px 0;padding:12px 16px;border-left:3px solid #f59e0b;background:#fffbeb;color:#78350f;font-size:14px;white-space:pre-wrap">${esc(input.question.slice(0, 800))}${input.question.length > 800 ? '…' : ''}</blockquote>
    <p style="font-size:13px;color:#475569">Task: <strong>${esc(input.taskName)}</strong></p>`
  const text = `${input.actorName} asked a question on "${input.taskName}" (${input.projectName}):\n\n${input.question}\n\nAnswer here: ${url}`
  return {
    subject,
    html: layout({ title: 'A question needs your answer', preheader: subject, body, ctaLabel: 'Answer question', ctaUrl: url }),
    text,
  }
}
