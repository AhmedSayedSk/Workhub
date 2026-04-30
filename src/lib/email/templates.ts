import MarkdownIt from 'markdown-it'
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

// Cached markdown parser. `html: false` disables raw HTML in source so
// untrusted task content can't inject script/style tags. linkify auto-links
// bare URLs; breaks=true converts single newlines to <br> (matches editor UX).
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

// Email clients strip <style> selectors, so we have to apply styles inline on
// every tag the markdown renderer produces. This pass walks the rendered HTML
// once and injects inline-style attrs that match the WorkHub palette.
function inlineMarkdownStyles(html: string): string {
  return html
    .replace(/<p>/g, '<p style="margin:0 0 10px;line-height:1.6">')
    .replace(/<strong>/g, '<strong style="font-weight:600;color:#363c4a">')
    .replace(/<em>/g, '<em style="font-style:italic">')
    .replace(/<ul>/g, '<ul style="margin:6px 0 10px;padding-left:22px">')
    .replace(/<ol>/g, '<ol style="margin:6px 0 10px;padding-left:22px">')
    .replace(/<li>/g, '<li style="margin:2px 0;line-height:1.55">')
    .replace(/<code>/g, '<code style="background:#eef1f7;padding:1px 6px;border-radius:4px;font-family:Menlo,Monaco,Consolas,monospace;font-size:.9em;color:#364f87">')
    .replace(/<pre>/g, '<pre style="background:#eef1f7;padding:12px 14px;border-radius:6px;font-family:Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.5;overflow:auto;margin:10px 0;color:#363c4a">')
    .replace(/<blockquote>/g, '<blockquote style="margin:10px 0;padding:8px 14px;border-left:3px solid #364f87;background:#eef1f7;color:#363c4a;border-radius:4px">')
    .replace(/<h1>/g, '<h1 style="margin:14px 0 8px;font-size:18px;font-weight:700;color:#363c4a;line-height:1.3">')
    .replace(/<h2>/g, '<h2 style="margin:12px 0 6px;font-size:16px;font-weight:700;color:#363c4a;line-height:1.3">')
    .replace(/<h3>/g, '<h3 style="margin:10px 0 4px;font-size:14px;font-weight:600;color:#363c4a;line-height:1.3">')
    .replace(/<hr>/g, '<hr style="border:0;border-top:1px solid #dadee5;margin:14px 0">')
    .replace(/<a /g, '<a style="color:#364f87;text-decoration:underline" ')
}

// Render markdown to email-safe HTML. Truncates oversized content so a giant
// description doesn't blow up the email body.
function renderMarkdownForEmail(input: string, maxChars = 1500): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const truncated = trimmed.length > maxChars ? trimmed.slice(0, maxChars) + '\n\n…' : trimmed
  return inlineMarkdownStyles(md.render(truncated))
}

function plainFooter(): string {
  const settingsUrl = `${getAppUrl()}/settings`
  const adminEmail = getAdminContactEmail()
  return `—\nYou received this notification because you're part of a WorkHub project.\nMute notifications: ${settingsUrl}\nTo unsubscribe, contact your admin: ${adminEmail}`
}

function getAdminContactEmail(): string {
  const explicit = process.env.ADMIN_CONTACT_EMAIL?.trim()
  if (explicit) return explicit
  // Fall back to the FROM address (strip the display-name wrapper if present).
  const from = process.env.ZOHO_MAIL_FROM?.trim() || ''
  const match = from.match(/<([^>]+)>/)
  if (match) return match[1]
  if (from.includes('@')) return from
  return 'workhub@sikasio.com'
}

interface BaseLayoutInput {
  title: string
  preheader?: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
}

// WorkHub palette (mirrors src/app/globals.css :root vars converted from HSL → hex)
//   --background  220 20% 97%  → #f5f6f9 (page bg)
//   --foreground  220 15% 25%  → #363c4a (primary text)
//   --card        220 20% 99%  → #fbfcfd (card surface)
//   --primary     220 40% 35%  → #364f87 (brand blue)
//   --secondary   220 14% 93%  → #e9ecf0
//   --muted-foreground 220 10% 50% → #7b818d
//   --border      220 13% 88%  → #dadee5
const palette = {
  bg: '#f5f6f9',
  card: '#ffffff',
  cardSubtle: '#fbfcfd',
  text: '#363c4a',
  muted: '#7b818d',
  border: '#dadee5',
  primary: '#364f87',
  primaryFg: '#ffffff',
  accentSurface: '#eef1f7', // soft tinted surface (primary @ very low alpha, flattened)
}

// Inter is a clean, modern UI sans-serif designed for screens. We load it from
// Google Fonts with @import (Apple Mail, iOS Mail, Yahoo, Gmail web all honor
// <style> blocks). Where the web font is blocked (Outlook desktop, some clients)
// the stack falls back to Helvetica/Arial which keeps the feel consistent.
const FONT_STACK = `'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif`

function layout({ title, preheader, body, ctaLabel, ctaUrl }: BaseLayoutInput): string {
  const appUrl = getAppUrl()
  const settingsUrl = `${appUrl}/settings`
  const adminEmail = getAdminContactEmail()
  const cta =
    ctaLabel && ctaUrl
      ? `<div style="text-align:center;margin:28px 0 4px"><a href="${esc(ctaUrl)}" style="background-color:${palette.primary};color:${palette.primaryFg};padding:13px 28px;border-radius:8px;text-decoration:none;font-family:${FONT_STACK};font-weight:600;font-size:14px;display:inline-block;letter-spacing:.01em">${esc(ctaLabel)} →</a></div>`
      : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  body, table, td, p, h1, h2, h3, div, a { font-family: ${FONT_STACK}; }
</style>
</head>
<body style="margin:0;padding:0;background:${palette.bg};font-family:${FONT_STACK};color:${palette.text};line-height:1.6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;visibility:hidden">${esc(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${palette.bg};padding:32px 16px;font-family:${FONT_STACK}">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${palette.card};border-radius:14px;overflow:hidden;border:1px solid ${palette.border}">
      <tr><td style="padding:20px 28px;background:${palette.card};border-bottom:1px solid ${palette.border}">
        <div style="font-family:${FONT_STACK};font-weight:700;font-size:20px;color:${palette.primary};letter-spacing:-.01em">WorkHub</div>
        <div style="font-family:${FONT_STACK};font-size:11px;color:${palette.muted};margin-top:3px;letter-spacing:.1em;font-weight:500">FROM CHAOS TO CLARITY</div>
      </td></tr>
      <tr><td style="padding:32px 32px 8px">
        <h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:22px;font-weight:600;line-height:1.3;color:${palette.text};letter-spacing:-.01em">${esc(title)}</h1>
        <div style="font-family:${FONT_STACK};font-size:15px;color:${palette.text};line-height:1.6">${body}</div>
        ${cta}
      </td></tr>
      <tr><td style="padding:24px 32px 28px">
        <div style="border-top:1px solid ${palette.border};padding-top:20px">
          <p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;color:${palette.muted};line-height:1.6">
            You received this notification because you&apos;re part of a WorkHub project.
          </p>
          <p style="margin:0;font-family:${FONT_STACK};font-size:12px;color:${palette.muted};line-height:1.6">
            Don&apos;t want these emails? You can mute notifications in your
            <a href="${esc(settingsUrl)}" style="color:${palette.primary};text-decoration:none;font-weight:500">WorkHub Settings</a>,
            or contact your admin at
            <a href="mailto:${esc(adminEmail)}" style="color:${palette.primary};text-decoration:none;font-weight:500">${esc(adminEmail)}</a>
            to unsubscribe.
          </p>
        </div>
      </td></tr>
      <tr><td style="padding:14px 32px;background:${palette.cardSubtle};border-top:1px solid ${palette.border};text-align:center">
        <div style="font-family:${FONT_STACK};font-size:11px;color:${palette.muted};letter-spacing:.02em">© WorkHub · Sikasio · <a href="${esc(appUrl)}" style="color:${palette.muted};text-decoration:none">${esc(appUrl.replace(/^https?:\/\//, ''))}</a></div>
      </td></tr>
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
  const subject = `[${input.projectName}] ${input.actorName} assigned you to "${input.taskName}"`
  const desc = input.taskDescription?.trim()
  const body = `
    <p>Hi ${esc(input.recipientName)},</p>
    <p><strong>${esc(input.actorName)}</strong> assigned you to a task in <strong>${esc(input.projectName)}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;background:${palette.accentSurface};border:1px solid ${palette.border};border-radius:8px">
      <tr><td style="padding:14px 16px;border-left:3px solid ${palette.primary}">
        <div style="font-size:11px;color:${palette.muted};text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Project</div>
        <div style="font-size:13px;font-weight:600;color:${palette.text};margin-bottom:10px">${esc(input.projectName)}</div>
        <div style="font-size:11px;color:${palette.muted};text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Task</div>
        <div style="font-size:15px;font-weight:600;color:${palette.text}">${esc(input.taskName)}</div>
        ${input.deadline ? `<div style="font-size:12px;color:${palette.muted};margin-top:8px">Deadline: ${esc(input.deadline)}</div>` : ''}
        ${desc ? `<div style="font-size:13px;color:${palette.text};margin-top:10px">${renderMarkdownForEmail(desc, 1500)}</div>` : ''}
      </td></tr>
    </table>`
  const text = `[${input.projectName}] ${input.actorName} assigned you to "${input.taskName}".\n\nOpen: ${url}\n\n${plainFooter()}`
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
  const subject = `[${input.projectName}] ${input.actorName} mentioned you on "${input.taskName}"`
  const body = `
    <p>Hi ${esc(input.recipientName)},</p>
    <p><strong>${esc(input.actorName)}</strong> mentioned you in a comment on <strong>${esc(input.taskName)}</strong> in <strong>${esc(input.projectName)}</strong>.</p>
    <div style="margin:18px 0;padding:12px 16px;border-left:3px solid ${palette.primary};background:${palette.accentSurface};color:${palette.text};font-size:14px;border-radius:6px">${renderMarkdownForEmail(input.commentSnippet, 1200)}</div>
    <p style="font-size:12px;color:${palette.muted};margin:12px 0 0">Project: <strong style="color:${palette.text}">${esc(input.projectName)}</strong> · Task: <strong style="color:${palette.text}">${esc(input.taskName)}</strong></p>`
  const text = `[${input.projectName}] ${input.actorName} mentioned you on "${input.taskName}".\n\n"${input.commentSnippet}"\n\nOpen: ${url}\n\n${plainFooter()}`
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
  const subject = `[${input.projectName}] ${input.actorName} marked "${input.taskName}" as done`
  const body = `
    <p>Hi ${esc(input.recipientName)},</p>
    <p><strong>${esc(input.actorName)}</strong> marked a task as done in <strong>${esc(input.projectName)}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px">
      <tr><td style="padding:14px 16px">
        <div style="font-size:11px;color:#047857;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Project</div>
        <div style="font-size:13px;font-weight:600;color:#064e3b;margin-bottom:10px">${esc(input.projectName)}</div>
        <div style="font-size:11px;color:#047857;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Completed Task</div>
        <div style="font-size:15px;font-weight:600;color:#064e3b">${esc(input.taskName)}</div>
      </td></tr>
    </table>`
  const text = `[${input.projectName}] ${input.actorName} marked "${input.taskName}" as done.\n\nView: ${url}\n\n${plainFooter()}`
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
  const subject = `[${input.projectName}] New question on "${input.taskName}" — needs your answer`
  const body = `
    <p>Hi ${esc(input.recipientName)},</p>
    <p><strong>${esc(input.actorName)}</strong> asked a question on a task in <strong>${esc(input.projectName)}</strong>.</p>
    <div style="margin:18px 0;padding:12px 16px;border-left:3px solid #f59e0b;background:#fffbeb;color:#78350f;font-size:14px;border-radius:6px">${renderMarkdownForEmail(input.question, 1500)}</div>
    <p style="font-size:13px;color:${palette.muted};margin:12px 0 0">Project: <strong style="color:${palette.text}">${esc(input.projectName)}</strong> · Task: <strong style="color:${palette.text}">${esc(input.taskName)}</strong></p>`
  const text = `[${input.projectName}] ${input.actorName} asked a question on "${input.taskName}":\n\n${input.question}\n\nAnswer here: ${url}\n\n${plainFooter()}`
  return {
    subject,
    html: layout({ title: 'A question needs your answer', preheader: subject, body, ctaLabel: 'Answer question', ctaUrl: url }),
    text,
  }
}
