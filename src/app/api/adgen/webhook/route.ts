import '@/lib/api-auth' // side-effect: initialises firebase-admin
import { handleAdgenWebhook } from '@/lib/renderMirror'
import { renderJobMirror } from '@/lib/server/renderJobMirror'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Render-progress webhook. NOT session-authenticated — the caller is the
// campaign service, not a browser. Authenticity comes from the HMAC signature
// over the raw body (see `verifyAdgenSignature`); an unsigned or stale delivery
// is rejected before anything is read from it.
//
// Everything below is deliberately in `@/lib/renderMirror`, which takes a plain
// `Request` and returns a plain `Response` so it can be tested without a
// framework or a live Firestore.
export async function POST(request: Request): Promise<Response> {
  return handleAdgenWebhook(request, { store: renderJobMirror.store })
}
