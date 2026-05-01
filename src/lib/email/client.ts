import 'server-only'
import nodemailer, { Transporter } from 'nodemailer'

let cachedTransporter: Transporter | null = null

export interface EmailEnv {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

export function getEmailEnv(): EmailEnv | null {
  const host = process.env.ZOHO_MAIL_HOST
  const portRaw = process.env.ZOHO_MAIL_PORT
  const user = process.env.ZOHO_MAIL_USER
  const pass = process.env.ZOHO_MAIL_PASS
  const from = process.env.ZOHO_MAIL_FROM
  if (!host || !portRaw || !user || !pass || !from) return null
  const port = parseInt(portRaw, 10)
  if (!Number.isFinite(port)) return null
  return { host, port, user, pass, from }
}

// HTTP transport selector. Set ZOHO_MAIL_API_URL on platforms that block SMTP
// egress (e.g. Railway) — typical value: https://api.zeptomail.com/v1.1/email
// (or https://api.zeptomail.eu/v1.1/email for EU data center).
export function getHttpApiUrl(): string | null {
  const url = process.env.ZOHO_MAIL_API_URL?.trim()
  return url ? url : null
}

export function getEmailTransport(): 'http' | 'smtp' | null {
  if (getHttpApiUrl()) {
    // HTTP only needs FROM + PASS (used as auth header) to function.
    if (process.env.ZOHO_MAIL_PASS && process.env.ZOHO_MAIL_FROM) return 'http'
  }
  if (getEmailEnv()) return 'smtp'
  return null
}

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter
  const env = getEmailEnv()
  if (!env) return null
  cachedTransporter = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: env.user, pass: env.pass },
  })
  return cachedTransporter
}

// Parse "Name <addr@domain>" or bare "addr@domain".
export function parseFromAddress(from: string): { address: string; name?: string } {
  const m = from.match(/^\s*(.+?)\s*<\s*([^>]+)\s*>\s*$/)
  if (m) return { name: m[1].replace(/^"|"$/g, ''), address: m[2] }
  return { address: from.trim() }
}

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export interface SendEmailResult {
  ok: boolean
  skipped?: boolean
  reason?: string
  messageId?: string
}

async function sendViaHttp(input: SendEmailInput): Promise<SendEmailResult> {
  const apiUrl = getHttpApiUrl()
  const auth = process.env.ZOHO_MAIL_PASS
  const fromRaw = process.env.ZOHO_MAIL_FROM
  if (!apiUrl || !auth || !fromRaw) {
    const reason = `Email HTTP transport not configured — need ZOHO_MAIL_API_URL, ZOHO_MAIL_PASS, ZOHO_MAIL_FROM`
    console.warn('[email]', reason)
    return { ok: false, skipped: true, reason }
  }
  const from = parseFromAddress(fromRaw)
  const recipients = Array.isArray(input.to) ? input.to : [input.to]
  const body: Record<string, unknown> = {
    from: from.name ? { address: from.address, name: from.name } : { address: from.address },
    to: recipients.map((email) => ({ email_address: { address: email } })),
    subject: input.subject,
    htmlbody: input.html,
  }
  if (input.text) body.textbody = input.text
  if (input.replyTo) body.reply_to = [{ address: input.replyTo }]

  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        // ZOHO_MAIL_PASS already includes the "Zoho-enczapikey " prefix,
        // which is exactly what the Authorization header expects.
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      const reason = `HTTP ${resp.status}: ${text.slice(0, 400)}`
      console.error('[email] http send failed', { to: input.to, subject: input.subject, status: resp.status, reason })
      return { ok: false, reason }
    }
    const data = (await resp.json().catch(() => ({}))) as {
      data?: { message_id?: string }[]
      request_id?: string
    }
    const messageId = data.data?.[0]?.message_id || data.request_id
    console.info('[email] sent (http)', { to: input.to, subject: input.subject, messageId })
    return { ok: true, messageId }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] http send failed', { to: input.to, subject: input.subject, reason })
    return { ok: false, reason }
  }
}

async function sendViaSmtp(input: SendEmailInput): Promise<SendEmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    const missing = [
      !process.env.ZOHO_MAIL_HOST && 'ZOHO_MAIL_HOST',
      !process.env.ZOHO_MAIL_PORT && 'ZOHO_MAIL_PORT',
      !process.env.ZOHO_MAIL_USER && 'ZOHO_MAIL_USER',
      !process.env.ZOHO_MAIL_PASS && 'ZOHO_MAIL_PASS',
      !process.env.ZOHO_MAIL_FROM && 'ZOHO_MAIL_FROM',
    ].filter(Boolean)
    const reason = `Email not configured — missing env vars: ${missing.join(', ')}`
    console.warn('[email]', reason)
    return { ok: false, skipped: true, reason }
  }
  const env = getEmailEnv()!
  try {
    const info = await transporter.sendMail({
      from: env.from,
      to: Array.isArray(input.to) ? input.to.join(', ') : input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    })
    console.info('[email] sent', { to: input.to, subject: input.subject, messageId: info.messageId })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] send failed', { to: input.to, subject: input.subject, reason })
    return { ok: false, reason }
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  // HTTP transport takes priority when ZOHO_MAIL_API_URL is set — bypasses
  // SMTP egress filters on platforms like Railway.
  if (getHttpApiUrl()) return sendViaHttp(input)
  return sendViaSmtp(input)
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://workhub.sikasio.com'
}
