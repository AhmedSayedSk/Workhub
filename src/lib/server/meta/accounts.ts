import 'server-only'
import * as admin from 'firebase-admin'
import '@/lib/api-auth' // side-effect: ensures admin app initialized
import type { MetaCreds } from './client'

const db = () => admin.firestore()

/**
 * Resolve a project's Meta credentials from `socialAccounts/{projectId}`, merged over
 * the global env defaults. Returns null when the project has no configured account —
 * the caller then publishes with the env defaults (metaEnv()).
 */
export async function getAccountCreds(projectId: string): Promise<MetaCreds | null> {
  try {
    const snap = await db().collection('socialAccounts').doc(projectId).get()
    if (!snap.exists) return null
    const a = (snap.data() || {}) as { token?: string; pageId?: string; igUserId?: string; adAccountId?: string }
    return {
      token: a.token || process.env.META_SYSTEM_TOKEN || '',
      pageId: a.pageId || process.env.META_PAGE_ID || '',
      igUserId: a.igUserId || process.env.META_IG_USER_ID || '',
      adAccountId: a.adAccountId || process.env.META_AD_ACCOUNT_ID || '',
    }
  } catch {
    return null
  }
}
