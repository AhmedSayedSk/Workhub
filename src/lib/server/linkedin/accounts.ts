import 'server-only'
import * as admin from 'firebase-admin'
import '@/lib/api-auth' // side-effect: ensures admin app initialized

const db = () => admin.firestore()

export interface LinkedInCreds {
  token: string
  authorUrn: string // urn:li:person:{id} (or urn:li:organization:{id} for Pages)
  expiresAt: number // ms; 0 = unknown
}

// LinkedIn connection lives on socialAccounts/{projectId} alongside the Meta creds.
export async function getLinkedInCreds(projectId: string): Promise<LinkedInCreds | null> {
  try {
    const snap = await db().collection('socialAccounts').doc(projectId).get()
    if (!snap.exists) return null
    const a = (snap.data() || {}) as { liToken?: string; liAuthorUrn?: string; liExpiresAt?: number }
    if (!a.liToken || !a.liAuthorUrn) return null
    if (a.liExpiresAt && a.liExpiresAt < Date.now()) return null // token expired — needs reconnect
    return { token: a.liToken, authorUrn: a.liAuthorUrn, expiresAt: a.liExpiresAt || 0 }
  } catch {
    return null
  }
}

export async function getLinkedInStatus(
  projectId: string
): Promise<{ connected: boolean; name?: string; expired?: boolean }> {
  try {
    const snap = await db().collection('socialAccounts').doc(projectId).get()
    const a = (snap.data() || {}) as { liToken?: string; liAuthorUrn?: string; liExpiresAt?: number; liName?: string }
    if (!a.liToken || !a.liAuthorUrn) return { connected: false }
    const expired = !!(a.liExpiresAt && a.liExpiresAt < Date.now())
    return { connected: !expired, name: a.liName, expired }
  } catch {
    return { connected: false }
  }
}

export async function saveLinkedInCreds(
  projectId: string,
  data: { token: string; authorUrn: string; expiresAt: number; name?: string }
): Promise<void> {
  await db()
    .collection('socialAccounts')
    .doc(projectId)
    .set(
      {
        liToken: data.token,
        liAuthorUrn: data.authorUrn,
        liExpiresAt: data.expiresAt,
        liName: data.name || null,
        liConnectedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    )
}

export async function disconnectLinkedIn(projectId: string): Promise<void> {
  await db()
    .collection('socialAccounts')
    .doc(projectId)
    .set(
      {
        liToken: admin.firestore.FieldValue.delete(),
        liAuthorUrn: admin.firestore.FieldValue.delete(),
        liExpiresAt: admin.firestore.FieldValue.delete(),
        liName: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    )
}
