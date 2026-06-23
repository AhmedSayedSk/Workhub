'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Facebook,
  Instagram,
  Loader2,
  Paperclip,
  Send,
  CalendarClock,
  AlertCircle,
  RefreshCw,
  X,
  Play,
  ImageOff,
} from 'lucide-react'
import type { Project, SocialMediaType, SocialPlatform, SocialPost, SocialPostStatus } from '@/types'
import { socialPosts } from '@/lib/firestore'
import { uploadSocialMedia } from '@/lib/storage'
import { authFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type Mode = 'now' | 'schedule'

const STATUS_GROUPS: { status: SocialPostStatus; label: string }[] = [
  { status: 'scheduled', label: 'Scheduled' },
  { status: 'published', label: 'Published' },
  { status: 'failed', label: 'Failed' },
  { status: 'draft', label: 'Draft' },
]

function mediaTypeFor(file: File): SocialMediaType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return 'none'
}

function statusBadgeVariant(status: SocialPostStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'published':
      return 'default'
    case 'failed':
      return 'destructive'
    case 'scheduled':
    case 'publishing':
      return 'secondary'
    default:
      return 'outline'
  }
}

function formatTs(ts: SocialPost['scheduledAt']): string | null {
  if (!ts) return null
  try {
    return ts.toDate().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

function PlatformIcons({ platforms }: { platforms: SocialPlatform[] }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      {platforms.includes('fb') && <Facebook className="h-4 w-4" />}
      {platforms.includes('ig') && <Instagram className="h-4 w-4" />}
    </span>
  )
}

export function ComposeTab({ project, canEdit }: { project: Project; canEdit: boolean }) {
  // Composer state
  const [caption, setCaption] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaName, setMediaName] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<SocialMediaType>('none')
  const [uploading, setUploading] = useState(false)
  const [fb, setFb] = useState(true)
  const [ig, setIg] = useState(false)
  const [mode, setMode] = useState<Mode>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // List state
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const platforms: SocialPlatform[] = [...(fb ? (['fb'] as const) : []), ...(ig ? (['ig'] as const) : [])]

  const loadPosts = useCallback(async () => {
    setLoadingList(true)
    try {
      const list = await socialPosts.listByProject(project.id)
      setPosts(list)
    } catch {
      setPosts([])
    } finally {
      setLoadingList(false)
    }
  }, [project.id])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  // Inline validation message (does not block typing, but surfaces the IG-needs-media rule)
  const igNeedsMedia = ig && mediaType === 'none'

  function resetForm() {
    setCaption('')
    setMediaUrl(null)
    setMediaName(null)
    setMediaType('none')
    setMode('now')
    setScheduledAt('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function clearMedia() {
    setMediaUrl(null)
    setMediaName(null)
    setMediaType('none')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const url = await uploadSocialMedia(file, project.id)
      setMediaUrl(url)
      setMediaName(file.name)
      setMediaType(mediaTypeFor(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    setError(null)

    if (platforms.length === 0) {
      setError('Select at least one platform')
      return
    }
    if (ig && (mediaType === 'none' || !mediaUrl)) {
      setError('Instagram requires an image or video')
      return
    }

    let scheduledMs: number | null = null
    if (mode === 'schedule') {
      if (!scheduledAt) {
        setError('Pick a date and time to schedule')
        return
      }
      scheduledMs = new Date(scheduledAt).getTime()
      if (Number.isNaN(scheduledMs) || scheduledMs <= Date.now()) {
        setError('Scheduled time must be in the future')
        return
      }
    }

    const body = {
      projectId: project.id,
      platforms,
      caption,
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      mediaType,
      ...(scheduledMs !== null ? { scheduledAt: scheduledMs } : {}),
    }

    setSubmitting(true)
    try {
      const url = mode === 'schedule' ? '/api/social/schedule' : '/api/social/publish'
      const res = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Request failed')
        return
      }
      resetForm()
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetry(post: SocialPost) {
    setRetryingId(post.id)
    try {
      const res = await authFetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: post.projectId,
          platforms: post.platforms,
          caption: post.caption,
          mediaUrls: post.mediaUrls,
          mediaType: post.mediaType,
        }),
      })
      await res.json().catch(() => ({}))
      await loadPosts()
    } catch {
      // surfaced via reload; row stays failed if it failed again
    } finally {
      setRetryingId(null)
    }
  }

  const disabled = !canEdit || submitting || uploading

  return (
    <div className="space-y-5">
      {/* Composer */}
      <div
        className={cn(
          'rounded-lg border bg-card p-4',
          !canEdit && 'opacity-70',
        )}
      >
        {!canEdit && (
          <p className="mb-3 text-xs text-muted-foreground">
            You have read-only access to this stage.
          </p>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="social-caption">Caption</Label>
            <Textarea
              id="social-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your post…"
              rows={4}
              disabled={!canEdit}
            />
          </div>

          {/* Media */}
          <div className="space-y-1.5">
            <Label>Media</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFile}
                disabled={!canEdit || uploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEdit || uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="mr-1.5 h-4 w-4" />
                )}
                {uploading ? 'Uploading…' : 'Add image or video'}
              </Button>
              {mediaName && (
                <Badge variant="secondary" className="gap-1.5">
                  <span className="max-w-[180px] truncate">{mediaName}</span>
                  <button
                    type="button"
                    onClick={clearMedia}
                    disabled={!canEdit}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove media"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
            {mediaUrl && mediaType === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt="Selected media preview"
                className="mt-2 h-24 w-24 rounded-md border object-cover"
              />
            )}
          </div>

          {/* Platforms */}
          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="platform-fb"
                  checked={fb}
                  onCheckedChange={setFb}
                  disabled={!canEdit}
                />
                <Label htmlFor="platform-fb" className="flex items-center gap-1.5 font-normal">
                  <Facebook className="h-4 w-4" /> Facebook
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="platform-ig"
                  checked={ig}
                  onCheckedChange={setIg}
                  disabled={!canEdit}
                />
                <Label htmlFor="platform-ig" className="flex items-center gap-1.5 font-normal">
                  <Instagram className="h-4 w-4" /> Instagram
                </Label>
              </div>
            </div>
            {igNeedsMedia && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Instagram requires an image or video
              </p>
            )}
          </div>

          {/* Mode */}
          <div className="space-y-2">
            <Label>When</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'now' ? 'default' : 'outline'}
                size="sm"
                disabled={!canEdit}
                onClick={() => setMode('now')}
              >
                <Send className="mr-1.5 h-4 w-4" /> Publish now
              </Button>
              <Button
                type="button"
                variant={mode === 'schedule' ? 'default' : 'outline'}
                size="sm"
                disabled={!canEdit}
                onClick={() => setMode('schedule')}
              >
                <CalendarClock className="mr-1.5 h-4 w-4" /> Schedule
              </Button>
            </div>
            {mode === 'schedule' && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={!canEdit}
                className={cn(
                  'flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              />
            )}
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="button" onClick={handleSubmit} disabled={disabled}>
              {submitting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : mode === 'schedule' ? (
                <CalendarClock className="mr-1.5 h-4 w-4" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              {mode === 'schedule' ? 'Schedule post' : 'Publish now'}
            </Button>
          </div>
        </div>
      </div>

      {/* Posts list */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Posts</h4>
        {loadingList ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading posts…
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
            No posts yet. Compose your first post above.
          </div>
        ) : (
          STATUS_GROUPS.map((group) => {
            const rows = posts.filter((p) =>
              group.status === 'published'
                ? p.status === 'published' || p.status === 'publishing'
                : p.status === group.status,
            )
            if (rows.length === 0) return null
            return (
              <div key={group.status} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </span>
                  <Separator className="flex-1" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {rows.map((post) => {
                    const when =
                      formatTs(post.publishedAt) ?? formatTs(post.scheduledAt)
                    const media = post.mediaUrls?.[0]
                    const title = (post.caption ?? '').split('\n')[0].trim()
                    return (
                      <div
                        key={post.id}
                        className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
                      >
                        {/* Media preview first */}
                        <div className="relative aspect-square w-full overflow-hidden bg-muted">
                          {media && post.mediaType === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={media} alt="" className="h-full w-full object-cover" />
                          ) : media && post.mediaType === 'video' ? (
                            <>
                              <video
                                src={media}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover"
                              />
                              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white">
                                  <Play className="h-5 w-5 fill-current" />
                                </span>
                              </span>
                            </>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <ImageOff className="h-8 w-8" />
                            </div>
                          )}
                          <Badge
                            variant={statusBadgeVariant(post.status)}
                            className="absolute left-2 top-2 capitalize shadow-sm"
                          >
                            {post.status}
                          </Badge>
                          <span className="absolute right-2 top-2 flex items-center rounded-md bg-background/85 px-1.5 py-1 shadow-sm">
                            <PlatformIcons platforms={post.platforms} />
                          </span>
                        </div>
                        {/* Title summary only */}
                        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                          <p className="line-clamp-2 text-sm font-medium leading-snug">
                            {title || (
                              <span className="font-normal italic text-muted-foreground">No caption</span>
                            )}
                          </p>
                          <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
                            {when && <span className="text-xs text-muted-foreground">{when}</span>}
                            {post.status === 'failed' && canEdit && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2"
                                disabled={retryingId === post.id}
                                onClick={() => handleRetry(post)}
                                title="Retry"
                              >
                                {retryingId === post.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                          {post.status === 'failed' && post.error && (
                            <span
                              className="truncate text-xs text-destructive"
                              title={post.error}
                            >
                              {post.error}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
