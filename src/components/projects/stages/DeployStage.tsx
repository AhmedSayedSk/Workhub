'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X, Check, Loader2, ShieldCheck, ShieldAlert, Sparkles, Server, Globe, Boxes, Network, Shield, TriangleAlert, ChevronDown, type LucideIcon } from 'lucide-react'
import type {
  Project, DeployServer, DeployServerStatus, DeployDomain, DeployDomainSsl,
  DeployRecommendation, DeployRecSeverity, DeployRecArea, DeployRecStatus,
} from '@/types'
import { projectDeploy, deployServers, deployDomains, deployRecommendations, repoSummaries } from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authFetch } from '@/lib/api-client'
import { detectBrand, getBrandIconUrl } from '@/lib/brand-icons'
import { cn } from '@/lib/utils'

interface Props { project: Project; canEdit: boolean }

const STATUS_DOT: Record<DeployServerStatus, string> = {
  planned: 'bg-slate-400',
  provisioning: 'bg-blue-500 animate-pulse',
  live: 'bg-emerald-500',
  retired: 'bg-amber-500',
}

const SSL_LABEL: Record<DeployDomainSsl, string> = {
  lets_encrypt: "Let's Encrypt",
  cloudflare: 'Cloudflare',
  custom: 'Custom cert',
  none: 'No SSL',
}

const AUTOSAVE_MS = 900

/** Per-section accent: tinted title chip, distinct from neutral body content. */
const SECTION_ACCENT = {
  servers: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  domains: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  stack: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  infrastructure: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  security: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  recommendations: 'bg-red-500/10 text-red-700 dark:text-red-400',
} as const

const SEVERITY_STYLE: Record<DeployRecSeverity, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-600', label: 'text-red-700 dark:text-red-400' },
  high: { dot: 'bg-orange-500', label: 'text-orange-700 dark:text-orange-400' },
  medium: { dot: 'bg-amber-500', label: 'text-amber-700 dark:text-amber-400' },
  low: { dot: 'bg-sky-500', label: 'text-sky-700 dark:text-sky-400' },
  info: { dot: 'bg-slate-400', label: 'text-slate-600 dark:text-slate-400' },
}

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

/** Small brand icon for a technology label; renders nothing when unknown. */
function TechIcon({ label }: { label: string }) {
  const [hidden, setHidden] = useState(false)
  const brand = detectBrand(label)
  if (!brand || hidden) return null
  // Dark brand marks (Next.js, Fastify…) get a neutral gray so they stay
  // visible in dark mode; colorful brands keep their color.
  const url = getBrandIconUrl(brand.slug, brand.isDark ? '#94A3B8' : brand.color)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden
      className="inline h-3.5 w-3.5 shrink-0"
      onError={() => setHidden(true)}
    />
  )
}

/** Quiet section title + floating add button. */
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

/** Read-mostly notes: prose view, click to edit (editors only), autosaved upstream. */
function NotesBlock({ label, kind, icon: Icon, accent, value, canEdit, onChange }: {
  label: string
  kind: 'infrastructure' | 'security'
  icon?: LucideIcon
  accent: string
  value: string
  canEdit: boolean
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [condensing, setCondensing] = useState(false)

  const handleCondense = async () => {
    if (!value.trim() || condensing) return
    setCondensing(true)
    try {
      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarize_deploy_notes', data: { kind, content: value } }),
      })
      const result = await response.json()
      if (result.success && result.data?.summary) {
        onChange(result.data.summary) // autosave upstream persists it
      }
    } catch {
      // leave content untouched on failure
    } finally {
      setCondensing(false)
    }
  }

  if (editing && canEdit) {
    return (
      <div>
        <TitleChip label={label} icon={Icon} accent={accent} />
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
          className="mt-1.5 min-h-[140px] resize-y text-xs"
        />
      </div>
    )
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <TitleChip label={label} icon={Icon} accent={accent} />
        {canEdit && value.trim() && (
          <button
            type="button"
            onClick={handleCondense}
            disabled={condensing}
            title="AI: condense to main points"
            aria-label={`Summarize ${label} with AI`}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground disabled:opacity-60"
          >
            {condensing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {value.trim() ? (
        <p
          onClick={canEdit ? () => setEditing(true) : undefined}
          className={cn(
            'mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground',
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
          className="mt-1.5 text-xs italic text-muted-foreground/60 hover:text-muted-foreground"
        >
          Click to add {label.toLowerCase()} notes…
        </button>
      ) : null}
    </div>
  )
}

export function DeployStage({ project, canEdit }: Props) {
  const { user } = useAuth()
  const [infraNotes, setInfraNotes] = useState('')
  const [securityNotes, setSecurityNotes] = useState('')
  const [technologies, setTechnologies] = useState<string[]>([])
  const [newTech, setNewTech] = useState('')
  const [servers, setServers] = useState<DeployServer[]>([])
  const [domains, setDomains] = useState<DeployDomain[]>([])
  const [recs, setRecs] = useState<DeployRecommendation[]>([])
  const [recOpen, setRecOpen] = useState(false)
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null)
  const [newRec, setNewRec] = useState({ title: '', detail: '', severity: 'medium' as DeployRecSeverity, area: 'security' as DeployRecArea })
  const [serverOpen, setServerOpen] = useState(false)
  const [domainOpen, setDomainOpen] = useState(false)
  const [techOpen, setTechOpen] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const hydratedRef = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [newServer, setNewServer] = useState({ name: '', provider: '', region: '', specs: '', ip: '', os: '', costMonthly: '' })
  const [newDomain, setNewDomain] = useState({ domain: '', target: '', dnsProvider: '', ssl: 'lets_encrypt' as DeployDomainSsl })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [d, srv, dom, rc] = await Promise.all([
        projectDeploy.get(project.id),
        deployServers.listByProject(project.id),
        deployDomains.listByProject(project.id),
        deployRecommendations.listByProject(project.id),
      ])
      if (cancelled) return
      setInfraNotes(d?.infrastructureNotes ?? '')
      setSecurityNotes(d?.securityNotes ?? '')
      setTechnologies(d?.technologies ?? [])
      setServers(srv)
      setDomains(dom)
      setRecs(rc)
      requestAnimationFrame(() => { hydratedRef.current = true })
    })()
    return () => { cancelled = true }
  }, [project.id])

  // Debounced autosave for notes + technologies.
  useEffect(() => {
    if (!hydratedRef.current || !canEdit || !user) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    setSaveState('saving')
    autosaveTimer.current = setTimeout(async () => {
      try {
        await projectDeploy.save(project.id, {
          infrastructureNotes: infraNotes,
          securityNotes,
          technologies,
        }, user.uid)
        setSaveState('saved')
        if (savedFadeTimer.current) clearTimeout(savedFadeTimer.current)
        savedFadeTimer.current = setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        setSaveState('idle')
      }
    }, AUTOSAVE_MS)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraNotes, securityNotes, technologies])

  const handleAddTech = () => {
    const t = newTech.trim()
    setNewTech('')
    if (!t || technologies.includes(t)) return
    setTechOpen(false)
    setTechnologies([...technologies, t])
  }

  const handleAddServer = async () => {
    if (!user || !newServer.name.trim() || !newServer.provider.trim()) return
    setServerOpen(false)
    await deployServers.add({
      projectId: project.id,
      name: newServer.name.trim(),
      provider: newServer.provider.trim(),
      region: newServer.region.trim() || null,
      specs: newServer.specs.trim() || null,
      ip: newServer.ip.trim() || null,
      os: newServer.os.trim() || null,
      costMonthly: newServer.costMonthly.trim() || null,
      status: 'planned',
    }, user.uid)
    setNewServer({ name: '', provider: '', region: '', specs: '', ip: '', os: '', costMonthly: '' })
    setServers(await deployServers.listByProject(project.id))
  }

  const handleServerStatus = async (id: string, status: DeployServerStatus) => {
    if (!user) return
    await deployServers.update(id, project.id, { status }, user.uid)
    setServers(await deployServers.listByProject(project.id))
  }

  const handleDeleteServer = async (id: string) => {
    if (!user) return
    await deployServers.remove(id, project.id, user.uid)
    setServers(await deployServers.listByProject(project.id))
  }

  const handleAddDomain = async () => {
    if (!user || !newDomain.domain.trim()) return
    setDomainOpen(false)
    await deployDomains.add({
      projectId: project.id,
      domain: newDomain.domain.trim(),
      target: newDomain.target.trim(),
      dnsProvider: newDomain.dnsProvider.trim() || null,
      ssl: newDomain.ssl,
    }, user.uid)
    setNewDomain({ domain: '', target: '', dnsProvider: '', ssl: 'lets_encrypt' })
    setDomains(await deployDomains.listByProject(project.id))
  }

  const handleDeleteDomain = async (id: string) => {
    if (!user) return
    await deployDomains.remove(id, project.id, user.uid)
    setDomains(await deployDomains.listByProject(project.id))
  }

  const [generatingRecs, setGeneratingRecs] = useState(false)

  /** AI: generate new recommendations from everything we know about this project. */
  const handleGenerateRecs = async () => {
    if (!user || generatingRecs) return
    setGeneratingRecs(true)
    try {
      const summaries = await repoSummaries.listByProject(project.id).catch(() => [])
      const context = [
        `Project: ${project.name}`,
        servers.length > 0 &&
          `Servers:\n${servers.map((s) => `- ${s.name} (${[s.provider, s.region, s.specs, s.os, `status: ${s.status}`].filter(Boolean).join(', ')})`).join('\n')}`,
        domains.length > 0 &&
          `Domains:\n${domains.map((d) => `- ${d.domain} → ${d.target} (ssl: ${d.ssl}${d.dnsProvider ? `, dns: ${d.dnsProvider}` : ''})`).join('\n')}`,
        technologies.length > 0 && `Stack: ${technologies.join(', ')}`,
        infraNotes.trim() && `Infrastructure notes:\n${infraNotes}`,
        securityNotes.trim() && `Security notes:\n${securityNotes}`,
        summaries.length > 0 &&
          `Repo summaries:\n${summaries.map((s) => `- ${s.summary}`).join('\n')}`,
        recs.length > 0 &&
          `ALREADY-TRACKED recommendations (do not repeat):\n${recs.map((r) => `- [${r.severity}/${r.status}] ${r.title}`).join('\n')}`,
      ].filter(Boolean).join('\n\n')

      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_deploy_recs', data: { context } }),
      })
      const result = await response.json()
      const generated: { severity: DeployRecSeverity; area: DeployRecArea; title: string; detail: string }[] =
        result?.data?.recommendations ?? []
      for (const g of generated) {
        await deployRecommendations.add({ projectId: project.id, ...g }, user.uid)
      }
      if (generated.length > 0) {
        setRecs(await deployRecommendations.listByProject(project.id))
      }
    } catch (err) {
      console.error('Failed to generate recommendations', err)
    } finally {
      setGeneratingRecs(false)
    }
  }

  const handleAddRec = async () => {
    if (!user || !newRec.title.trim()) return
    setRecOpen(false)
    await deployRecommendations.add({
      projectId: project.id,
      title: newRec.title.trim(),
      detail: newRec.detail.trim(),
      severity: newRec.severity,
      area: newRec.area,
    }, user.uid)
    setNewRec({ title: '', detail: '', severity: 'medium', area: 'security' })
    setRecs(await deployRecommendations.listByProject(project.id))
  }

  const handleRecStatus = async (id: string, status: DeployRecStatus) => {
    if (!user) return
    await deployRecommendations.setStatus(id, project.id, status, user.uid)
    setRecs(await deployRecommendations.listByProject(project.id))
  }

  const handleDeleteRec = async (id: string) => {
    if (!user) return
    await deployRecommendations.remove(id, project.id, user.uid)
    setRecs(await deployRecommendations.listByProject(project.id))
  }

  const showServers = canEdit || servers.length > 0
  const showDomains = canEdit || domains.length > 0
  const showTech = canEdit || technologies.length > 0
  const showInfra = canEdit || !!infraNotes.trim()
  const showSecurity = canEdit || !!securityNotes.trim()
  const showRecs = canEdit || recs.length > 0
  const openRecCount = recs.filter((r) => r.status === 'open').length

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[60fr_40fr] lg:items-start">
    <Card className="divide-y">
      {/* Servers */}
      {showServers && (
        <section className="px-5 py-4">
          <SectionHeader
            title="Servers"
            icon={Server}
            accent={SECTION_ACCENT.servers}
            canEdit={canEdit}
            open={serverOpen}
            onOpenChange={setServerOpen}
            trailing={canEdit && saveState !== 'idle' ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                {saveState === 'saving'
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                  : <><Check className="h-3 w-3 text-green-600" /> Saved</>}
              </span>
            ) : undefined}
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">New server</p>
              <Input placeholder="Name (e.g. app-vps-1)" value={newServer.name} onChange={(e) => setNewServer({ ...newServer, name: e.target.value })} autoFocus />
              <Input placeholder="Provider (Hetzner…)" value={newServer.provider} onChange={(e) => setNewServer({ ...newServer, provider: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Region" value={newServer.region} onChange={(e) => setNewServer({ ...newServer, region: e.target.value })} />
                <Input placeholder="Specs" value={newServer.specs} onChange={(e) => setNewServer({ ...newServer, specs: e.target.value })} />
                <Input placeholder="IP" value={newServer.ip} onChange={(e) => setNewServer({ ...newServer, ip: e.target.value })} />
                <Input placeholder="OS" value={newServer.os} onChange={(e) => setNewServer({ ...newServer, os: e.target.value })} />
              </div>
              <Input placeholder="Cost / month" value={newServer.costMonthly} onChange={(e) => setNewServer({ ...newServer, costMonthly: e.target.value })} />
              <Button className="w-full" onClick={handleAddServer} disabled={!newServer.name.trim() || !newServer.provider.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Add server
              </Button>
            </div>
          </SectionHeader>
          <div className="mt-3 space-y-2.5">
            {servers.map((s) => (
              <div key={s.id} className="group/row flex items-center gap-2 text-sm">
                {canEdit ? (
                  <Select value={s.status} onValueChange={(v) => handleServerStatus(s.id, v as DeployServerStatus)}>
                    <SelectTrigger
                      aria-label={`Status: ${s.status}`}
                      title={s.status}
                      className="h-auto w-auto border-0 bg-transparent p-1 shadow-none [&>svg]:hidden"
                    >
                      <span className={cn('block h-2 w-2 rounded-full', STATUS_DOT[s.status])} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">planned</SelectItem>
                      <SelectItem value="provisioning">provisioning</SelectItem>
                      <SelectItem value="live">live</SelectItem>
                      <SelectItem value="retired">retired</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span title={s.status} className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[s.status])} />
                )}
                <span className="font-medium">{s.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[s.provider, s.region, s.specs, s.ip, s.os, s.costMonthly].filter(Boolean).join(' · ')}
                </span>
                {canEdit && (
                  <button
                    onClick={() => handleDeleteServer(s.id)}
                    className="ml-auto text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                    aria-label="Delete server"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {servers.length === 0 && <p className="text-xs italic text-muted-foreground/60">None yet</p>}
          </div>
        </section>
      )}

      {/* Domains */}
      {showDomains && (
        <section className="px-5 py-4">
          <SectionHeader title="Domains" icon={Globe} accent={SECTION_ACCENT.domains} canEdit={canEdit} open={domainOpen} onOpenChange={setDomainOpen}>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">New domain</p>
              <Input placeholder="Domain (app.example.com)" value={newDomain.domain} onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })} autoFocus />
              <Input placeholder="Target (portal :3000)" value={newDomain.target} onChange={(e) => setNewDomain({ ...newDomain, target: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="DNS (Cloudflare…)" value={newDomain.dnsProvider} onChange={(e) => setNewDomain({ ...newDomain, dnsProvider: e.target.value })} />
                <Select value={newDomain.ssl} onValueChange={(v) => setNewDomain({ ...newDomain, ssl: v as DeployDomainSsl })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lets_encrypt">Let&apos;s Encrypt</SelectItem>
                    <SelectItem value="cloudflare">Cloudflare</SelectItem>
                    <SelectItem value="custom">Custom cert</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleAddDomain} disabled={!newDomain.domain.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Add domain
              </Button>
            </div>
          </SectionHeader>
          <div className="mt-3 space-y-2.5">
            {domains.map((d) => (
              <div key={d.id} className="group/row flex items-center gap-2 text-sm">
                <span title={SSL_LABEL[d.ssl]} className="shrink-0">
                  {d.ssl === 'none' ? (
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </span>
                <a
                  href={`https://${d.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                >
                  {d.domain}
                </a>
                <span className="truncate text-xs text-muted-foreground">
                  {[d.target && `→ ${d.target}`, d.dnsProvider].filter(Boolean).join(' · ')}
                </span>
                {canEdit && (
                  <button
                    onClick={() => handleDeleteDomain(d.id)}
                    className="ml-auto text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                    aria-label="Delete domain"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {domains.length === 0 && <p className="text-xs italic text-muted-foreground/60">None yet</p>}
          </div>
        </section>
      )}

      {/* Technologies */}
      {showTech && (
        <section className="px-5 py-4">
          <SectionHeader title="Stack" icon={Boxes} accent={SECTION_ACCENT.stack} canEdit={canEdit} open={techOpen} onOpenChange={setTechOpen}>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">New technology</p>
              <Input
                placeholder="Docker, Caddy 2, Postgres 17…"
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTech() } }}
                autoFocus
              />
              <Button className="w-full" onClick={handleAddTech} disabled={!newTech.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </SectionHeader>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {technologies.map((t) => (
              <span
                key={t}
                className="group/chip inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-foreground/80 transition hover:bg-muted"
              >
                <TechIcon label={t} />
                <span>{t}</span>
                {canEdit && (
                  <button
                    onClick={() => setTechnologies(technologies.filter((x) => x !== t))}
                    aria-label={`Remove ${t}`}
                    className="pointer-events-none w-0 overflow-hidden opacity-0 transition-all duration-200 text-muted-foreground/60 hover:text-destructive group-hover/chip:pointer-events-auto group-hover/chip:w-3 group-hover/chip:opacity-100 group-hover/chip:delay-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {technologies.length === 0 && <span className="italic text-muted-foreground/60">None yet</span>}
          </div>
        </section>
      )}

      {/* Infrastructure + Security notes */}
      {(showInfra || showSecurity) && (
        <section className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-4 md:grid-cols-2">
          {showInfra && (
            <NotesBlock label="Infrastructure" kind="infrastructure" icon={Network} accent={SECTION_ACCENT.infrastructure} value={infraNotes} canEdit={canEdit} onChange={setInfraNotes} />
          )}
          {showSecurity && (
            <NotesBlock label="Security" kind="security" icon={Shield} accent={SECTION_ACCENT.security} value={securityNotes} canEdit={canEdit} onChange={setSecurityNotes} />
          )}
        </section>
      )}
    </Card>

    {/* Right rail — Recommendations (minimized) */}
    {showRecs && (
      <Card className="px-4 py-3 lg:sticky lg:top-0">
        <SectionHeader
          title="Recommendations"
          icon={TriangleAlert}
          accent={SECTION_ACCENT.recommendations}
          canEdit={canEdit}
          open={recOpen}
          onOpenChange={setRecOpen}
          trailing={
            <>
              {openRecCount > 0 && (
                <span className="text-[11px] text-muted-foreground">{openRecCount} open</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={handleGenerateRecs}
                  disabled={generatingRecs}
                  title="AI: generate recommendations from build, repos & deploy context"
                  aria-label="Generate recommendations with AI"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground disabled:opacity-60"
                >
                  {generatingRecs
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Sparkles className="h-3.5 w-3.5" />}
                </button>
              )}
            </>
          }
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">New recommendation</p>
            <Input placeholder="Title" value={newRec.title} onChange={(e) => setNewRec({ ...newRec, title: e.target.value })} autoFocus />
            <Textarea placeholder="Detail / suggested fix" value={newRec.detail} onChange={(e) => setNewRec({ ...newRec, detail: e.target.value })} className="min-h-[80px] text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={newRec.severity} onValueChange={(v) => setNewRec({ ...newRec, severity: v as DeployRecSeverity })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">critical</SelectItem>
                  <SelectItem value="high">high</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="low">low</SelectItem>
                  <SelectItem value="info">info</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newRec.area} onValueChange={(v) => setNewRec({ ...newRec, area: v as DeployRecArea })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="security">security</SelectItem>
                  <SelectItem value="infrastructure">infrastructure</SelectItem>
                  <SelectItem value="optimization">optimization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAddRec} disabled={!newRec.title.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Add recommendation
            </Button>
          </div>
        </SectionHeader>
        <div className="mt-2.5 space-y-0.5">
          {recs.map((r) => {
            const sev = SEVERITY_STYLE[r.severity]
            const done = r.status !== 'open'
            const expanded = expandedRecId === r.id
            return (
              <div key={r.id}>
                <button
                  type="button"
                  onClick={() => setExpandedRecId(expanded ? null : r.id)}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-muted/50"
                >
                  <span title={r.severity} className={cn('h-1.5 w-1.5 shrink-0 rounded-full', sev.dot, done && 'opacity-40')} />
                  <span className={cn('min-w-0 flex-1 truncate text-xs', done && 'text-muted-foreground line-through decoration-muted-foreground/50')}>
                    {r.title}
                  </span>
                  <ChevronDown className={cn('h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform', expanded && 'rotate-180')} />
                </button>
                {expanded && (
                  <div className="ml-3 mt-1 mb-1.5 space-y-2 rounded-md bg-muted/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] uppercase tracking-wide', sev.label)}>{r.severity}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{r.area}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{r.detail || 'No detail.'}</p>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <Select value={r.status} onValueChange={(v) => handleRecStatus(r.id, v as DeployRecStatus)}>
                          <SelectTrigger className="h-6 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">open</SelectItem>
                            <SelectItem value="resolved">resolved</SelectItem>
                            <SelectItem value="dismissed">dismissed</SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => handleDeleteRec(r.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete recommendation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {recs.length === 0 && <p className="text-xs italic text-muted-foreground/60">None yet</p>}
        </div>
      </Card>
    )}
    </div>
  )
}
