// Container lifecycle control for the ops dashboard: start / stop / restart.
//
// This is the ONLY write path to Docker in the app, and it deliberately does
// NOT reuse the metrics proxy. `docker.ts` talks to a GET-only socket proxy;
// mutating calls go to a second proxy that allows POST on /containers and
// nothing else (no exec, no images, no volumes). Two endpoints means a fault
// or misconfiguration in the control path cannot silently widen what the
// monitoring path is able to do.
//
// DOCKER_CONTROL_URL unset = the feature is off and every call fails closed.

const CONTROL_BASE = process.env.DOCKER_CONTROL_URL || ''
const READ_BASE = process.env.DOCKER_PROXY_URL || 'http://workhub-dockerproxy:2375'

export type ContainerAction = 'start' | 'stop' | 'restart'
export const CONTAINER_ACTIONS: ContainerAction[] = ['start', 'stop', 'restart']

export function isContainerAction(v: unknown): v is ContainerAction {
  return typeof v === 'string' && (CONTAINER_ACTIONS as string[]).includes(v)
}

export type ControlErrorCode =
  | 'not-configured' // no control proxy wired up
  | 'not-found' // no such container on this host
  | 'protected' // refusing to act on the control plane itself
  | 'docker-error' // the daemon rejected it

export class ControlError extends Error {
  constructor(
    public code: ControlErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ControlError'
  }
}

/**
 * Containers the dashboard must never act on, because acting on them destroys
 * the mechanism doing the acting — stop WorkHub and the UI is gone; stop the
 * socket proxy and nothing can be started again. Either one is unrecoverable
 * from this screen and needs SSH to undo, so the button is removed rather than
 * merely warned about.
 *
 * Matching is on the container NAME resolved from the daemon, never on a name
 * supplied by the caller.
 */
export function isProtectedContainer(name: string): boolean {
  const n = name.replace(/^\//, '').toLowerCase()
  const self = (process.env.SELF_CONTAINER_NAME || '').toLowerCase()
  if (self && n === self) return true
  if (n.includes('dockerproxy') || n.includes('docker-socket-proxy')) return true
  if (n === 'workhub' || n.startsWith('workhub-') || n.startsWith('workhub_')) return true
  return false
}

export function protectedReason(name: string): string {
  const n = name.replace(/^\//, '').toLowerCase()
  if (n.includes('dockerproxy') || n.includes('docker-socket-proxy')) {
    return 'This is the Docker proxy the dashboard controls containers through — stopping it would leave nothing able to start it again.'
  }
  return 'This is WorkHub itself — stopping it would take down the dashboard you are using.'
}

interface InspectResponse {
  Name?: string
  State?: { Status?: string; Running?: boolean }
}

/** Resolve a container id to its real name + state via the read-only proxy. */
async function inspect(id: string, timeoutMs = 8000): Promise<{ name: string; state: string }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${READ_BASE}/containers/${encodeURIComponent(id)}/json`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (res.status === 404) throw new ControlError('not-found', 'No such container on this server.')
    if (!res.ok) throw new ControlError('docker-error', `Inspect failed (${res.status}).`)
    const body = (await res.json()) as InspectResponse
    return {
      name: (body.Name || '').replace(/^\//, ''),
      state: body.State?.Status || 'unknown',
    }
  } finally {
    clearTimeout(t)
  }
}

/**
 * Restart is given a longer budget than start/stop: it is a stop followed by a
 * start, and Docker waits out the container's own shutdown grace period first.
 */
const TIMEOUT_MS: Record<ContainerAction, number> = { start: 20_000, stop: 30_000, restart: 45_000 }

async function dockerPost(path: string, timeoutMs: number): Promise<void> {
  if (!CONTROL_BASE) {
    throw new ControlError(
      'not-configured',
      'Container controls are not enabled on this server. Set DOCKER_CONTROL_URL and run the control proxy.'
    )
  }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${CONTROL_BASE}${path}`, {
      method: 'POST',
      signal: ctrl.signal,
      cache: 'no-store',
    })
    // 204 = done. 304 = already in that state, which is the desired end state
    // anyway, so treat the call as idempotent rather than surfacing an error.
    if (res.status === 204 || res.status === 304) return
    if (res.status === 404) throw new ControlError('not-found', 'No such container on this server.')
    const detail = await res.text().catch(() => '')
    throw new ControlError('docker-error', `Docker refused the request (${res.status}). ${detail}`.trim())
  } finally {
    clearTimeout(t)
  }
}

export interface ControlResult {
  name: string
  action: ContainerAction
  previousState: string
}

/**
 * Run a lifecycle action against one container. The name and state are read
 * back from the daemon first, so the protection check and the audit trail both
 * describe what was really touched rather than what the caller claimed.
 */
export async function runContainerAction(id: string, action: ContainerAction): Promise<ControlResult> {
  const { name, state } = await inspect(id)
  if (isProtectedContainer(name)) {
    throw new ControlError('protected', protectedReason(name))
  }
  await dockerPost(`/containers/${encodeURIComponent(id)}/${action}`, TIMEOUT_MS[action])
  return { name, action, previousState: state }
}

/** Whether this deployment can control containers at all. */
export function isControlEnabled(): boolean {
  return !!CONTROL_BASE
}
