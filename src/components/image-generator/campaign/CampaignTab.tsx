'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCampaigns } from '@/hooks/useCampaigns'
import { projects as projectsApi } from '@/lib/firestore'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, getUrlParam, setUrlParam } from '@/lib/utils'
import Link from 'next/link'
import { Loader2, Megaphone, Wand2, CalendarClock, Trash2, ArrowLeft, Images, Plus, AlertCircle, ImageIcon, ExternalLink, MoreVertical } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { CampaignPostCard } from './CampaignPostCard'
import { CampaignImageDialog } from './CampaignImageDialog'
import { CampaignPreview } from './CampaignPreview'
import { CampaignCreateDialog } from './CampaignCreateDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CAMPAIGN_STYLES } from '@/lib/campaignStyles'
import type { Project } from '@/types'

export function CampaignTab() {
  const { user } = useAuth()
  const c = useCampaigns()
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    projectsApi.getAll(user?.uid).then(setProjects).catch(() => {})
  }, [user?.uid])
  const projectOf = (id: string) => projects.find((p) => p.id === id) || null
  const projectName = (id: string) => projectOf(id)?.name || 'Project'
  const styleLabel = (key?: string) => CAMPAIGN_STYLES.find((s) => s.key === key)?.label

  const [preview, setPreview] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [viewIndex, setViewIndex] = useState<number | null>(null)

  // Reopen the campaign from the URL on load.
  useEffect(() => {
    const id = getUrlParam('campaign')
    if (id) c.selectCampaign(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goToCampaign = (id: string | null) => {
    setPreview(false)
    setUrlParam('campaign', id)
    c.selectCampaign(id)
  }

  // ── Preview & schedule ────────────────────────────────────────────────────
  if (c.activeCampaign && preview) {
    return (
      <CampaignPreview
        campaign={c.activeCampaign}
        posts={c.posts}
        slotFor={c.slotFor}
        scheduling={c.schedulingAll}
        onBack={() => setPreview(false)}
        onConfirm={async (ids) => {
          await c.scheduleAll(ids)
          setPreview(false)
        }}
      />
    )
  }

  // ── Active campaign view ──────────────────────────────────────────────────
  if (c.activeCampaign) {
    const cam = c.activeCampaign
    const readyCount = c.posts.filter((p) => p.imageUrl).length
    const scheduledCount = c.posts.filter((p) => p.status === 'scheduled').length
    return (
      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => goToCampaign(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Campaigns
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight">{cam.name}</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {projectName(cam.projectId)} · {cam.platforms.map((p) => p.toUpperCase()).join('·')} · {c.posts.length} posts
              {c.posts.length > 0 && ` · ${readyCount} generated · ${scheduledCount} scheduled`}
            </p>
          </div>
          <Badge variant="outline" className="capitalize">{cam.status === 'planning' ? 'Planning…' : cam.status}</Badge>
          <div className="flex-1" />
          {!c.planning && c.posts.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={c.generateAllImages}
                disabled={c.imagePostIds.size > 0 || c.posts.every((p) => p.status === 'scheduled')}
              >
                {c.imagePostIds.size > 0 ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Images className="mr-1.5 h-4 w-4" />}
                Generate all
              </Button>
              <Button size="sm" onClick={() => setPreview(true)} disabled={readyCount === 0}>
                <CalendarClock className="mr-1.5 h-4 w-4" /> Preview &amp; schedule
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!c.planning && c.posts.length > 0 && (
                <DropdownMenuItem onClick={c.generatePlan}>
                  <Wand2 className="mr-2 h-4 w-4" /> Re-plan
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/projects/${cam.projectId}?stage=market`}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Open in Market
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {c.planning ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Planning in the background…</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Generating {cam.brief.count} posts. You can leave this page or switch tabs — it keeps running.
            </p>
          </div>
        ) : c.posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/40">
              <Wand2 className="h-7 w-7 text-primary/60" />
            </div>
            {cam.planError && (
              <p className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5" /> {cam.planError}
              </p>
            )}
            <p className="text-sm text-muted-foreground">Generate {cam.brief.count} branded posts from this brief.</p>
            <Button onClick={c.generatePlan}>
              <Wand2 className="mr-2 h-4 w-4" /> Generate plan
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {c.posts.map((post, i) => (
              <CampaignPostCard
                key={post.id}
                post={post}
                index={i}
                generating={c.imagePostIds.has(post.id)}
                rtl={cam.language === 'ar'}
                error={c.imageErrors[post.id]}
                onChange={(patch) => c.updatePost(post.id, patch)}
                onGenerateImage={() => c.generateImage(post)}
                onOpen={() => setViewIndex(i)}
              />
            ))}
          </div>
        )}

        {viewIndex !== null && c.posts[viewIndex] && (
          <CampaignImageDialog
            post={c.posts[viewIndex]}
            index={viewIndex}
            rtl={cam.language === 'ar'}
            generating={c.imagePostIds.has(c.posts[viewIndex].id)}
            open
            onOpenChange={(o) => !o && setViewIndex(null)}
            onChange={(patch) => c.updatePost(c.posts[viewIndex].id, patch)}
            onGenerate={() => c.generateImage(c.posts[viewIndex])}
            onPrev={viewIndex > 0 ? () => setViewIndex(viewIndex - 1) : undefined}
            onNext={viewIndex < c.posts.length - 1 ? () => setViewIndex(viewIndex + 1) : undefined}
          />
        )}
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete campaign?"
          description="This permanently deletes the campaign and all its posts. This can’t be undone."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            c.deleteCampaign(cam.id)
            setUrlParam('campaign', null)
            setConfirmDelete(false)
          }}
        />
      </div>
    )
  }

  // ── Overview: all campaigns (full width) + create modal ───────────────────
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Campaigns <span className="text-muted-foreground">({c.allCampaigns.length})</span></h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New campaign
        </Button>
      </div>

      {c.allCampaigns.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/40">
            <Megaphone className="h-7 w-7 text-primary/60" />
          </div>
          <p className="text-sm">No campaigns yet. Create one for any project.</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New campaign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {c.allCampaigns.map((cam) => {
            const thumbs = c.postThumbs[cam.id] || []
            const proj = projectOf(cam.projectId)
            return (
              <button
                key={cam.id}
                onClick={() => goToCampaign(cam.id)}
                className="group overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                {/* Generated-image preview */}
                <div className="relative grid aspect-[16/9] grid-cols-3 gap-px bg-muted">
                  {styleLabel(cam.style) && (
                    <span className="absolute left-1.5 top-1.5 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      {styleLabel(cam.style)}
                    </span>
                  )}
                  {thumbs.length > 0 ? (
                    [0, 1, 2].map((i) =>
                      thumbs[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={thumbs[i]} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div key={i} className="h-full w-full bg-muted/60" />
                      )
                    )
                  ) : (
                    <div className="col-span-3 flex items-center justify-center gap-1.5 text-muted-foreground">
                      {cam.status === 'planning' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-xs">Planning…</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-5 w-5 opacity-40" />
                          <span className="text-xs">No images yet</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 border-t p-2.5">
                  <ProjectIcon src={proj?.coverImageUrl} name={proj?.name || cam.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{cam.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {projectName(cam.projectId)} · {cam.postCount ?? 0} posts
                      {cam.scheduledCount ? ` · ${cam.scheduledCount} sched` : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                    {cam.status === 'planning' ? 'Planning…' : cam.status}
                  </Badge>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <CampaignCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={async (pid, input) => {
          const camp = await c.createCampaign(pid, input)
          if (camp) setUrlParam('campaign', camp.id)
          return camp
        }}
      />
    </div>
  )
}
