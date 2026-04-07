import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

// Account registration can take 30-60s+ (Google session setup)
export const maxDuration = 120

const USEAPI_BASE = 'https://api.useapi.net/v1/google-flow'

function authHeader(token: string) {
  return { 'Authorization': `Bearer ${token}` }
}

const ERROR_MAP: Record<number, string> = {
  400: 'Bad request. Check your prompt or model selection.',
  401: 'Invalid API token. Check your useapi.net token in settings.',
  402: 'useapi.net subscription expired. Renew at useapi.net.',
  403: 'reCAPTCHA challenge failed. Try again.',
  404: 'Account not found. Register a Google account first.',
  429: 'Rate limit exceeded. Wait a moment and try again.',
  500: 'Content was blocked by moderation. Try a different prompt.',
  503: 'Service temporarily unavailable. Try again later.',
  596: 'Google session expired. Re-register your Google account cookies.',
}

function errorResponse(status: number, data?: Record<string, unknown>) {
  const errorObj = data?.error
  let detail = ''
  if (typeof errorObj === 'string') {
    detail = errorObj
  } else if (typeof errorObj === 'object' && errorObj !== null) {
    const err = errorObj as Record<string, unknown>
    const reason = err.reason as string || ''
    detail = (err.message as string) || ''
    // Include reason for rate limit errors so client can distinguish quota vs throttle
    if (reason) detail = `${detail} [${reason}]`
  }
  if (!detail) detail = (data?.message || data?.detail || '') as string
  const message = detail || ERROR_MAP[status] || `Request failed (${status})`
  return NextResponse.json({ success: false, error: message }, { status })
}

async function proxyError(res: Response) {
  let detail = ''
  try { detail = await res.text() } catch {}
  const message = ERROR_MAP[res.status] || detail || `Request failed (${res.status})`
  return NextResponse.json({ success: false, error: message }, { status: res.status })
}

// GET — list accounts or jobs
export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuth(request)
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const apiToken = searchParams.get('token')

    if (!apiToken) {
      return NextResponse.json({ success: false, error: 'No API token' }, { status: 400 })
    }

    if (action === 'accounts') {
      const res = await fetch(`${USEAPI_BASE}/accounts`, {
        headers: authHeader(apiToken),
      })
      if (!res.ok) return proxyError(res)
      const data = await res.json()
      return NextResponse.json({ success: true, data })
    }

    if (action === 'captcha-providers') {
      const res = await fetch(`${USEAPI_BASE}/accounts/captcha-providers`, {
        headers: authHeader(apiToken),
      })
      if (!res.ok) return proxyError(res)
      const data = await res.json()
      return NextResponse.json({ success: true, data })
    }

    if (action === 'jobs') {
      const options = searchParams.get('options') || 'history'
      const res = await fetch(`${USEAPI_BASE}/jobs/?options=${options}`, {
        headers: authHeader(apiToken),
      })
      if (!res.ok) return proxyError(res)
      const data = await res.json()
      return NextResponse.json({ success: true, data })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// POST — generate, register account, delete account, upload asset, upscale
export async function POST(request: NextRequest) {
  try {
    const authError = await requireAuth(request)
    if (authError) return authError

    const body = await request.json()
    const { action, apiToken } = body

    if (!apiToken) {
      return NextResponse.json(
        { success: false, error: 'No API token configured. Add your useapi.net token in settings.' },
        { status: 400 }
      )
    }

    // Generate images
    if (action === 'generate') {
      const { prompt, aspectRatio, model, count, seed, email } = body
      if (!prompt) {
        return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 })
      }
      if (!model) {
        return NextResponse.json({ success: false, error: 'No model selected. Choose a model in settings.' }, { status: 400 })
      }

      const disabledEmails: string[] = body.disabledEmails || []

      const buildReqBody = (targetEmail?: string) => {
        const reqBody: Record<string, unknown> = {
          prompt, model,
          count: count || 1,
          captchaRetry: 5,
        }
        if (aspectRatio && aspectRatio !== 'square') {
          reqBody.aspectRatio = aspectRatio
        }
        if (seed !== undefined) reqBody.seed = seed
        if (targetEmail) reqBody.email = targetEmail
        else if (email) reqBody.email = email
        if (body.references && Array.isArray(body.references)) {
          body.references.forEach((ref: string, i: number) => {
            if (i < 10) reqBody[`reference_${i + 1}`] = ref
          })
        }
        return reqBody
      }

      const parseImages = (responseData: Record<string, unknown>) => {
        return ((responseData.media || []) as Record<string, unknown>[])
          .filter((item) => item?.image)
          .map((item: unknown) => {
            const typed = item as { image: { generatedImage: { fifeUrl: string; seed?: number; mediaGenerationId?: string } } }
            return {
              url: typed.image.generatedImage.fifeUrl,
              seed: typed.image.generatedImage.seed,
              mediaGenerationId: typed.image.generatedImage.mediaGenerationId,
            }
          })
      }

      // Always use preferred email when set
      let initialEmail: string | undefined = email || body.preferredEmail || undefined

      // If no email chosen yet, and there are disabled emails, we must pick an enabled one
      if (!initialEmail && disabledEmails.length > 0) {
        try {
          const accsRes = await fetch(`${USEAPI_BASE}/accounts`, { headers: authHeader(apiToken) })
          if (accsRes.ok) {
            const accsData = await accsRes.json()
            initialEmail = Object.keys(accsData).find(e => !disabledEmails.includes(e))
            if (!initialEmail) {
              return NextResponse.json({ success: false, error: 'All accounts are disabled. Enable at least one in the Accounts tab.' }, { status: 400 })
            }
          }
        } catch {}
      }

      const reqPayload = buildReqBody(initialEmail)
      const res = await fetch(`${USEAPI_BASE}/images`, {
        method: 'POST',
        headers: { ...authHeader(apiToken), 'Content-Type': 'application/json' },
        body: JSON.stringify(reqPayload),
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('useapi.net generate error:', res.status, JSON.stringify(data))
        // Include the email that was actually used in the error response
        const usedEmail = data?.email || reqPayload.email || ''
        const baseError = errorResponse(res.status, data)
        const errorBody = await baseError.json()
        return NextResponse.json({ ...errorBody, usedEmail }, { status: baseError.status })
      }

      const images = parseImages(data)

      if (images.length === 0) {
        return NextResponse.json({ success: false, error: 'No images generated. Try a different prompt.' }, { status: 422 })
      }

      return NextResponse.json({ success: true, data: { images, jobId: data.jobId } })
    }

    // Register account
    if (action === 'register_account') {
      const { cookies } = body
      if (!cookies) {
        return NextResponse.json({ success: false, error: 'Cookies are required' }, { status: 400 })
      }

      const res = await fetch(`${USEAPI_BASE}/accounts`, {
        method: 'POST',
        headers: { ...authHeader(apiToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies }),
      })

      const data = await res.json()
      if (!res.ok) {
        return errorResponse(res.status, data)
      }

      return NextResponse.json({ success: true, data })
    }

    // Delete account
    if (action === 'delete_account') {
      const { email } = body
      if (!email) {
        return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })
      }

      const res = await fetch(`${USEAPI_BASE}/accounts/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: authHeader(apiToken),
      })

      if (!res.ok) return proxyError(res)
      const data = await res.json()
      return NextResponse.json({ success: true, data })
    }

    // Upscale image
    if (action === 'upscale') {
      const { mediaGenerationId, resolution } = body
      if (!mediaGenerationId) {
        return NextResponse.json({ success: false, error: 'mediaGenerationId is required' }, { status: 400 })
      }

      const res = await fetch(`${USEAPI_BASE}/images/upscale`, {
        method: 'POST',
        headers: { ...authHeader(apiToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaGenerationId, resolution: resolution || '2k' }),
      })

      const data = await res.json()
      if (!res.ok) {
        console.error('useapi.net upscale error:', res.status, data)
        return errorResponse(res.status, data)
      }
      return NextResponse.json({ success: true, data })
    }

    // Configure captcha providers
    if (action === 'set_captcha_providers') {
      const { providers } = body
      if (!providers || typeof providers !== 'object') {
        return NextResponse.json({ success: false, error: 'Providers object is required' }, { status: 400 })
      }

      const res = await fetch(`${USEAPI_BASE}/accounts/captcha-providers`, {
        method: 'POST',
        headers: { ...authHeader(apiToken), 'Content-Type': 'application/json' },
        body: JSON.stringify(providers),
      })

      const data = await res.json()
      if (!res.ok) {
        return errorResponse(res.status, data)
      }
      return NextResponse.json({ success: true, data })
    }

    // Upload asset (reference image) — uploads to ALL registered accounts
    if (action === 'upload_asset') {
      const { asset } = body
      if (!asset) {
        return NextResponse.json({ success: false, error: 'Asset data is required' }, { status: 400 })
      }

      const match = (asset as string).match(/^data:(image\/[\w+]+);base64,(.+)$/)
      if (!match) {
        return NextResponse.json({ success: false, error: 'Invalid image data. Expected base64 data URL.' }, { status: 400 })
      }
      const mimeType = match[1]
      const buffer = Buffer.from(match[2], 'base64')

      // Fetch all accounts to upload to each one
      let emails: string[] = []
      try {
        const accsRes = await fetch(`${USEAPI_BASE}/accounts`, { headers: authHeader(apiToken) })
        if (accsRes.ok) {
          const accsData = await accsRes.json()
          emails = Object.keys(accsData)
        }
      } catch {}

      if (emails.length === 0) {
        // Fallback: upload without specifying email (auto-select)
        const res = await fetch(`${USEAPI_BASE}/assets/`, {
          method: 'POST',
          headers: { ...authHeader(apiToken), 'Content-Type': mimeType },
          body: buffer,
        })
        const data = await res.json()
        if (!res.ok) {
          console.error('useapi.net asset upload error:', res.status, data)
          return errorResponse(res.status, data)
        }
        return NextResponse.json({ success: true, data })
      }

      // Upload to all accounts in parallel
      const results = await Promise.allSettled(
        emails.map(async (email) => {
          const res = await fetch(`${USEAPI_BASE}/assets/${encodeURIComponent(email)}`, {
            method: 'POST',
            headers: { ...authHeader(apiToken), 'Content-Type': mimeType },
            body: buffer,
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error || `Upload failed for ${email}`)
          return { email, data }
        })
      )

      // Find at least one success
      const successes = results.filter((r): r is PromiseFulfilledResult<{ email: string; data: Record<string, unknown> }> => r.status === 'fulfilled')
      if (successes.length === 0) {
        const firstErr = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
        return NextResponse.json({ success: false, error: firstErr?.reason?.message || 'Failed to upload to any account' }, { status: 500 })
      }

      // Return per-account mediaGenerationIds
      const perAccount: Record<string, string> = {}
      for (const s of successes) {
        const mgId = (s.value.data as any)?.mediaGenerationId?.mediaGenerationId
          || (s.value.data as any)?.mediaGenerationId
        if (mgId) perAccount[s.value.email] = mgId as string
      }
      return NextResponse.json({ success: true, data: successes[0].value.data, perAccount })
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error('Image API error:', error)
    const message = error instanceof Error ? error.message : 'Request failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
