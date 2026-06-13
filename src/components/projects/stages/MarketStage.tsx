'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Plus, Trash2, Check, Loader2, Sparkles, ChevronDown, Megaphone, Target,
  Radio, FlaskConical, FileBox, Store, Circle, CircleDot, CheckCircle2, type LucideIcon,
} from 'lucide-react'
import type {
  Project, MarketChannel, MarketChannelStatus, LaunchAsset, LaunchAssetStatus,
  MarketCampaign, MarketCampaignStatus, MarketPlaybookItem, MarketPlaybookPhase, MarketPlaybookStatus,
  MarketListing, MarketListingModel, MarketListingStatus,
} from '@/types'
import {
  projectMarket, marketChannels, launchAssets, marketCampaigns, marketPlaybook, marketListings,
  repoSummaries, deployDomains, projectDeploy,
} from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface Props { project: Project; canEdit: boolean }

const AUTOSAVE_MS = 900

const ACCENT = {
  plan: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  channels: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  campaigns: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  listings: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  assets: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  playbook: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400',
} as const

const LISTING_DOT: Record<MarketListingStatus, string> = {
  preparing: 'bg-slate-400',
  submitted: 'bg-blue-500 animate-pulse',
  approved: 'bg-emerald-400',
  rejected: 'bg-red-500',
  live: 'bg-emerald-500',
}

const LISTING_MODEL_LABEL: Record<MarketListingModel, string> = {
  one_time: 'one-time',
  subscription: 'subscription',
  freemium: 'freemium',
}

const CHANNEL_DOT: Record<MarketChannelStatus, string> = {
  planned: 'bg-slate-400',
  active: 'bg-emerald-500',
  paused: 'bg-amber-500',
  completed: 'bg-slate-300 dark:bg-slate-600',
}

const CAMPAIGN_DOT: Record<MarketCampaignStatus, string> = {
  planned: 'bg-slate-400',
  running: 'bg-blue-500 animate-pulse',
  done: 'bg-emerald-500',
}

const ASSET_DOT: Record<LaunchAssetStatus, string> = {
  not_started: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  done: 'bg-emerald-500',
}

const PHASES: { key: MarketPlaybookPhase; label: string }[] = [
  { key: 'pre_launch', label: 'Pre-launch' },
  { key: 'launch', label: 'Launch week' },
  { key: 'post_launch', label: 'Post-launch' },
]

function TitleChip({ label, icon: Icon, accent }: { label: string; icon?: LucideIcon; accent: string }) {
  return (
    <h3 className={cn(
      'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
      accent,
    )}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </h3>
  )
}

function SectionHeader({ title, icon, accent, canEdit, open, onOpenChange, children, trailing }: {
  title: string
  icon?: LucideIcon
  accent: string
  canEdit: boolean
  open?: boolean
  onOpenChange?: (v: boolean) => void
  children?: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <TitleChip label={title} icon={icon} accent={accent} />
      <span className="flex items-center gap-2">
        {trailing}
        {canEdit && children && (
          <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Add ${title.toLowerCase()}`}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              {children}
            </PopoverContent>
          </Popover>
        )}
      </span>
    </div>
  )
}

/** Click-to-edit prose field. */
function ProseField({ label, value, canEdit, onChange }: {
  label: string
  value: string
  canEdit: boolean
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (editing && canEdit) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
          className="mt-1.5 min-h-[100px] resize-y text-sm"
        />
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
      {value.trim() ? (
        <p
          onClick={canEdit ? () => setEditing(true) : undefined}
          className={cn(
            'mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground',
            canEdit && 'cursor-text rounded-md -mx-1.5 px-1.5 py-1 transition hover:bg-muted/50',
          )}
          title={canEdit ? 'Click to edit' : undefined}
        >
          {value}
        </p>
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 text-sm italic text-muted-foreground/60 hover:text-muted-foreground"
        >
          Click to write — or use ✨ to generate…
        </button>
      ) : null}
    </div>
  )
}

export function MarketStage({ project, canEdit }: Props) {
  const { user } = useAuth()
  const [positioning, setPositioning] = useState('')
  const [audience, setAudience] = useState('')
  const [pricing, setPricing] = useState('')
  const [channels, setChannels] = useState<MarketChannel[]>([])
  const [assets, setAssets] = useState<LaunchAsset[]>([])
  const [campaigns, setCampaigns] = useState<MarketCampaign[]>([])
  const [listings, setListings] = useState<MarketListing[]>([])
  const [playbook, setPlaybook] = useState<MarketPlaybookItem[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [generatingPlaybook, setGeneratingPlaybook] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [channelOpen, setChannelOpen] = useState(false)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [listingOpen, setListingOpen] = useState(false)
  const [generatingListings, setGeneratingListings] = useState(false)
  const [newListing, setNewListing] = useState({ marketplace: '', model: 'one_time' as MarketListingModel, price: '', url: '' })
  const [assetOpen, setAssetOpen] = useState(false)
  const [playbookOpen, setPlaybookOpen] = useState(false)

  const [newChannel, setNewChannel] = useState({ name: '', url: '' })
  const [newCampaign, setNewCampaign] = useState({ name: '', channel: '', notes: '' })
  const [newAsset, setNewAsset] = useState({ name: '', url: '' })
  const [newItem, setNewItem] = useState({ phase: 'pre_launch' as MarketPlaybookPhase, title: '', detail: '' })

  const hydratedRef = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [m, ch, as, ca, li, pb] = await Promise.all([
        projectMarket.get(project.id),
        marketChannels.listByProject(project.id),
        launchAssets.listByProject(project.id),
        marketCampaigns.listByProject(project.id),
        marketListings.listByProject(project.id),
        marketPlaybook.listByProject(project.id),
      ])
      if (cancelled) return
      setPositioning(m?.positioning ?? '')
      setAudience(m?.audience ?? '')
      setPricing(m?.pricing ?? '')
      setChannels(ch)
      setAssets(as)
      setCampaigns(ca)
      setListings(li)
      setPlaybook(pb)
      requestAnimationFrame(() => { hydratedRef.current = true })
    })()
    return () => { cancelled = true }
  }, [project.id])

  // Debounced autosave for the plan prose.
  useEffect(() => {
    if (!hydratedRef.current || !canEdit || !user) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    setSaveState('saving')
    autosaveTimer.current = setTimeout(async () => {
      try {
        await projectMarket.save(project.id, { positioning, audience, pricing }, user.uid)
        setSaveState('saved')
        if (savedFadeTimer.current) clearTimeout(savedFadeTimer.current)
        savedFadeTimer.current = setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        setSaveState('idle')
      }
    }, AUTOSAVE_MS)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positioning, audience, pricing])

  /** Shared project context for the AI features. */
  const buildContext = async (extra: string[] = []) => {
    const [summaries, domains, deploy] = await Promise.all([
      repoSummaries.listByProject(project.id).catch(() => []),
      deployDomains.listByProject(project.id).catch(() => []),
      projectDeploy.get(project.id).catch(() => null),
    ])
    return [
      `Product: ${project.name}`,
      project.description?.trim() && `Description: ${project.description}`,
      summaries.length > 0 && `What the codebase does (repo summaries):\n${summaries.map((s) => `- ${s.summary}`).join('\n')}`,
      domains.length > 0 && `Live domains:\n${domains.map((d) => `- ${d.domain} → ${d.target}`).join('\n')}`,
      (deploy?.technologies?.length ?? 0) > 0 && `Tech stack: ${deploy!.technologies.join(', ')}`,
      ...extra,
    ].filter(Boolean).join('\n\n')
  }

  /** ✨ Fill positioning/audience/pricing + suggest channels. */
  const handleGeneratePlan = async () => {
    if (!user || generatingPlan) return
    setGeneratingPlan(true)
    try {
      const context = await buildContext([
        positioning.trim() && `Current positioning draft:\n${positioning}`,
        channels.length > 0 && `Existing channels: ${channels.map((c) => c.name).join(', ')}`,
      ].filter(Boolean) as string[])
      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_market_plan', data: { context } }),
      })
      const result = await response.json()
      const plan = result?.data?.plan
      if (plan) {
        if (plan.positioning) setPositioning(plan.positioning)
        if (plan.audience) setAudience(plan.audience)
        if (plan.pricing) setPricing(plan.pricing)
        const existing = new Set(channels.map((c) => c.name.toLowerCase()))
        for (const name of plan.channels ?? []) {
          if (existing.has(String(name).toLowerCase())) continue
          await marketChannels.add({ projectId: project.id, name: String(name), status: 'planned', url: null }, user.uid)
        }
        setChannels(await marketChannels.listByProject(project.id))
      }
    } catch (err) {
      console.error('Failed to generate market plan', err)
    } finally {
      setGeneratingPlan(false)
    }
  }

  const [generatingCampaigns, setGeneratingCampaigns] = useState(false)

  /** ✨ Suggest concrete campaigns from plan + channels + playbook context. */
  const handleGenerateCampaigns = async () => {
    if (!user || generatingCampaigns) return
    setGeneratingCampaigns(true)
    try {
      const context = await buildContext([
        positioning.trim() && `Positioning:\n${positioning}`,
        audience.trim() && `Audience:\n${audience}`,
        channels.length > 0 && `Channels: ${channels.map((c) => c.name).join(', ')}`,
        playbook.length > 0 && `Playbook highlights:\n${playbook.slice(0, 10).map((i) => `- [${i.phase}] ${i.title}`).join('\n')}`,
        campaigns.length > 0 && `ALREADY-TRACKED campaigns (do not repeat):\n${campaigns.map((c) => `- ${c.name} (${c.channel}, ${c.status})`).join('\n')}`,
      ].filter(Boolean) as string[])
      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_market_campaigns', data: { context } }),
      })
      const result = await response.json()
      const generated: { name: string; channel: string; notes: string }[] = result?.data?.campaigns ?? []
      for (const g of generated) {
        await marketCampaigns.add({ projectId: project.id, name: g.name, channel: g.channel, notes: g.notes || null }, user.uid)
      }
      if (generated.length > 0) setCampaigns(await marketCampaigns.listByProject(project.id))
    } catch (err) {
      console.error('Failed to generate campaigns', err)
    } finally {
      setGeneratingCampaigns(false)
    }
  }

  /** ✨ Suggest marketplaces to list on + add their prep checklists to the playbook. */
  const handleGenerateListings = async () => {
    if (!user || generatingListings) return
    setGeneratingListings(true)
    try {
      const context = await buildContext([
        positioning.trim() && `Positioning:\n${positioning}`,
        pricing.trim() && `Pricing:\n${pricing}`,
        listings.length > 0 && `ALREADY-TRACKED listings (do not repeat):\n${listings.map((l) => `- ${l.marketplace} (${l.status})`).join('\n')}`,
      ].filter(Boolean) as string[])
      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_market_listings', data: { context } }),
      })
      const result = await response.json()
      const generated: { marketplace: string; model: MarketListingModel; price: string; why: string; prepItems: string[] }[] =
        result?.data?.listings ?? []
      let order = Date.now()
      for (const g of generated) {
        await marketListings.add({
          projectId: project.id,
          marketplace: g.marketplace,
          model: g.model,
          price: g.price || null,
          notes: g.why || null,
        }, user.uid)
        for (const item of g.prepItems ?? []) {
          await marketPlaybook.add({
            projectId: project.id,
            phase: 'pre_launch',
            title: `[${g.marketplace}] ${item}`,
            detail: `Submission requirement for listing on ${g.marketplace}.`,
            order: order++,
          }, user.uid)
        }
      }
      if (generated.length > 0) {
        setListings(await marketListings.listByProject(project.id))
        setPlaybook(await marketPlaybook.listByProject(project.id))
      }
    } catch (err) {
      console.error('Failed to generate listings', err)
    } finally {
      setGeneratingListings(false)
    }
  }

  /** ✨ Generate the phased GTM playbook. */
  const handleGeneratePlaybook = async () => {
    if (!user || generatingPlaybook) return
    setGeneratingPlaybook(true)
    try {
      const context = await buildContext([
        positioning.trim() && `Positioning:\n${positioning}`,
        audience.trim() && `Audience:\n${audience}`,
        pricing.trim() && `Pricing:\n${pricing}`,
        channels.length > 0 && `Channels: ${channels.map((c) => c.name).join(', ')}`,
        playbook.length > 0 && `ALREADY-TRACKED playbook items (do not repeat):\n${playbook.map((i) => `- [${i.phase}] ${i.title}`).join('\n')}`,
      ].filter(Boolean) as string[])
      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_market_playbook', data: { context } }),
      })
      const result = await response.json()
      const items: { phase: MarketPlaybookPhase; title: string; detail: string }[] = result?.data?.items ?? []
      let order = Date.now()
      for (const item of items) {
        await marketPlaybook.add({ projectId: project.id, ...item, order: order++ }, user.uid)
      }
      if (items.length > 0) setPlaybook(await marketPlaybook.listByProject(project.id))
    } catch (err) {
      console.error('Failed to generate playbook', err)
    } finally {
      setGeneratingPlaybook(false)
    }
  }

  const cyclePlaybookStatus = async (item: MarketPlaybookItem) => {
    if (!user || !canEdit) return
    const next: MarketPlaybookStatus = item.status === 'todo' ? 'doing' : item.status === 'doing' ? 'done' : 'todo'
    setPlaybook((curr) => curr.map((i) => (i.id === item.id ? { ...i, status: next } : i)))
    await marketPlaybook.setStatus(item.id, project.id, next, user.uid)
  }

  const showChannels = canEdit || channels.length > 0
  const showCampaigns = canEdit || campaigns.length > 0
  const showListings = canEdit || listings.length > 0
  const showAssets = canEdit || assets.length > 0

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[60fr_40fr] lg:items-start">
    <Card className="divide-y">
      {/* Plan */}
      <section className="px-5 py-4">
        <SectionHeader
          title="Plan"
          icon={Target}
          accent={ACCENT.plan}
          canEdit={canEdit}
          trailing={
            <>
              {canEdit && saveState !== 'idle' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  {saveState === 'saving'
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                    : <><Check className="h-3 w-3 text-green-600" /> Saved</>}
                </span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan}
                  title="AI: generate positioning, audience, pricing & channels from what WorkHub knows about this product"
                  aria-label="Generate marketing plan with AI"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground disabled:opacity-60"
                >
                  {generatingPlan
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Sparkles className="h-3.5 w-3.5" />}
                </button>
              )}
            </>
          }
        />
        <div className="mt-3 space-y-4">
          <ProseField label="Positioning" value={positioning} canEdit={canEdit} onChange={setPositioning} />
          <ProseField label="Audience" value={audience} canEdit={canEdit} onChange={setAudience} />
          <ProseField label="Pricing" value={pricing} canEdit={canEdit} onChange={setPricing} />
        </div>
      </section>

      {/* Channels */}
      {showChannels && (
        <section className="px-5 py-4">
          <SectionHeader title="Channels" icon={Radio} accent={ACCENT.channels} canEdit={canEdit} open={channelOpen} onOpenChange={setChannelOpen}>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">New channel</p>
              <Input placeholder="Channel (Product Hunt, r/SaaS…)" value={newChannel.name} onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })} autoFocus />
              <Input placeholder="URL (optional)" value={newChannel.url} onChange={(e) => setNewChannel({ ...newChannel, url: e.target.value })} />
              <Button className="w-full" disabled={!newChannel.name.trim()} onClick={async () => {
                if (!user) return
                setChannelOpen(false)
                await marketChannels.add({ projectId: project.id, name: newChannel.name.trim(), status: 'planned', url: newChannel.url.trim() || null }, user.uid)
                setNewChannel({ name: '', url: '' })
                setChannels(await marketChannels.listByProject(project.id))
              }}>
                <Plus className="mr-1 h-4 w-4" /> Add channel
              </Button>
            </div>
          </SectionHeader>
          <div className="mt-3 space-y-2">
            {channels.map((c) => (
              <div key={c.id} className="group/row flex items-center gap-2 text-sm">
                {canEdit ? (
                  <Select value={c.status} onValueChange={async (v) => {
                    if (!user) return
                    await marketChannels.setStatus(c.id, project.id, v as MarketChannelStatus, user.uid)
                    setChannels(await marketChannels.listByProject(project.id))
                  }}>
                    <SelectTrigger aria-label={`Status: ${c.status}`} title={c.status} className="h-auto w-auto border-0 bg-transparent p-1 shadow-none [&>svg]:hidden">
                      <span className={cn('block h-2 w-2 rounded-full', CHANNEL_DOT[c.status])} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">planned</SelectItem>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="paused">paused</SelectItem>
                      <SelectItem value="completed">completed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span title={c.status} className={cn('h-2 w-2 shrink-0 rounded-full', CHANNEL_DOT[c.status])} />
                )}
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{c.name}</a>
                ) : (
                  <span className="font-medium">{c.name}</span>
                )}
                {canEdit && (
                  <button
                    onClick={async () => {
                      if (!user) return
                      await marketChannels.remove(c.id, project.id, user.uid)
                      setChannels(await marketChannels.listByProject(project.id))
                    }}
                    className="ml-auto text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                    aria-label="Delete channel"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {channels.length === 0 && <p className="text-xs italic text-muted-foreground/60">None yet — ✨ in Plan suggests some</p>}
          </div>
        </section>
      )}

      {/* Campaigns */}
      {showCampaigns && (
        <section className="px-5 py-4">
          <SectionHeader
            title="Campaigns"
            icon={FlaskConical}
            accent={ACCENT.campaigns}
            canEdit={canEdit}
            open={campaignOpen}
            onOpenChange={setCampaignOpen}
            trailing={canEdit ? (
              <button
                type="button"
                onClick={handleGenerateCampaigns}
                disabled={generatingCampaigns}
                title="AI: suggest concrete campaigns based on your plan, channels & playbook"
                aria-label="Generate campaigns with AI"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                {generatingCampaigns
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
              </button>
            ) : undefined}
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">New campaign</p>
              <Input placeholder="Name (PH launch, HN post…)" value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })} autoFocus />
              <Input placeholder="Channel" value={newCampaign.channel} onChange={(e) => setNewCampaign({ ...newCampaign, channel: e.target.value })} />
              <Textarea placeholder="Notes / goal (optional)" value={newCampaign.notes} onChange={(e) => setNewCampaign({ ...newCampaign, notes: e.target.value })} className="min-h-[60px] text-xs" />
              <Button className="w-full" disabled={!newCampaign.name.trim()} onClick={async () => {
                if (!user) return
                setCampaignOpen(false)
                await marketCampaigns.add({ projectId: project.id, name: newCampaign.name.trim(), channel: newCampaign.channel.trim(), notes: newCampaign.notes.trim() || null }, user.uid)
                setNewCampaign({ name: '', channel: '', notes: '' })
                setCampaigns(await marketCampaigns.listByProject(project.id))
              }}>
                <Plus className="mr-1 h-4 w-4" /> Add campaign
              </Button>
            </div>
          </SectionHeader>
          <div className="mt-3 space-y-1">
            {campaigns.map((c) => {
              const expanded = expandedId === `c_${c.id}`
              return (
                <div key={c.id}>
                  <div className="group/row flex items-center gap-2 text-sm">
                    {canEdit ? (
                      <Select value={c.status} onValueChange={async (v) => {
                        if (!user) return
                        await marketCampaigns.setStatus(c.id, project.id, v as MarketCampaignStatus, user.uid)
                        setCampaigns(await marketCampaigns.listByProject(project.id))
                      }}>
                        <SelectTrigger aria-label={`Status: ${c.status}`} title={c.status} className="h-auto w-auto border-0 bg-transparent p-1 shadow-none [&>svg]:hidden">
                          <span className={cn('block h-2 w-2 rounded-full', CAMPAIGN_DOT[c.status])} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">planned</SelectItem>
                          <SelectItem value="running">running</SelectItem>
                          <SelectItem value="done">done</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span title={c.status} className={cn('h-2 w-2 shrink-0 rounded-full', CAMPAIGN_DOT[c.status])} />
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : `c_${c.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="truncate font-medium">{c.name}</span>
                      {c.channel && <span className="truncate text-xs text-muted-foreground">{c.channel}</span>}
                      <ChevronDown className={cn('ml-auto h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform', expanded && 'rotate-180')} />
                    </button>
                    {canEdit && (
                      <button
                        onClick={async () => {
                          if (!user) return
                          await marketCampaigns.remove(c.id, project.id, user.uid)
                          setCampaigns(await marketCampaigns.listByProject(project.id))
                        }}
                        className="text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                        aria-label="Delete campaign"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="ml-5 mt-1 mb-2 space-y-1 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
                      {c.notes && <p className="whitespace-pre-wrap"><span className="font-semibold">Notes: </span>{c.notes}</p>}
                      {c.result && <p className="whitespace-pre-wrap"><span className="font-semibold">Result: </span>{c.result}</p>}
                      {!c.notes && !c.result && <p className="italic">No notes.</p>}
                    </div>
                  )}
                </div>
              )
            })}
            {campaigns.length === 0 && <p className="text-xs italic text-muted-foreground/60">None yet</p>}
          </div>
        </section>
      )}

      {/* Listings — marketplace distribution */}
      {showListings && (
        <section className="px-5 py-4">
          <SectionHeader
            title="Listings"
            icon={Store}
            accent={ACCENT.listings}
            canEdit={canEdit}
            open={listingOpen}
            onOpenChange={setListingOpen}
            trailing={canEdit ? (
              <button
                type="button"
                onClick={handleGenerateListings}
                disabled={generatingListings}
                title="AI: suggest marketplaces (CodeCanyon, Codester, AppSumo…) + add their prep checklists to the playbook"
                aria-label="Generate listings with AI"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                {generatingListings
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
              </button>
            ) : undefined}
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">New listing</p>
              <Input placeholder="Marketplace (CodeCanyon, AppSumo…)" value={newListing.marketplace} onChange={(e) => setNewListing({ ...newListing, marketplace: e.target.value })} autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <Select value={newListing.model} onValueChange={(v) => setNewListing({ ...newListing, model: v as MarketListingModel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time license</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="freemium">Freemium</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Price" value={newListing.price} onChange={(e) => setNewListing({ ...newListing, price: e.target.value })} />
              </div>
              <Input placeholder="Listing URL (optional)" value={newListing.url} onChange={(e) => setNewListing({ ...newListing, url: e.target.value })} />
              <Button className="w-full" disabled={!newListing.marketplace.trim()} onClick={async () => {
                if (!user) return
                setListingOpen(false)
                await marketListings.add({
                  projectId: project.id,
                  marketplace: newListing.marketplace.trim(),
                  model: newListing.model,
                  price: newListing.price.trim() || null,
                  url: newListing.url.trim() || null,
                }, user.uid)
                setNewListing({ marketplace: '', model: 'one_time', price: '', url: '' })
                setListings(await marketListings.listByProject(project.id))
              }}>
                <Plus className="mr-1 h-4 w-4" /> Add listing
              </Button>
            </div>
          </SectionHeader>
          <div className="mt-3 space-y-1">
            {listings.map((l) => {
              const expanded = expandedId === `l_${l.id}`
              return (
                <div key={l.id}>
                  <div className="group/row flex items-center gap-2 text-sm">
                    {canEdit ? (
                      <Select value={l.status} onValueChange={async (v) => {
                        if (!user) return
                        await marketListings.setStatus(l.id, project.id, v as MarketListingStatus, user.uid)
                        setListings(await marketListings.listByProject(project.id))
                      }}>
                        <SelectTrigger aria-label={`Status: ${l.status}`} title={l.status} className="h-auto w-auto border-0 bg-transparent p-1 shadow-none [&>svg]:hidden">
                          <span className={cn('block h-2 w-2 rounded-full', LISTING_DOT[l.status])} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="preparing">preparing</SelectItem>
                          <SelectItem value="submitted">submitted</SelectItem>
                          <SelectItem value="approved">approved</SelectItem>
                          <SelectItem value="rejected">rejected</SelectItem>
                          <SelectItem value="live">live</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span title={l.status} className={cn('h-2 w-2 shrink-0 rounded-full', LISTING_DOT[l.status])} />
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : `l_${l.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="truncate font-medium hover:underline">{l.marketplace}</a>
                      ) : (
                        <span className="truncate font-medium">{l.marketplace}</span>
                      )}
                      <span className="truncate text-xs text-muted-foreground">
                        {[LISTING_MODEL_LABEL[l.model], l.price].filter(Boolean).join(' · ')}
                      </span>
                      <ChevronDown className={cn('ml-auto h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform', expanded && 'rotate-180')} />
                    </button>
                    {canEdit && (
                      <button
                        onClick={async () => {
                          if (!user) return
                          await marketListings.remove(l.id, project.id, user.uid)
                          setListings(await marketListings.listByProject(project.id))
                        }}
                        className="text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                        aria-label="Delete listing"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="ml-5 mt-1 mb-2 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
                      {l.notes ? <p className="whitespace-pre-wrap">{l.notes}</p> : <p className="italic">No notes.</p>}
                    </div>
                  )}
                </div>
              )
            })}
            {listings.length === 0 && <p className="text-xs italic text-muted-foreground/60">None yet — ✨ suggests marketplaces + prep checklists</p>}
          </div>
        </section>
      )}

      {/* Assets */}
      {showAssets && (
        <section className="px-5 py-4">
          <SectionHeader title="Assets" icon={FileBox} accent={ACCENT.assets} canEdit={canEdit} open={assetOpen} onOpenChange={setAssetOpen}>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">New asset</p>
              <Input placeholder="Asset (landing copy, demo video…)" value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} autoFocus />
              <Input placeholder="URL (optional)" value={newAsset.url} onChange={(e) => setNewAsset({ ...newAsset, url: e.target.value })} />
              <Button className="w-full" disabled={!newAsset.name.trim()} onClick={async () => {
                if (!user) return
                setAssetOpen(false)
                await launchAssets.add({ projectId: project.id, name: newAsset.name.trim(), status: 'not_started', url: newAsset.url.trim() || null }, user.uid)
                setNewAsset({ name: '', url: '' })
                setAssets(await launchAssets.listByProject(project.id))
              }}>
                <Plus className="mr-1 h-4 w-4" /> Add asset
              </Button>
            </div>
          </SectionHeader>
          <div className="mt-3 space-y-2">
            {assets.map((a) => (
              <div key={a.id} className="group/row flex items-center gap-2 text-sm">
                {canEdit ? (
                  <Select value={a.status} onValueChange={async (v) => {
                    if (!user) return
                    await launchAssets.setStatus(a.id, project.id, v as LaunchAssetStatus, user.uid)
                    setAssets(await launchAssets.listByProject(project.id))
                  }}>
                    <SelectTrigger aria-label={`Status: ${a.status}`} title={a.status} className="h-auto w-auto border-0 bg-transparent p-1 shadow-none [&>svg]:hidden">
                      <span className={cn('block h-2 w-2 rounded-full', ASSET_DOT[a.status])} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">not started</SelectItem>
                      <SelectItem value="in_progress">in progress</SelectItem>
                      <SelectItem value="done">done</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span title={a.status} className={cn('h-2 w-2 shrink-0 rounded-full', ASSET_DOT[a.status])} />
                )}
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{a.name}</a>
                ) : (
                  <span className="font-medium">{a.name}</span>
                )}
                {canEdit && (
                  <button
                    onClick={async () => {
                      if (!user) return
                      await launchAssets.remove(a.id, project.id, user.uid)
                      setAssets(await launchAssets.listByProject(project.id))
                    }}
                    className="ml-auto text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                    aria-label="Delete asset"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {assets.length === 0 && <p className="text-xs italic text-muted-foreground/60">None yet</p>}
          </div>
        </section>
      )}
    </Card>

    {/* Right rail — GTM Playbook */}
    <Card className="px-4 py-3 lg:sticky lg:top-0">
      <SectionHeader
        title="GTM Playbook"
        icon={Megaphone}
        accent={ACCENT.playbook}
        canEdit={canEdit}
        open={playbookOpen}
        onOpenChange={setPlaybookOpen}
        trailing={canEdit ? (
          <button
            type="button"
            onClick={handleGeneratePlaybook}
            disabled={generatingPlaybook}
            title="AI: generate a phased launch playbook tailored to this product"
            aria-label="Generate playbook with AI"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground disabled:opacity-60"
          >
            {generatingPlaybook
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
          </button>
        ) : undefined}
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">New playbook item</p>
          <Select value={newItem.phase} onValueChange={(v) => setNewItem({ ...newItem, phase: v as MarketPlaybookPhase })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PHASES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Title" value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} />
          <Textarea placeholder="How to do it (optional)" value={newItem.detail} onChange={(e) => setNewItem({ ...newItem, detail: e.target.value })} className="min-h-[60px] text-xs" />
          <Button className="w-full" disabled={!newItem.title.trim()} onClick={async () => {
            if (!user) return
            setPlaybookOpen(false)
            await marketPlaybook.add({ projectId: project.id, phase: newItem.phase, title: newItem.title.trim(), detail: newItem.detail.trim() }, user.uid)
            setNewItem({ phase: 'pre_launch', title: '', detail: '' })
            setPlaybook(await marketPlaybook.listByProject(project.id))
          }}>
            <Plus className="mr-1 h-4 w-4" /> Add item
          </Button>
        </div>
      </SectionHeader>

      <div className="mt-2.5 space-y-3">
        {playbook.length === 0 && (
          <p className="text-sm italic text-muted-foreground/60">
            No playbook yet — hit ✨ to generate a step-by-step launch plan for this product.
          </p>
        )}
        {PHASES.map((phase) => {
          const items = playbook.filter((i) => i.phase === phase.key)
          if (items.length === 0) return null
          const doneCount = items.filter((i) => i.status === 'done').length
          return (
            <div key={phase.key}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{phase.label}</p>
                <span className="text-xs tabular-nums text-muted-foreground/60">{doneCount}/{items.length}</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {items.map((item) => {
                  const expanded = expandedId === `p_${item.id}`
                  return (
                    <div key={item.id}>
                      <div className="group/row flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => cyclePlaybookStatus(item)}
                          disabled={!canEdit}
                          title={item.status}
                          aria-label={`Status: ${item.status} — click to cycle`}
                          className="shrink-0 disabled:cursor-default"
                        >
                          {item.status === 'done'
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            : item.status === 'doing'
                              ? <CircleDot className="h-3.5 w-3.5 text-blue-500" />
                              : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : `p_${item.id}`)}
                          className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left transition hover:bg-muted/50"
                        >
                          <span className={cn('min-w-0 flex-1 truncate text-sm', item.status === 'done' && 'text-muted-foreground line-through decoration-muted-foreground/50')}>
                            {item.title}
                          </span>
                          <ChevronDown className={cn('h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform', expanded && 'rotate-180')} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={async () => {
                              if (!user) return
                              await marketPlaybook.remove(item.id, project.id, user.uid)
                              setPlaybook(await marketPlaybook.listByProject(project.id))
                            }}
                            className="text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                            aria-label="Delete item"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {expanded && item.detail && (
                        <p className="ml-6 mt-0.5 mb-1.5 rounded-md bg-muted/40 p-2.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
    </div>
  )
}
