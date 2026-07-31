import { NextRequest, NextResponse } from 'next/server'
import { requireModule } from '@/lib/api-auth'
import { credentialRejection, handleImageAction, imageGenConfigured } from '@/lib/imageGen'

// Account registration can take 30-60s+ (session setup).
export const maxDuration = 120
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Image generation (`generate`) and its two companions run on our own image
// service — see `@/lib/imageGen`, which holds the whole contract and every
// browser-visible string. The credential comes from the environment and the
// browser never sees or sends one.
//
// The account actions below are a separate, older integration that still has
// its own server-held token. They are deliberately untouched by this route's
// migration and are being retired separately.

const LEGACY_BASE = 'https://api.useapi.net/v1/google-flow'

function legacyToken(): string | null {
  const token = (process.env.USEAPI_TOKEN || '').trim()
  return token || null
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

/** Flat, neutral failure for the account actions. Upstream text is never relayed. */
function legacyError(status: number) {
  const message =
    status === 401 || status === 403
      ? 'Account management is not configured on this server.'
      : status === 404
        ? 'That account was not found.'
        : status === 429
          ? 'Too many requests. Wait a moment and try again.'
          : 'The account service failed. Please retry.'
  return NextResponse.json({ success: false, error: message }, { status })
}

const NOT_CONFIGURED = 'Account management is not configured on this server.'

/**
 * Registration failures are worth classifying — the operator needs to know
 * whether to fetch fresh cookies. The upstream text is read for the decision
 * and discarded; only the fixed strings below are ever returned.
 */
async function registerError(res: Response) {
  let detail = ''
  try { detail = await res.text() } catch {}
  if (/oauth stuck|validate cookies|invalid.{0,20}cookie/i.test(detail)) {
    return NextResponse.json({
      success: false,
      error: 'The session cookies were rejected. Sign in again in a fresh browser session and copy the cookies once more.',
    }, { status: res.status })
  }
  if (/captcha/i.test(detail)) {
    return NextResponse.json({
      success: false,
      error: 'A captcha challenge blocked the sign-in. Wait a few minutes, then try again.',
    }, { status: res.status })
  }
  if (/expired|session/i.test(detail)) {
    return NextResponse.json({
      success: false,
      error: 'That session has expired. Sign in again and copy fresh cookies.',
    }, { status: res.status })
  }
  return legacyError(res.status)
}

// GET — status, accounts, captcha providers, account job stats
export async function GET(request: NextRequest) {
  try {
    const authError = await requireModule(request, 'accessImageGenerator')
    if (authError) return authError

    const { searchParams } = new URL(request.url)

    // A credential in the URL lands in access logs and Referer headers. Refuse
    // it outright so an un-migrated caller fails loudly here, not silently later.
    const rejected = credentialRejection({ query: searchParams })
    if (rejected) return NextResponse.json(rejected.body, { status: rejected.status })

    const action = searchParams.get('action')

    // What the server can do — booleans only, never a credential.
    if (action === 'status') {
      return NextResponse.json({
        success: true,
        data: { managed: !!legacyToken(), imageGen: imageGenConfigured() },
      })
    }

    const token = legacyToken()
    if (!token) {
      return NextResponse.json({ success: false, error: NOT_CONFIGURED }, { status: 400 })
    }

    const path =
      action === 'accounts'
        ? '/accounts'
        : action === 'captcha-providers'
          ? '/accounts/captcha-providers'
          : action === 'jobs'
            ? `/jobs/?options=${encodeURIComponent(searchParams.get('options') || 'history')}`
            : null

    if (!path) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    const res = await fetch(`${LEGACY_BASE}${path}`, { headers: authHeader(token) })
    if (!res.ok) return legacyError(res.status)
    return NextResponse.json({ success: true, data: await res.json() })
  } catch {
    return NextResponse.json({ success: false, error: 'Request failed. Please retry.' }, { status: 500 })
  }
}

// POST — generate images, plus the account actions
export async function POST(request: NextRequest) {
  try {
    const authError = await requireModule(request, 'accessImageGenerator')
    if (authError) return authError

    const body = await request.json().catch(() => ({}))
    const { searchParams } = new URL(request.url)

    const rejected = credentialRejection({ body, query: searchParams })
    if (rejected) return NextResponse.json(rejected.body, { status: rejected.status })

    const { action } = body

    // generate / upscale / upload_asset — owned by the image service.
    const handled = await handleImageAction(action, body)
    if (handled) return NextResponse.json(handled.body, { status: handled.status })

    // ── Account actions (legacy integration, server-held token) ─────────────
    const token = legacyToken()
    if (!token) {
      return NextResponse.json({ success: false, error: NOT_CONFIGURED }, { status: 400 })
    }

    if (action === 'register_account') {
      const { cookies } = body
      if (!cookies) {
        return NextResponse.json({ success: false, error: 'Session cookies are required' }, { status: 400 })
      }
      const res = await fetch(`${LEGACY_BASE}/accounts`, {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies }),
      })
      if (!res.ok) return registerError(res)
      return NextResponse.json({ success: true, data: await res.json() })
    }

    if (action === 'delete_account') {
      const { email } = body
      if (!email) {
        return NextResponse.json({ success: false, error: 'An account is required' }, { status: 400 })
      }
      const res = await fetch(`${LEGACY_BASE}/accounts/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: authHeader(token),
      })
      if (!res.ok) return legacyError(res.status)
      return NextResponse.json({ success: true, data: await res.json() })
    }

    if (action === 'set_captcha_providers') {
      const { providers } = body
      if (!providers || typeof providers !== 'object') {
        return NextResponse.json({ success: false, error: 'Providers are required' }, { status: 400 })
      }
      const res = await fetch(`${LEGACY_BASE}/accounts/captcha-providers`, {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(providers),
      })
      if (!res.ok) return legacyError(res.status)
      return NextResponse.json({ success: true, data: await res.json() })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ success: false, error: 'Request failed. Please retry.' }, { status: 500 })
  }
}
