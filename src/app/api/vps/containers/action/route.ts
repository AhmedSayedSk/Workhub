import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { isOwnerRequest } from '@/lib/server/vps/owner'
import { verifyAuth } from '@/lib/api-auth'
import { getServer } from '@/lib/server/vps/servers'
import { runContainerAction, isContainerAction, ControlError } from '@/lib/server/vps/control'

// Owner-only container lifecycle control (start / stop / restart).
//
// The only mutating route under /api/vps. Everything else in this tree reads.
export const dynamic = 'force-dynamic'

const STATUS: Record<string, number> = {
  'not-configured': 503,
  'not-found': 404,
  protected: 403,
  'docker-error': 502,
}

/** Best-effort audit trail; a logging failure must not fail the action itself. */
async function record(
  actor: { uid: string | null; email: string },
  serverId: string,
  detail: Record<string, unknown>
) {
  if (!admin.apps.length) return
  try {
    await admin
      .firestore()
      .collection('auditLogs')
      .add({
        type: 'server',
        action: `container_${detail.action}`,
        actorUid: actor.uid,
        actorEmail: actor.email,
        targetId: detail.containerId,
        targetName: detail.name,
        details: { serverId, ...detail },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
  } catch {
    /* the action already happened — losing the log entry must not report failure */
  }
}

export async function POST(request: NextRequest) {
  if (!(await isOwnerRequest(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { serverId?: string; containerId?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { serverId = 'primary', containerId, action } = body
  if (!containerId || typeof containerId !== 'string') {
    return NextResponse.json({ error: 'containerId is required.' }, { status: 400 })
  }
  if (!isContainerAction(action)) {
    return NextResponse.json({ error: 'action must be start, stop or restart.' }, { status: 400 })
  }

  const server = getServer(serverId)
  if (!server) return NextResponse.json({ error: 'Unknown server.' }, { status: 404 })

  // Remote servers report inbound only — the agent pushes to us and we have no
  // channel back to it, so there is nothing to send a command down. Answering
  // 501 rather than 403 keeps the distinction honest: not forbidden, not built.
  if (server.mode !== 'local') {
    return NextResponse.json(
      { error: 'Container controls are only available on the local server. Remote servers report metrics one-way.' },
      { status: 501 }
    )
  }

  const decoded = await verifyAuth(request)
  const actor = { uid: decoded?.uid ?? null, email: decoded?.email ?? '' }

  try {
    const result = await runContainerAction(containerId, action)
    await record(actor, serverId, {
      action,
      containerId,
      name: result.name,
      previousState: result.previousState,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof ControlError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] ?? 500 })
    }
    const message = err instanceof Error ? err.message : String(err)
    // An aborted fetch is our own timeout, not a daemon failure — the action may
    // still be completing on the host, so say that rather than "failed".
    const timedOut = /abort/i.test(message)
    return NextResponse.json(
      {
        error: timedOut
          ? 'The request timed out. The container may still be changing state — refresh in a moment.'
          : message,
      },
      { status: timedOut ? 504 : 500 }
    )
  }
}
