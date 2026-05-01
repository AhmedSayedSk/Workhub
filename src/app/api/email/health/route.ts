import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { verifyAuth } from '@/lib/api-auth'
import { getEmailEnv, getAppUrl, getHttpApiUrl, getEmailTransport } from '@/lib/email/client'

// Constant-time comparison.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function authorize(request: NextRequest): Promise<boolean> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const internal = process.env.INTERNAL_API_TOKEN
  if (internal && safeEqual(token, internal)) return true
  const decoded = await verifyAuth(request)
  return !!decoded
}

// Mask credentials so they never leak to the response body.
function mask(value: string | undefined, opts?: { keepEnd?: number }): string | null {
  if (!value) return null
  const keep = opts?.keepEnd ?? 4
  if (value.length <= keep) return '*'.repeat(value.length)
  return '*'.repeat(value.length - keep) + value.slice(-keep)
}

type ProbeResult =
  | { attempted: false; reason: string }
  | { attempted: true; ok: true; durationMs: number; status?: number }
  | { attempted: true; ok: false; durationMs: number; reason: string; code?: string; status?: number }

interface HealthReport {
  appUrl: string
  transport: 'http' | 'smtp' | null
  vars: {
    ZOHO_MAIL_HOST: string | null
    ZOHO_MAIL_PORT: string | null
    ZOHO_MAIL_USER: string | null
    ZOHO_MAIL_PASS: string | null // masked
    ZOHO_MAIL_FROM: string | null
    ZOHO_MAIL_API_URL: string | null
    NEXT_PUBLIC_APP_URL: string | null
    INTERNAL_API_TOKEN: string | null // masked
    ADMIN_CONTACT_EMAIL: string | null
  }
  missing: string[]
  smtp: ProbeResult
  http: ProbeResult
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthReport>> {
  // Auth required: this endpoint reveals env-var presence and runs an SMTP probe,
  // so an unauthenticated caller could enumerate config or trigger outbound traffic.
  const ok = await authorize(request)
  if (!ok) {
    return NextResponse.json(
      {
        appUrl: getAppUrl(),
        transport: null,
        vars: {
          ZOHO_MAIL_HOST: null,
          ZOHO_MAIL_PORT: null,
          ZOHO_MAIL_USER: null,
          ZOHO_MAIL_PASS: null,
          ZOHO_MAIL_FROM: null,
          ZOHO_MAIL_API_URL: null,
          NEXT_PUBLIC_APP_URL: null,
          INTERNAL_API_TOKEN: null,
          ADMIN_CONTACT_EMAIL: null,
        },
        missing: [],
        smtp: { attempted: false, reason: 'unauthorized' },
        http: { attempted: false, reason: 'unauthorized' },
      },
      { status: 401 },
    )
  }

  const env = getEmailEnv()
  const httpUrl = getHttpApiUrl()
  const required = ['ZOHO_MAIL_HOST', 'ZOHO_MAIL_PORT', 'ZOHO_MAIL_USER', 'ZOHO_MAIL_PASS', 'ZOHO_MAIL_FROM']
  const missing = required.filter((k) => !process.env[k])

  const report: HealthReport = {
    appUrl: getAppUrl(),
    transport: getEmailTransport(),
    vars: {
      ZOHO_MAIL_HOST: process.env.ZOHO_MAIL_HOST || null,
      ZOHO_MAIL_PORT: process.env.ZOHO_MAIL_PORT || null,
      ZOHO_MAIL_USER: process.env.ZOHO_MAIL_USER || null,
      ZOHO_MAIL_PASS: mask(process.env.ZOHO_MAIL_PASS),
      ZOHO_MAIL_FROM: process.env.ZOHO_MAIL_FROM || null,
      ZOHO_MAIL_API_URL: process.env.ZOHO_MAIL_API_URL || null,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || null,
      INTERNAL_API_TOKEN: mask(process.env.INTERNAL_API_TOKEN),
      ADMIN_CONTACT_EMAIL: process.env.ADMIN_CONTACT_EMAIL || null,
    },
    missing,
    smtp: { attempted: false, reason: missing.length ? 'missing env vars' : 'skipped (HTTP transport active)' },
    http: { attempted: false, reason: 'ZOHO_MAIL_API_URL not set' },
  }

  // Probe HTTP transport when configured. Sends a malformed payload to the
  // ZeptoMail endpoint — any HTTP response (even 4xx) confirms reachability +
  // auth wiring. Network failure (ETIMEDOUT etc.) means egress is blocked.
  if (httpUrl) {
    const started = Date.now()
    try {
      const resp = await fetch(httpUrl, {
        method: 'POST',
        headers: {
          Authorization: process.env.ZOHO_MAIL_PASS || '',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ probe: true }), // intentionally invalid → expect 400
        signal: AbortSignal.timeout(10_000),
      })
      const duration = Date.now() - started
      // 200..299 means the server processed it (unexpected); 400/422 = reached the API and auth was checked.
      // 401/403 = auth rejected. Any non-network response means egress is fine.
      const reachable = resp.status > 0
      if (resp.status === 401 || resp.status === 403) {
        const text = await resp.text().catch(() => '')
        report.http = {
          attempted: true,
          ok: false,
          durationMs: duration,
          status: resp.status,
          reason: `auth rejected: ${text.slice(0, 200)}`,
        }
      } else if (reachable) {
        report.http = { attempted: true, ok: true, durationMs: duration, status: resp.status }
      } else {
        report.http = { attempted: true, ok: false, durationMs: duration, status: resp.status, reason: 'no response' }
      }
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string; name?: string }
      report.http = {
        attempted: true,
        ok: false,
        durationMs: Date.now() - started,
        reason: e.message || e.name || 'unknown',
        code: e.code,
      }
    }
  }

  // Probe SMTP if no HTTP transport is configured (otherwise SMTP probe is wasted on a blocked port).
  if (env && !httpUrl) {
    const started = Date.now()
    const transporter = nodemailer.createTransport({
      host: env.host,
      port: env.port,
      secure: env.port === 465,
      auth: { user: env.user, pass: env.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    })
    try {
      await transporter.verify()
      report.smtp = { attempted: true, ok: true, durationMs: Date.now() - started }
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string }
      report.smtp = {
        attempted: true,
        ok: false,
        durationMs: Date.now() - started,
        reason: e.message || 'unknown',
        code: e.code,
      }
    }
  }

  return NextResponse.json(report)
}
