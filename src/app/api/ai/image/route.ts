import { NextRequest, NextResponse } from 'next/server'

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

      // Use preferred email, but skip when references are attached (they're tied to a specific account)
      const hasReferences = body.references && Array.isArray(body.references) && body.references.length > 0
      let initialEmail: string | undefined = email || (!hasReferences ? body.preferredEmail : undefined) || undefined

      // If no email chosen yet, and there are disabled emails, we must pick an enabled one
      // to prevent useapi.net from auto-selecting a disabled account
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

      // First attempt
      const res = await fetch(`${USEAPI_BASE}/images`, {
        method: 'POST',
        headers: { ...authHeader(apiToken), 'Content-Type': 'application/json' },
        body: JSON.stringify(buildReqBody(initialEmail)),
      })

      const data = await res.json()

      // On 403 (captcha/blocked) or 429 (rate limit), try switching to another account
      if ((res.status === 403 || res.status === 429) && !email) {
        const failedEmail = data?.email || data?.jobId?.match(/email:([^-]+)/)?.[1] || ''
        console.log(`Account ${failedEmail} failed (${res.status}), trying fallback...`)

        try {
          // Fetch all accounts and find a healthy alternative
          const accountsRes = await fetch(`${USEAPI_BASE}/accounts`, {
            headers: authHeader(apiToken),
          })
          if (accountsRes.ok) {
            const accountsData = await accountsRes.json()
            const emails = Object.entries(accountsData)
              .filter(([acctEmail, info]) => {
                const acc = info as Record<string, unknown>
                return acctEmail !== failedEmail && acc.health === 'OK' && !disabledEmails.includes(acctEmail)
              })
              .map(([acctEmail]) => acctEmail)

            if (emails.length > 0) {
              console.log(`Retrying with fallback account: ${emails[0]}`)
              const retryRes = await fetch(`${USEAPI_BASE}/images`, {
                method: 'POST',
                headers: { ...authHeader(apiToken), 'Content-Type': 'application/json' },
                body: JSON.stringify(buildReqBody(emails[0])),
              })
              const retryData = await retryRes.json()
              if (retryRes.ok) {
                // Fallback succeeded — return this instead
                const images = (retryData.media || [])
                  .filter((item: Record<string, unknown>) => item?.image)
                  .map((item: { image: { generatedImage: { fifeUrl: string; seed?: number; mediaGenerationId?: string } } }) => ({
                    url: item.image.generatedImage.fifeUrl,
                    seed: item.image.generatedImage.seed,
                    mediaGenerationId: item.image.generatedImage.mediaGenerationId,
                  }))
                if (images.length > 0) {
                  return NextResponse.json({
                    success: true,
                    data: { images, jobId: retryData.jobId, fallbackEmail: emails[0] },
                  })
                }
              }
              console.log(`Fallback account ${emails[0]} also failed (${retryRes.status})`)
            }
          }
        } catch (err) {
          console.error('Fallback account lookup failed:', err)
        }

        // Both accounts failed — return original error with helpful message
        const errMsg = data?.error?.message || data?.error || ''
        const isReCaptcha = typeof errMsg === 'string' && errMsg.includes('reCAPTCHA')
        const is429 = res.status === 429
        return NextResponse.json({
          success: false,
          error: isReCaptcha
            ? 'All accounts blocked by Google reCAPTCHA. Try again later or register a fresh Google account.'
            : is429
              ? 'All accounts are rate limited. Wait a few minutes or try a different model.'
              : errMsg || `Request failed (${res.status})`,
          failedEmail,
        }, { status: res.status })
      }

      if (!res.ok) {
        console.error('useapi.net generate error:', res.status, data)
        return errorResponse(res.status, data)
      }

      const images = (data.media || [])
        .filter((item: Record<string, unknown>) => item?.image)
        .map((item: { image: { generatedImage: { fifeUrl: string; seed?: number; mediaGenerationId?: string } } }) => ({
          url: item.image.generatedImage.fifeUrl,
          seed: item.image.generatedImage.seed,
          mediaGenerationId: item.image.generatedImage.mediaGenerationId,
        }))

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

    // Upload asset (reference image)
    if (action === 'upload_asset') {
      const { asset, email } = body // asset: base64 data URL, email: optional account
      if (!asset) {
        return NextResponse.json({ success: false, error: 'Asset data is required' }, { status: 400 })
      }

      // Parse data URL → binary buffer + content type
      const match = (asset as string).match(/^data:(image\/[\w+]+);base64,(.+)$/)
      if (!match) {
        return NextResponse.json({ success: false, error: 'Invalid image data. Expected base64 data URL.' }, { status: 400 })
      }
      const mimeType = match[1]
      const buffer = Buffer.from(match[2], 'base64')

      // POST /assets/{email} — email is optional for auto-selection
      const assetUrl = email
        ? `${USEAPI_BASE}/assets/${encodeURIComponent(email)}`
        : `${USEAPI_BASE}/assets/`

      const res = await fetch(assetUrl, {
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

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error('Image API error:', error)
    const message = error instanceof Error ? error.message : 'Request failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
