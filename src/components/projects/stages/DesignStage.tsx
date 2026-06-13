'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Plus, Trash2, Check, Loader2, ChevronDown, Palette, MonitorSmartphone, Images,
  ExternalLink, Circle, CircleDot, CheckCircle2, type LucideIcon,
} from 'lucide-react'
import type {
  Project, DesignPrototype, DesignPrototypeKind, DesignPrototypeStatus,
  DesignScreen, DesignScreenStatus, DesignImage, DesignColor,
} from '@/types'
import { projectDesign, designPrototypes, designScreens, designImages } from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Props { project: Project; canEdit: boolean }

const AUTOSAVE_MS = 900

const ACCENT = {
  prototypes: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  screens: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  gallery: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  system: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
} as const

const PROTO_KIND_LABEL: Record<DesignPrototypeKind, string> = {
  html: 'HTML', figma: 'Figma', live: 'Live', other: 'Other',
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

export function DesignStage({ project, canEdit }: Props) {
  const { user } = useAuth()
  const [systemNotes, setSystemNotes] = useState('')
  const [colors, setColors] = useState<DesignColor[]>([])
  const [fonts, setFonts] = useState<string[]>([])
  const [iconSet, setIconSet] = useState('')
  const [prototypes, setPrototypes] = useState<DesignPrototype[]>([])
  const [screens, setScreens] = useState<DesignScreen[]>([])
  const [images, setImages] = useState<DesignImage[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [editingIcons, setEditingIcons] = useState(false)

  const [protoOpen, setProtoOpen] = useState(false)
  const [screenOpen, setScreenOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [fontOpen, setFontOpen] = useState(false)

  const [newProto, setNewProto] = useState({ name: '', url: '', kind: 'html' as DesignPrototypeKind })
  const [newScreen, setNewScreen] = useState({ group: '', title: '' })
  const [newImage, setNewImage] = useState({ url: '', caption: '' })
  const [newColor, setNewColor] = useState({ name: '', value: '#E66A4C' })
  const [newFont, setNewFont] = useState('')

  const hydratedRef = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [d, pr, sc, im] = await Promise.all([
        projectDesign.get(project.id),
        designPrototypes.listByProject(project.id),
        designScreens.listByProject(project.id),
        designImages.listByProject(project.id),
      ])
      if (cancelled) return
      setSystemNotes(d?.designSystemNotes ?? '')
      setColors(d?.colors ?? [])
      setFonts(d?.fonts ?? [])
      setIconSet(d?.iconSet ?? '')
      setPrototypes(pr)
      setScreens(sc)
      setImages(im)
      requestAnimationFrame(() => { hydratedRef.current = true })
    })()
    return () => { cancelled = true }
  }, [project.id])

  // Debounced autosave for design-system notes.
  useEffect(() => {
    if (!hydratedRef.current || !canEdit || !user) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    setSaveState('saving')
    autosaveTimer.current = setTimeout(async () => {
      try {
        await projectDesign.save(project.id, {
          designSystemNotes: systemNotes,
          colors,
          fonts,
          iconSet: iconSet.trim() || null,
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
  }, [systemNotes, colors, fonts, iconSet])

  const cycleScreenStatus = async (s: DesignScreen) => {
    if (!user || !canEdit) return
    const next: DesignScreenStatus = s.status === 'todo' ? 'designed' : s.status === 'designed' ? 'approved' : 'todo'
    setScreens((curr) => curr.map((i) => (i.id === s.id ? { ...i, status: next } : i)))
    await designScreens.setStatus(s.id, project.id, next, user.uid)
  }

  const screenGroups = Array.from(new Set(screens.map((s) => s.group)))
  const showProtos = canEdit || prototypes.length > 0
  const showGallery = canEdit || images.length > 0
  const showNotes = canEdit || !!systemNotes.trim() || colors.length > 0 || fonts.length > 0 || !!iconSet.trim()

  const isHttp = (u: string) => /^https?:\/\//i.test(u)

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[60fr_40fr] lg:items-start">
    <Card className="divide-y">
      {/* Prototypes */}
      {showProtos && (
        <section className="px-5 py-4">
          <SectionHeader title="Prototypes" icon={MonitorSmartphone} accent={ACCENT.prototypes} canEdit={canEdit} open={protoOpen} onOpenChange={setProtoOpen}>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">New prototype</p>
              <Input placeholder="Name (User Journeys canvas…)" value={newProto.name} onChange={(e) => setNewProto({ ...newProto, name: e.target.value })} autoFocus />
              <Input placeholder="URL or file path" value={newProto.url} onChange={(e) => setNewProto({ ...newProto, url: e.target.value })} />
              <Select value={newProto.kind} onValueChange={(v) => setNewProto({ ...newProto, kind: v as DesignPrototypeKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">HTML prototype</SelectItem>
                  <SelectItem value="figma">Figma</SelectItem>
                  <SelectItem value="live">Live preview</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full" disabled={!newProto.name.trim() || !newProto.url.trim()} onClick={async () => {
                if (!user) return
                setProtoOpen(false)
                await designPrototypes.add({ projectId: project.id, name: newProto.name.trim(), url: newProto.url.trim(), kind: newProto.kind }, user.uid)
                setNewProto({ name: '', url: '', kind: 'html' })
                setPrototypes(await designPrototypes.listByProject(project.id))
              }}>
                <Plus className="mr-1 h-4 w-4" /> Add prototype
              </Button>
            </div>
          </SectionHeader>
          <div className="mt-3 space-y-2">
            {prototypes.map((p) => (
              <div key={p.id} className="group/row flex items-center gap-2 text-sm">
                <span className={cn(
                  'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  p.status === 'final' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                )}>
                  {PROTO_KIND_LABEL[p.kind]}
                </span>
                {isHttp(p.url) ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium hover:underline">
                    <span className="truncate">{p.name}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                  </a>
                ) : (
                  <span title={p.url} className="min-w-0 truncate font-medium">{p.name}</span>
                )}
                {!isHttp(p.url) && (
                  <code className="hidden min-w-0 max-w-[40%] truncate rounded bg-muted px-1.5 py-0.5 text-[10px] sm:inline">{p.url}</code>
                )}
                {canEdit && (
                  <span className="ml-auto flex items-center gap-2">
                    <Select value={p.status} onValueChange={async (v) => {
                      if (!user) return
                      await designPrototypes.update(p.id, project.id, { status: v as DesignPrototypeStatus }, user.uid)
                      setPrototypes(await designPrototypes.listByProject(project.id))
                    }}>
                      <SelectTrigger className="h-6 w-20 border-0 bg-transparent text-xs shadow-none hover:bg-muted"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">draft</SelectItem>
                        <SelectItem value="final">final</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={async () => {
                        if (!user) return
                        await designPrototypes.remove(p.id, project.id, user.uid)
                        setPrototypes(await designPrototypes.listByProject(project.id))
                      }}
                      className="text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                      aria-label="Delete prototype"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
            ))}
            {prototypes.length === 0 && <p className="text-xs italic text-muted-foreground/60">None yet</p>}
          </div>
        </section>
      )}

      {/* Gallery */}
      {showGallery && (
        <section className="px-5 py-4">
          <SectionHeader title="Gallery" icon={Images} accent={ACCENT.gallery} canEdit={canEdit} open={imageOpen} onOpenChange={setImageOpen}>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">New image</p>
              <Input placeholder="Image URL" value={newImage.url} onChange={(e) => setNewImage({ ...newImage, url: e.target.value })} autoFocus />
              <Input placeholder="Caption (optional)" value={newImage.caption} onChange={(e) => setNewImage({ ...newImage, caption: e.target.value })} />
              <Button className="w-full" disabled={!newImage.url.trim()} onClick={async () => {
                if (!user) return
                setImageOpen(false)
                await designImages.add({ projectId: project.id, url: newImage.url.trim(), caption: newImage.caption.trim() || null }, user.uid)
                setNewImage({ url: '', caption: '' })
                setImages(await designImages.listByProject(project.id))
              }}>
                <Plus className="mr-1 h-4 w-4" /> Add image
              </Button>
            </div>
          </SectionHeader>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img) => (
              <div key={img.id} className="group/img relative aspect-square overflow-hidden rounded-md border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption ?? ''}
                  title={img.caption ?? undefined}
                  className="h-full w-full object-cover transition group-hover/img:scale-105"
                  loading="lazy"
                />
                {canEdit && (
                  <button
                    onClick={async () => {
                      if (!user) return
                      await designImages.remove(img.id, project.id, user.uid)
                      setImages(await designImages.listByProject(project.id))
                    }}
                    className="absolute right-1 top-1 hidden rounded-full bg-background/80 p-1 text-muted-foreground backdrop-blur-sm hover:text-destructive group-hover/img:block"
                    aria-label="Delete image"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            {images.length === 0 && <p className="col-span-full text-xs italic text-muted-foreground/60">None yet</p>}
          </div>
        </section>
      )}

      {/* Design system */}
      {showNotes && (
        <section className="px-5 py-4">
          <div className="flex items-center justify-between">
            <TitleChip label="Design System" icon={Palette} accent={ACCENT.system} />
            {canEdit && saveState !== 'idle' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                {saveState === 'saving'
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                  : <><Check className="h-3 w-3 text-green-600" /> Saved</>}
              </span>
            )}
          </div>

          <div className="mt-3 space-y-4">
            {/* Colors — swatch row */}
            {(canEdit || colors.length > 0) && (
              <div className="flex items-start gap-3">
                <p className="w-14 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Colors</p>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {colors.map((c) => (
                    <span key={`${c.name}_${c.value}`} className="group/sw inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 py-1 pl-1 pr-2.5">
                      <span
                        className="h-5 w-5 rounded-full border border-black/10 shadow-inner"
                        style={{ backgroundColor: c.value }}
                        title={c.value}
                      />
                      <span className="text-xs font-medium">{c.name}</span>
                      <code className="text-[10px] uppercase text-muted-foreground">{c.value}</code>
                      {canEdit && (
                        <button
                          onClick={() => setColors(colors.filter((x) => !(x.name === c.name && x.value === c.value)))}
                          aria-label={`Remove ${c.name}`}
                          className="hidden text-muted-foreground/60 hover:text-destructive group-hover/sw:inline"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {canEdit && (
                    <Popover open={colorOpen} onOpenChange={setColorOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Add color"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed text-muted-foreground/50 transition hover:bg-muted hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">New color</p>
                          <Input placeholder="Name (brand, accent, surface…)" value={newColor.name} onChange={(e) => setNewColor({ ...newColor, name: e.target.value })} autoFocus />
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={newColor.value}
                              onChange={(e) => setNewColor({ ...newColor, value: e.target.value })}
                              className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                            />
                            <Input value={newColor.value} onChange={(e) => setNewColor({ ...newColor, value: e.target.value })} className="font-mono" />
                          </div>
                          <Button className="w-full" disabled={!newColor.name.trim() || !/^#[0-9a-fA-F]{3,8}$/.test(newColor.value)} onClick={() => {
                            setColors([...colors, { name: newColor.name.trim(), value: newColor.value }])
                            setNewColor({ name: '', value: newColor.value })
                            setColorOpen(false)
                          }}>
                            <Plus className="mr-1 h-4 w-4" /> Add color
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  {colors.length === 0 && !canEdit && null}
                </div>
              </div>
            )}

            {/* Fonts — chips */}
            {(canEdit || fonts.length > 0) && (
              <div className="flex items-start gap-3">
                <p className="w-14 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Fonts</p>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {fonts.map((f) => (
                    <span key={f} className="group/ft inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
                      <span className="font-medium">{f}</span>
                      {canEdit && (
                        <button
                          onClick={() => setFonts(fonts.filter((x) => x !== f))}
                          aria-label={`Remove ${f}`}
                          className="hidden text-muted-foreground/60 hover:text-destructive group-hover/ft:inline"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {canEdit && (
                    <Popover open={fontOpen} onOpenChange={setFontOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Add font"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed text-muted-foreground/50 transition hover:bg-muted hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">New font</p>
                          <Input
                            placeholder="IBM Plex Sans Arabic…"
                            value={newFont}
                            onChange={(e) => setNewFont(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newFont.trim()) {
                                e.preventDefault()
                                if (!fonts.includes(newFont.trim())) setFonts([...fonts, newFont.trim()])
                                setNewFont('')
                                setFontOpen(false)
                              }
                            }}
                            autoFocus
                          />
                          <Button className="w-full" disabled={!newFont.trim()} onClick={() => {
                            if (!fonts.includes(newFont.trim())) setFonts([...fonts, newFont.trim()])
                            setNewFont('')
                            setFontOpen(false)
                          }}>
                            <Plus className="mr-1 h-4 w-4" /> Add font
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            )}

            {/* Icons — inline editable */}
            {(canEdit || !!iconSet.trim()) && (
              <div className="flex items-start gap-3">
                <p className="w-14 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Icons</p>
                {editingIcons && canEdit ? (
                  <Input
                    value={iconSet}
                    onChange={(e) => setIconSet(e.target.value)}
                    onBlur={() => setEditingIcons(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingIcons(false) }}
                    autoFocus
                    placeholder="Phosphor 2.1.1 / Lucide…"
                    className="h-7 max-w-xs text-xs"
                  />
                ) : iconSet.trim() ? (
                  <span
                    onClick={canEdit ? () => setEditingIcons(true) : undefined}
                    className={cn(
                      'rounded-md px-1.5 py-1 text-xs font-medium',
                      canEdit && 'cursor-text transition hover:bg-muted/50',
                    )}
                    title={canEdit ? 'Click to edit' : undefined}
                  >
                    {iconSet}
                  </span>
                ) : canEdit ? (
                  <button
                    type="button"
                    onClick={() => setEditingIcons(true)}
                    className="pt-1 text-xs italic text-muted-foreground/60 hover:text-muted-foreground"
                  >
                    Set icon family…
                  </button>
                ) : null}
              </div>
            )}

            {/* Notes — conventions prose */}
            <div className="flex items-start gap-3">
              <p className="w-14 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Notes</p>
              <div className="min-w-0 flex-1">
                {editingNotes && canEdit ? (
                  <Textarea
                    value={systemNotes}
                    onChange={(e) => setSystemNotes(e.target.value)}
                    onBlur={() => setEditingNotes(false)}
                    autoFocus
                    className="min-h-[120px] resize-y text-sm"
                  />
                ) : systemNotes.trim() ? (
                  <div>
                    <p
                      onClick={canEdit ? () => setEditingNotes(true) : undefined}
                      className={cn(
                        'whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground',
                        !notesExpanded && 'line-clamp-2',
                        canEdit && 'cursor-text rounded-md -mx-1.5 px-1.5 py-1 transition hover:bg-muted/50',
                      )}
                      title={canEdit ? 'Click to edit' : undefined}
                    >
                      {systemNotes}
                    </p>
                    {systemNotes.length > 160 && (
                      <button
                        type="button"
                        onClick={() => setNotesExpanded((v) => !v)}
                        className="mt-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground"
                      >
                        {notesExpanded ? 'less' : 'more…'}
                      </button>
                    )}
                  </div>
                ) : canEdit ? (
                  <button
                    type="button"
                    onClick={() => setEditingNotes(true)}
                    className="text-sm italic text-muted-foreground/60 hover:text-muted-foreground"
                  >
                    Click to describe conventions, theming approach, spacing rules…
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      )}
    </Card>

    {/* Right rail — Screens checklist */}
    <Card className="px-4 py-3 lg:sticky lg:top-0">
      <SectionHeader
        title="Screens"
        icon={MonitorSmartphone}
        accent={ACCENT.screens}
        canEdit={canEdit}
        open={screenOpen}
        onOpenChange={setScreenOpen}
        trailing={screens.length > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground/60">
            {screens.filter((s) => s.status === 'approved').length}/{screens.length}
          </span>
        ) : undefined}
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">New screen</p>
          <Input placeholder="Group (Cashier mobile / Admin desktop…)" value={newScreen.group} onChange={(e) => setNewScreen({ ...newScreen, group: e.target.value })} autoFocus />
          <Input placeholder="Screen title" value={newScreen.title} onChange={(e) => setNewScreen({ ...newScreen, title: e.target.value })} />
          <Button className="w-full" disabled={!newScreen.title.trim()} onClick={async () => {
            if (!user) return
            setScreenOpen(false)
            await designScreens.add({ projectId: project.id, group: newScreen.group.trim() || 'General', title: newScreen.title.trim() }, user.uid)
            setNewScreen({ group: newScreen.group, title: '' })
            setScreens(await designScreens.listByProject(project.id))
          }}>
            <Plus className="mr-1 h-4 w-4" /> Add screen
          </Button>
        </div>
      </SectionHeader>

      <div className="mt-2.5 space-y-3">
        {screens.length === 0 && (
          <p className="text-sm italic text-muted-foreground/60">
            No screens yet — track each screen from todo → designed → approved.
          </p>
        )}
        {screenGroups.map((group) => {
          const items = screens.filter((s) => s.group === group)
          const approved = items.filter((s) => s.status === 'approved').length
          return (
            <div key={group}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{group}</p>
                <span className="text-xs tabular-nums text-muted-foreground/60">{approved}/{items.length}</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {items.map((s) => (
                  <div key={s.id} className="group/row flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cycleScreenStatus(s)}
                      disabled={!canEdit}
                      title={s.status}
                      aria-label={`Status: ${s.status} — click to cycle`}
                      className="shrink-0 disabled:cursor-default"
                    >
                      {s.status === 'approved'
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        : s.status === 'designed'
                          ? <CircleDot className="h-3.5 w-3.5 text-pink-500" />
                          : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    </button>
                    <span className={cn('min-w-0 flex-1 truncate text-sm', s.status === 'approved' && 'text-muted-foreground line-through decoration-muted-foreground/50')}>
                      {s.title}
                    </span>
                    {canEdit && (
                      <button
                        onClick={async () => {
                          if (!user) return
                          await designScreens.remove(s.id, project.id, user.uid)
                          setScreens(await designScreens.listByProject(project.id))
                        }}
                        className="text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                        aria-label="Delete screen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
    </div>
  )
}
