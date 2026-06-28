import 'server-only'
import { liFetch, LinkedInError } from './client'
import type { LinkedInCreds } from './accounts'

interface PublishInput {
  text: string
  mediaUrl?: string | null
  mediaType?: 'none' | 'image' | 'video'
}

/** Publish a post to LinkedIn (member or org, by author URN). Returns the post URN. */
export async function publish(creds: LinkedInCreds, input: PublishInput): Promise<string> {
  const body: Record<string, unknown> = {
    author: creds.authorUrn,
    commentary: input.text || '',
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  if (input.mediaUrl && input.mediaType === 'image') {
    const imageUrn = await uploadImage(creds, input.mediaUrl)
    body.content = { media: { id: imageUrn, altText: (input.text || 'image').slice(0, 200) } }
  }

  const res = await liFetch(creds.token, '/rest/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new LinkedInError(res.status, `LinkedIn post failed (${res.status}): ${t.slice(0, 300)}`)
  }
  return res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || 'posted'
}

// LinkedIn images are a 3-step upload: initialize → PUT the bytes → reference the URN.
async function uploadImage(creds: LinkedInCreds, mediaUrl: string): Promise<string> {
  const initRes = await liFetch(creds.token, '/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initializeUploadRequest: { owner: creds.authorUrn } }),
  })
  const init = await initRes.json().catch(() => ({}))
  if (!initRes.ok) throw new LinkedInError(initRes.status, `Image init failed: ${JSON.stringify(init).slice(0, 200)}`)
  const uploadUrl: string | undefined = init?.value?.uploadUrl
  const imageUrn: string | undefined = init?.value?.image
  if (!uploadUrl || !imageUrn) throw new LinkedInError(500, 'LinkedIn did not return an upload URL')

  const bytes = await (await fetch(mediaUrl)).arrayBuffer()
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${creds.token}` },
    body: Buffer.from(bytes),
  })
  if (!put.ok) throw new LinkedInError(put.status, 'LinkedIn image upload failed')
  return imageUrn
}
