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

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
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

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://workhub.sikasio.com'
}
