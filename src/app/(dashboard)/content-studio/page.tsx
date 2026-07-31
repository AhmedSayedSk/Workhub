'use client'

import { useState, useEffect, useRef } from 'react'
import { authFetch } from '@/lib/api-client'
import { useAuth } from '@/hooks/useAuth'
import { useImageGenerator } from '@/hooks/useImageGenerator'
import { useImageApi } from '@/hooks/useImageApi'
import { useImageSessions } from '@/hooks/useImageSessions'
import { SessionSidebar } from '@/components/image-generator/SessionSidebar'
import { CampaignTab } from '@/components/image-generator/campaign/CampaignTab'
import { HeaderCenter } from '@/components/layout/HeaderActions'
import type { ImageGenSession } from '@/types'
import { useSettings } from '@/hooks/useSettings'
import { useModulePermissions } from '@/hooks/usePermissions'
import { ImageGeneration, ImageGenModel, ImageGenAspectRatio, ImageAsset, ImageAssetFolder, ImageGenLog, CalendarEvent } from '@/types'
import { imageAssets, imageAssetFolders, imageGenLogs } from '@/lib/firestore'
import { uploadBlob } from '@/lib/storage'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sparkles,
  Download,
  FolderOpen,
  Trash2,
  Copy,
  Loader2,
  Wand2,
  Check,
  X,
  Settings,
  AlertTriangle,
  Info,
  UserPlus,
  RefreshCw,
  Activity,
  Shield,
  ShieldAlert,
  Mail,
  RectangleHorizontal,
  Square,
  RectangleVertical,
  Send,
  Sliders,
  CircleStop,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Image as ImageIcon,
  PanelRightOpen,
  PanelRightClose,
  Plus,
  Upload,
  Folder,
  FolderPlus,
  ArrowLeft,
  Pencil,
  CalendarDays,
  CalendarPlus,
  Megaphone,
} from 'lucide-react'
import { cn, getUrlParam, setUrlParam } from '@/lib/utils'
import { IMAGE_GEN_MODELS, modelLabel, normalizeModel } from '@/lib/imageModels'

function formatFileSize(bytes: number | undefined) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(ts: { toMillis: () => number } | undefined) {
  if (!ts?.toMillis) return ''
  const diff = Date.now() - ts.toMillis()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts.toMillis()).toLocaleDateString()
}

function ImageCard({ gen, onPreview, onDownload, onDelete, onAssignEvent }: {
  gen: ImageGeneration
  onPreview: (g: ImageGeneration) => void
  onDownload: (g: ImageGeneration) => void
  onDelete: (id: string) => void
  onAssignEvent?: (g: ImageGeneration) => void
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className="group relative rounded-2xl overflow-hidden border bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 hover:shadow-lg transition-all"
      onClick={() => onPreview(gen)}
    >
      {/* Image always renders for natural sizing — spinner overlays until loaded */}
      <img
        src={gen.imageUrl}
        alt={gen.prompt}
        className={cn("w-full h-auto block transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      )}

      {/* Hover overlay */}
      {loaded && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Top actions */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={e => { e.stopPropagation(); onDownload(gen) }}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={e => { e.stopPropagation(); onDelete(gen.id) }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {onAssignEvent && (
              <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={e => { e.stopPropagation(); onAssignEvent(gen) }}>
                <CalendarPlus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Saved badge */}
          {gen.savedToMedia && (
            <div className="absolute top-2 left-2">
              <div className="bg-green-500 text-white rounded-full p-0.5 shadow-sm"><Check className="h-3 w-3" /></div>
            </div>
          )}

          {/* Always-visible model badge (yields to the richer info on hover) */}
          <div className="absolute bottom-2 left-2 opacity-100 group-hover:opacity-0 transition-opacity">
            <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              {modelLabel(gen.model)}
            </span>
          </div>

          {/* Bottom info overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 text-[10px] text-white/70">
              <span className="font-medium">{modelLabel(gen.model)}</span>
              <span className="opacity-40">·</span>
              <span>{timeAgo(gen.createdAt)}</span>
              <span className="flex-1" />
              <span>{gen.fileSize ? formatFileSize(gen.fileSize) : '...'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


function EventCardGrid({ events, onSelect, disabled }: {
  events: CalendarEvent[]
  onSelect: (evt: CalendarEvent) => void
  disabled?: boolean
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No events found</p>
  }
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {events.map(evt => (
          <button
            key={evt.id}
            className="text-left rounded-xl border bg-card overflow-hidden hover:ring-2 hover:ring-primary hover:shadow-md transition-all disabled:opacity-50 flex flex-col"
            disabled={disabled}
            onClick={() => onSelect(evt)}
          >
            {evt.imageUrl && (
              <div className="w-full h-24 bg-muted flex-shrink-0">
                <img src={evt.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-3">
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {evt.start?.toDate?.() ? evt.start.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </span>
              </div>
              <p className="text-sm font-semibold line-clamp-2 leading-snug">{evt.title}</p>
              {evt.description && (
                <p className="text-xs text-muted-foreground line-clamp-3 mt-1.5 leading-relaxed">{evt.description}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ImageGeneratorPage() {
  const { user } = useAuth()
  const { canModule, loading: permsLoading } = useModulePermissions()
  const {
    generations, isGenerating, isLoading,
    error: generationError, clearError,
    generate, cancelGeneration, saveToMediaLibrary, deleteGeneration,
  } = useImageGenerator()
  const {
    settings, updateSettings,
    setImageGenModel, setImageGenEnabled,
  } = useSettings()
  // Server capabilities. Both are booleans from the server — no credential is
  // ever sent to the browser, and none is ever sent back.
  const [managed, setManaged] = useState(false)
  const [imageGenReady, setImageGenReady] = useState(true)
  const {
    accounts, jobs, loadingAccounts, loadingJobs,
    registering, deletingEmail,
    fetchAccounts, registerAccount, deleteAccount, fetchJobs,
    fetchCaptchaProviders, setCaptchaProviders,
  } = useImageApi(managed)
  const {
    sessions, activeSessionId, activeSession,
    setActiveSessionId, createSession, renameSession,
    setStandingPrompt: setSessionStandingPrompt, removeSession, touchSession,
  } = useImageSessions(settings?.imageGenStandingPrompt || '')

  const [prompt, setPrompt] = useState('')
  const promptHistoryRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const draftRef = useRef('')
  const [aspectRatio, setAspectRatio] = useState<ImageGenAspectRatio>('landscape')
  const [imageCount, setImageCount] = useState(2)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(true)

  const [uploadingPlaceholders, setUploadingPlaceholders] = useState<string[]>([])
  const [assetsPanelOpen, setAssetsPanelOpen] = useState(true)
  const [selectedRefs, setSelectedRefs] = useState<string[]>([])
  const [savedAssets, setSavedAssets] = useState<ImageAsset[]>([])
  const [allAssets, setAllAssets] = useState<ImageAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const assetFileInputRef = useRef<HTMLInputElement>(null)

  // Asset folders
  const [assetFolders, setAssetFolders] = useState<ImageAssetFolder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renamingFolderName, setRenamingFolderName] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Preview dialog
  const [previewImage, setPreviewImage] = useState<ImageGeneration | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOffset = useRef({ x: 0, y: 0 })
  const zoomContainerRef = useRef<HTMLDivElement>(null)

  // Settings modal
  const [settingsModel, setSettingsModel] = useState<ImageGenModel | ''>('')
  const [settingsEnabled, setSettingsEnabled] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [standingPromptOpen, setStandingPromptOpen] = useState(false)
  const [standingPromptDraft, setStandingPromptDraft] = useState('')
  const [savingStandingPrompt, setSavingStandingPrompt] = useState(false)

  // Register / refresh account modal
  const [registerOpen, setRegisterOpen] = useState(false)
  const [cookiesInput, setCookiesInput] = useState('')
  const [refreshEmail, setRefreshEmail] = useState<string | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)

  // Captcha providers
  const [captchaOpen, setCaptchaOpen] = useState(false)
  const [captchaProvider, setCaptchaProvider] = useState('SolveCaptcha')
  const [captchaApiKey, setCaptchaApiKey] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [captchaCurrent, setCaptchaCurrent] = useState<Record<string, string> | null>(null)

  // Generation logs (persistent stats)
  const [genLogs, setGenLogs] = useState<ImageGenLog[]>([])

  // Active tab
  const [activeTab, setActiveTab] = useState('generate')

  // Persist the active tab in the URL (?tab=) so a refresh restores it.
  useEffect(() => {
    const t = getUrlParam('tab')
    if (t && t !== activeTab) setActiveTab(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    setUrlParam('tab', activeTab === 'generate' ? null : activeTab)
  }, [activeTab])

  // Calendar events integration
  const { events: calendarEvents, updateEvent } = useCalendarEvents()
  const [eventPopoverOpen, setEventPopoverOpen] = useState(false)
  const [assignEventOpen, setAssignEventOpen] = useState<string | null>(null)
  const [eventSearchQuery, setEventSearchQuery] = useState('')


  const filteredCalendarEvents = calendarEvents
    .filter(e => {
      if (!eventSearchQuery.trim()) return true
      const q = eventSearchQuery.toLowerCase()
      return e.title.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q)
    })
    .sort((a, b) => (a.start?.toMillis?.() || 0) - (b.start?.toMillis?.() || 0))

  // Load prompt history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('imageGenPromptHistory')
      if (saved) promptHistoryRef.current = JSON.parse(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (settings) {
      setSettingsModel(normalizeModel(settings.imageGenModel))
      setSettingsEnabled(settings.imageGenEnabled !== false)
    }
  }, [settings])

  // Ask the server what it can do: generate images, and manage accounts.
  useEffect(() => {
    authFetch('/api/ai/image?action=status')
      .then((r) => r.json())
      .then((d) => {
        setManaged(!!d?.data?.managed)
        setImageGenReady(d?.data?.imageGen !== false)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab === 'accounts' && managed) fetchAccounts()
    // Usage stats live under the Accounts tab (Jobs was merged in), so load the
    // generation logs whenever Accounts is open.
    if (activeTab === 'accounts' && user) {
      imageGenLogs.getAll(user.uid).then(setGenLogs).catch(() => {})
    }
  }, [activeTab, managed, fetchAccounts, fetchJobs, user])

  // Auto-fetch jobs stats when quota error appears
  useEffect(() => {
    if (generationError?.type === 'quota' && managed) fetchJobs()
  }, [generationError?.type]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSavedAssets = async () => {
    if (!user) return
    setLoadingAssets(true)
    try {
      const [data, folders] = await Promise.all([
        imageAssets.getAll(user.uid),
        imageAssetFolders.getAll(user.uid),
      ])
      setAllAssets(data)
      setAssetFolders(folders)
      // Filter for current view
      if (currentFolderId === null) {
        setSavedAssets(data.filter(a => !a.folderId))
      } else {
        setSavedAssets(data.filter(a => a.folderId === currentFolderId))
      }
    } catch (err) {
      console.error('Failed to load assets:', err)
    } finally {
      setLoadingAssets(false)
    }
  }

  // Load assets on mount
  useEffect(() => {
    if (user) loadSavedAssets()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-filter assets when folder changes
  useEffect(() => {
    if (currentFolderId === null) {
      setSavedAssets(allAssets.filter(a => !a.folderId))
    } else {
      setSavedAssets(allAssets.filter(a => a.folderId === currentFolderId))
    }
  }, [currentFolderId, allAssets])

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return
    const name = newFolderName.trim()
    setNewFolderName('')
    setShowNewFolderInput(false)
    const id = await imageAssetFolders.create({ name, color: '#6366f1', userId: user.uid })
    const folder: ImageAssetFolder = {
      id,
      name,
      color: '#6366f1',
      userId: user.uid,
      createdAt: { toMillis: () => Date.now() } as ImageAssetFolder['createdAt'],
      updatedAt: { toMillis: () => Date.now() } as ImageAssetFolder['updatedAt'],
    }
    setAssetFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const handleRenameFolder = async (folderId: string) => {
    if (!renamingFolderName.trim()) { setRenamingFolderId(null); return }
    await imageAssetFolders.update(folderId, { name: renamingFolderName.trim() })
    setAssetFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: renamingFolderName.trim() } : f).sort((a, b) => a.name.localeCompare(b.name)))
    setRenamingFolderId(null)
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!user) return
    setAssetFolders(prev => prev.filter(f => f.id !== folderId))
    setAllAssets(prev => prev.filter(a => a.folderId !== folderId))
    if (currentFolderId === folderId) setCurrentFolderId(null)
    const deletedPaths = await imageAssetFolders.deleteCascade(folderId, user.uid)
    const { deleteFile } = await import('@/lib/storage')
    for (const p of deletedPaths) deleteFile(p).catch(() => {})
  }

  const getFolderAssetCount = (folderId: string) => {
    return allAssets.filter(a => a.folderId === folderId).length
  }

  const getFolderPreviews = (folderId: string) => {
    return allAssets.filter(a => a.folderId === folderId).slice(0, 4)
  }

  const createThumbnail = (blob: Blob, maxSize: number): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize } }
        else { if (h > maxSize) { w = w * maxSize / h; h = maxSize } }
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        canvas.toBlob(b => resolve(b || blob), 'image/jpeg', 0.7)
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(blob)
    })
  }

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !user) return
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const placeholderId = `uploading_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      setUploadingPlaceholders(prev => [...prev, placeholderId])
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const blob = await (await fetch(reader.result as string)).blob()
          const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'

          // Upload full size
          const fullStoragePath = `ai-assets/${user.uid}/${uid}_full.${ext}`
          const fullUrl = await uploadBlob(blob, fullStoragePath)

          // Create + upload thumbnail (300px max)
          const thumbBlob = await createThumbnail(blob, 300)
          const thumbStoragePath = `ai-assets/${user.uid}/${uid}_thumb.jpg`
          const thumbnailUrl = await uploadBlob(thumbBlob, thumbStoragePath)

          const id = await imageAssets.create({
            mediaGenerationId: '',
            name: file.name,
            fullUrl,
            fullStoragePath,
            thumbnailUrl,
            storagePath: thumbStoragePath,
            folderId: currentFolderId,
            userId: user.uid,
          })
          const newAsset: ImageAsset = {
            id,
            mediaGenerationId: '',
            name: file.name,
            fullUrl,
            fullStoragePath,
            thumbnailUrl,
            storagePath: thumbStoragePath,
            folderId: currentFolderId,
            userId: user.uid,
            createdAt: { toMillis: () => Date.now() } as ImageAsset['createdAt'],
          }
          setAllAssets(prev => [newAsset, ...prev])
          setSavedAssets(prev => [newAsset, ...prev])
        } catch (err) {
          console.error('Failed to upload asset:', err)
        } finally {
          setUploadingPlaceholders(prev => prev.filter(p => p !== placeholderId))
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const openPreview = (gen: ImageGeneration) => {
    setPreviewImage(gen)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const previewIndex = previewImage ? generations.findIndex(g => g.id === previewImage.id) : -1
  const hasPrev = previewIndex > 0
  const hasNext = previewIndex >= 0 && previewIndex < generations.length - 1

  const goToPrev = () => {
    if (hasPrev) {
      setPreviewImage(generations[previewIndex - 1])
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  }

  const goToNext = () => {
    if (hasNext) {
      setPreviewImage(generations[previewIndex + 1])
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  }

  // Keyboard navigation for preview
  useEffect(() => {
    if (!previewImage) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); goToNext() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.5, 5))
  const handleZoomOut = () => {
    setZoom(z => {
      const next = Math.max(z - 0.5, 1)
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  // Attach non-passive wheel listener for zoom
  useEffect(() => {
    const el = zoomContainerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY < 0) {
        setZoom(z => Math.min(z + 0.25, 5))
      } else {
        setZoom(z => {
          const next = Math.max(z - 0.25, 1)
          if (next === 1) setPan({ x: 0, y: 0 })
          return next
        })
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [previewImage])

  const handlePanStart = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY }
    panOffset.current = { ...pan }
  }

  const handlePanMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return
    setPan({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y),
    })
  }

  const handlePanEnd = () => { isPanning.current = false }

  const handleOpenSettings = () => {
    if (settings) {
      setSettingsModel(normalizeModel(settings.imageGenModel))
      setSettingsEnabled(settings.imageGenEnabled !== false)
    }
    setActiveTab('settings')
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      if (settingsModel) await setImageGenModel(settingsModel)
      await setImageGenEnabled(settingsEnabled)
      toast.success('Settings saved')
    } catch {} finally { setSavingSettings(false) }
  }

  const handleRegister = async () => {
    if (!cookiesInput.trim()) return
    setRegisterError(null)
    const result = await registerAccount(cookiesInput.trim())
    if (result.success) {
      setCookiesInput('')
      setRefreshEmail(null)
      setRegisterError(null)
      setRegisterOpen(false)
    } else {
      setRegisterError(result.error || 'An error occurred')
    }
  }

  const openRefreshSession = (email: string) => {
    setRefreshEmail(email)
    setCookiesInput('')
    setRegisterError(null)
    setRegisterOpen(true)
  }

  const openRegisterNew = () => {
    setRefreshEmail(null)
    setCookiesInput('')
    setRegisterError(null)
    setRegisterOpen(true)
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    // Save prompt to history
    const trimmed = prompt.trim()
    const history = promptHistoryRef.current
    // Remove duplicate if exists, then prepend
    const idx = history.indexOf(trimmed)
    if (idx !== -1) history.splice(idx, 1)
    history.unshift(trimmed)
    // Cap at 50 entries
    if (history.length > 50) history.length = 50
    promptHistoryRef.current = history
    historyIndexRef.current = -1
    draftRef.current = ''
    try { localStorage.setItem('imageGenPromptHistory', JSON.stringify(history)) } catch {}

    // Reference images are not supported by the image service: it takes
    // reference ids from its own previous results, not uploaded bytes. Selected
    // assets are therefore not sent — say so rather than silently ignoring them.
    if (selectedRefs.length > 0) {
      toast.info('Reference images aren\u2019t supported yet — generating from the prompt only.')
    }

    const standingPrompt = activeSession?.standingPrompt?.trim()
    const fullPrompt = standingPrompt ? `${standingPrompt}\n${prompt.trim()}` : prompt.trim()
    if (activeSessionId) touchSession(activeSessionId)
    await generate(fullPrompt, aspectRatio, imageCount, settings, undefined, activeSessionId || undefined)
  }

  // Auto-resize textarea when tab switches back or prompt is pre-filled
  useEffect(() => {
    const el = textareaRef.current
    if (el && prompt) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 300) + 'px'
    }
  }, [activeTab, prompt])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating) handleGenerate()

    const history = promptHistoryRef.current
    if (history.length === 0) return

    if (e.key === 'ArrowUp') {
      // Only navigate when cursor is at the start (no multiline selection)
      const el = e.currentTarget
      if (el.selectionStart !== 0 || el.selectionStart !== el.selectionEnd) return

      e.preventDefault()
      if (historyIndexRef.current === -1) {
        // Save current draft before navigating
        draftRef.current = prompt
      }
      const next = Math.min(historyIndexRef.current + 1, history.length - 1)
      historyIndexRef.current = next
      setPrompt(history[next])
    }

    if (e.key === 'ArrowDown') {
      if (historyIndexRef.current === -1) return
      const el = e.currentTarget
      if (el.selectionStart !== el.value.length || el.selectionStart !== el.selectionEnd) return

      e.preventDefault()
      const next = historyIndexRef.current - 1
      historyIndexRef.current = next
      if (next < 0) {
        setPrompt(draftRef.current)
      } else {
        setPrompt(history[next])
      }
    }
  }

  const handleDownload = async (generation: ImageGeneration) => {
    try {
      // Use image-proxy for Firebase Storage URLs to bypass CORS
      const isFirebaseUrl = generation.imageUrl.includes('firebasestorage.googleapis.com')
      const fetchUrl = isFirebaseUrl
        ? `/api/image-proxy?url=${encodeURIComponent(generation.imageUrl)}`
        : generation.imageUrl
      const response = await fetch(fetchUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-image-${generation.id}.${generation.mimeType.split('/')[1] || 'png'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { window.open(generation.imageUrl, '_blank') }
  }

  const handleCopyPrompt = (generation: ImageGeneration) => {
    navigator.clipboard.writeText(generation.prompt)
    setCopiedId(generation.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleImportEventDescription = (event: CalendarEvent) => {
    const text = event.description || event.title
    setPrompt(text)
    setEventPopoverOpen(false)
    setEventSearchQuery('')
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.scrollTop = 0
      }
    }, 100)
  }

  const [confirmAssignEvent, setConfirmAssignEvent] = useState<{ generation: ImageGeneration; event: CalendarEvent } | null>(null)

  const handleAssignToEvent = (generation: ImageGeneration, event: CalendarEvent) => {
    // Close dialogs immediately and process in background
    setConfirmAssignEvent(null)
    setAssignEventOpen(null)
    setEventSearchQuery('')
    toast.info(`Assigning image to "${event.title}"...`)

    const doAssign = async () => {
      try {
        const isFirebaseUrl = generation.imageUrl.includes('firebasestorage.googleapis.com')
        const fetchUrl = isFirebaseUrl
          ? `/api/image-proxy?url=${encodeURIComponent(generation.imageUrl)}`
          : generation.imageUrl
        const response = await fetch(fetchUrl)
        const blob = await response.blob()
        const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
        const storagePath = `calendar-events/${user!.uid}/${event.id}/${Date.now()}.${ext}`
        const permanentUrl = await uploadBlob(blob, storagePath)
        await updateEvent(event.id, { imageUrl: permanentUrl })
        toast.success(`Image assigned to "${event.title}"`)
      } catch (err) {
        console.error('Failed to assign image to event:', err)
        toast.error('Failed to assign image to event')
      }
    }
    doAssign()
  }

  const handleDelete = (id: string) => {
    if (previewImage?.id === id) {
      // Navigate to next or prev before closing
      if (hasNext) goToNext()
      else if (hasPrev) goToPrev()
      else setPreviewImage(null)
    }
    deleteGeneration(id)
  }

  // Grid columns per row
  const [gridCols, setGridCols] = useState(() => {
    try { return parseInt(localStorage.getItem('imageGenGridCols') || '5') || 5 } catch { return 5 }
  })
  const handleSetGridCols = (n: number) => {
    setGridCols(n)
    try { localStorage.setItem('imageGenGridCols', String(n)) } catch {}
  }


  // Sessions: the oldest session is the "Default" and also surfaces legacy
  // (pre-sessions) images that have no sessionId.
  const defaultSessionId = sessions.length
    ? [...sessions].sort(
        (a, b) =>
          ((a.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() || 0) -
          ((b.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() || 0)
      )[0].id
    : null
  const visibleGenerations = generations.filter(
    (g) => g.sessionId === activeSessionId || (!g.sessionId && activeSessionId === defaultSessionId)
  )
  const sessionCounts = generations.reduce<Record<string, number>>((acc, g) => {
    const sid = g.sessionId || defaultSessionId
    if (sid) acc[sid] = (acc[sid] || 0) + 1
    return acc
  }, {})

  const handleNewSession = async () => {
    await createSession(`Session ${sessions.length + 1}`, '')
  }
  const handleDeleteSession = async (s: ImageGenSession) => {
    if (sessions.length <= 1) {
      toast.info('You need at least one session.')
      return
    }
    const owned = generations.filter((g) => g.sessionId === s.id)
    if (
      !window.confirm(
        `Delete session "${s.name}"${owned.length ? ` and its ${owned.length} image${owned.length > 1 ? 's' : ''}` : ''}? This cannot be undone.`
      )
    )
      return
    owned.forEach((g) => deleteGeneration(g.id))
    await removeSession(s.id)
  }

  if (!user) return null

  if (!permsLoading && !canModule('accessImageGenerator')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm">You don&apos;t have permission to access this module.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] relative overflow-hidden">
      {imageGenReady && activeTab === 'generate' && (
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          counts={sessionCounts}
          onSelect={setActiveSessionId}
          onNew={handleNewSession}
          onRename={renameSession}
          onDelete={handleDeleteSession}
        />
      )}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      {/* Tabs — centered in the global top header bar */}
      <HeaderCenter>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9 gap-0.5 rounded-full bg-muted/60 p-1">
            <TabsTrigger value="generate" className="h-7 gap-1.5 rounded-full px-3.5 text-xs data-[state=active]:shadow-sm"><Sparkles className="h-3.5 w-3.5" />Generate</TabsTrigger>
            <TabsTrigger value="campaign" className="h-7 gap-1.5 rounded-full px-3.5 text-xs data-[state=active]:shadow-sm"><Megaphone className="h-3.5 w-3.5" />Campaign</TabsTrigger>
            <TabsTrigger value="accounts" className="h-7 gap-1.5 rounded-full px-3.5 text-xs data-[state=active]:shadow-sm"><Mail className="h-3.5 w-3.5" />Accounts{accounts.length > 0 && <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{accounts.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="settings" className="h-7 gap-1.5 rounded-full px-3.5 text-xs data-[state=active]:shadow-sm"><Settings className="h-3.5 w-3.5" />Settings</TabsTrigger>
          </TabsList>
        </Tabs>
      </HeaderCenter>

      {/* Error Display */}
      {generationError && (
        <div className={cn(
          'mx-1 mb-3 flex-shrink-0 rounded-lg border px-4 py-3',
          generationError.type === 'quota' && 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800/40 dark:bg-yellow-950/10',
          generationError.type === 'auth' && 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10',
          generationError.type === 'not_found' && 'border-orange-200 bg-orange-50/50 dark:border-orange-800/40 dark:bg-orange-950/10',
          generationError.type === 'config' && 'border-blue-200 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/10',
          generationError.type === 'moderation' && 'border-orange-200 bg-orange-50/50 dark:border-orange-800/40 dark:bg-orange-950/10',
          generationError.type === 'generic' && 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10',
        )}>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {generationError.type === 'config' ? <Info className="h-4 w-4 text-blue-500" />
                : generationError.type === 'quota' || generationError.type === 'moderation' ? <AlertTriangle className="h-4 w-4 text-yellow-500" />
                : <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{generationError.title}: <span className="font-normal text-muted-foreground">{generationError.message}</span></p>
              {generationError.type === 'quota' && jobs?.images?.summary && (() => {
                const entries = Object.entries(jobs.images.summary)
                if (entries.length === 0) return null
                return (
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground">Stats (last 15 min):</span>
                    {entries.map(([email, stats]) => (
                      <div key={email} className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                          {email.split('@')[0]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-green-600">
                          {stats.completed} done
                        </Badge>
                        {stats.rateLimited > 0 && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-yellow-600">
                            {stats.rateLimited} limited
                          </Badge>
                        )}
                        {stats.failed > 0 && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-red-600">
                            {stats.failed} failed
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {generationError.type !== 'generic' && generationError.type !== 'moderation' && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleOpenSettings}>Settings</Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearError}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'generate' ? (
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex min-h-0 flex-1">
          {/* Center — Scrollable Image Grid */}
          <div className="flex-1 min-h-0 relative flex flex-col">
            <div className="flex-1 overflow-y-auto px-1 pt-2 pb-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : generations.length === 0 && !isGenerating ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border bg-gradient-to-br from-muted/60 to-muted/10 shadow-sm">
                    <Wand2 className="h-9 w-9 text-primary/60" />
                  </div>
                  <p className="text-base font-semibold text-foreground">Create something amazing</p>
                  <p className="mt-1 text-sm text-muted-foreground">Describe your image in the composer below to get started</p>
                </div>
              ) : (
                <div className="grid gap-3 items-start" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                  {/* Image cards */}
                  {visibleGenerations.map(gen => (
                    <ImageCard key={gen.id} gen={gen} onPreview={openPreview} onDownload={handleDownload} onDelete={handleDelete} onAssignEvent={g => setAssignEventOpen(g.id)} />
                  ))}
                </div>
              )}
            </div>
            {/* Grid columns selector */}
            <div className="absolute bottom-3 right-3 z-10">
              <div className="flex items-center gap-0.5 rounded-xl border bg-background/80 p-1 shadow-md backdrop-blur-md">
                {[3, 4, 5, 6, 8].map(n => (
                  <button
                    key={n}
                    title={`${n} columns`}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-semibold transition-all",
                      gridCols === n
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => handleSetGridCols(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel — Assets Library */}
          <div className={cn(
            "flex-shrink-0 border-l bg-background transition-all duration-300 flex flex-col",
            assetsPanelOpen ? "w-80" : "w-10"
          )}>
            {assetsPanelOpen ? (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 border-b">
                  {currentFolderId !== null ? (
                    <button
                      className="flex items-center gap-1 text-xs font-semibold hover:text-primary transition-colors min-w-0"
                      onClick={() => setCurrentFolderId(null)}
                    >
                      <ArrowLeft className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{assetFolders.find(f => f.id === currentFolderId)?.name ?? 'Folder'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assets</span>
                  )}
                  <div className="flex items-center gap-1">
                    {currentFolderId === null && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowNewFolderInput(true); setTimeout(() => newFolderInputRef.current?.focus(), 50) }}>
                        <FolderPlus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => assetFileInputRef.current?.click()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAssetsPanelOpen(false)}>
                      <PanelRightClose className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <input
                  ref={assetFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleAssetUpload}
                />
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {loadingAssets ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* Folder list — only at root */}
                      {currentFolderId === null && (
                        <>
                          {showNewFolderInput && (
                            <div className="flex items-center gap-1">
                              <Input
                                ref={newFolderInputRef}
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                placeholder="Folder name..."
                                className="h-7 text-xs"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleCreateFolder()
                                  if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName('') }
                                }}
                                onBlur={() => { if (!newFolderName.trim()) { setShowNewFolderInput(false); setNewFolderName('') } }}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {/* Combined grid — folders + assets + skeletons */}
                      {(currentFolderId === null ? assetFolders.length : 0) + savedAssets.length + uploadingPlaceholders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40">
                            {currentFolderId !== null ? <Folder className="h-5 w-5 opacity-50" /> : <ImageIcon className="h-5 w-5 opacity-50" />}
                          </div>
                          <p className="text-xs">{currentFolderId !== null ? 'Empty folder' : 'No assets yet'}</p>
                          <Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={() => assetFileInputRef.current?.click()}>
                            <Upload className="h-3 w-3 mr-1" />Upload
                          </Button>
                        </div>
                      ) : (
                        <div className="columns-2 gap-1.5 space-y-1.5">
                          {/* Folders (only at root) */}
                          {currentFolderId === null && assetFolders.map(folder => (
                            <div
                              key={`folder-${folder.id}`}
                              className="group/folder relative flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer hover:bg-muted/60 transition-colors border border-transparent hover:border-muted-foreground/20 break-inside-avoid"
                              onClick={() => {
                                if (renamingFolderId === folder.id) return
                                setCurrentFolderId(folder.id)
                              }}
                            >
                              {(() => {
                                const previews = getFolderPreviews(folder.id)
                                return previews.length > 0 ? (
                                  <div className="w-full aspect-square rounded-md overflow-hidden grid grid-cols-2 gap-px bg-muted">
                                    {[0, 1, 2, 3].map(i => (
                                      <div key={i} className="bg-muted overflow-hidden">
                                        {previews[i] ? (
                                          <img src={previews[i].thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="w-full aspect-square rounded-md bg-muted flex items-center justify-center">
                                    <Folder className="h-6 w-6 text-muted-foreground/40" />
                                  </div>
                                )
                              })()}
                              {renamingFolderId === folder.id ? (
                                <Input
                                  value={renamingFolderName}
                                  onChange={e => setRenamingFolderName(e.target.value)}
                                  className="h-5 text-[10px] text-center px-1"
                                  autoFocus
                                  onClick={e => e.stopPropagation()}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameFolder(folder.id)
                                    if (e.key === 'Escape') setRenamingFolderId(null)
                                  }}
                                  onBlur={() => handleRenameFolder(folder.id)}
                                />
                              ) : (
                                <span className="text-[10px] truncate w-full text-center leading-tight">
                                  {folder.name} <span className="text-muted-foreground">({getFolderAssetCount(folder.id)})</span>
                                </span>
                              )}
                              <div className="absolute top-0.5 right-0.5 hidden group-hover/folder:flex items-center gap-0.5">
                                <button
                                  className="h-4 w-4 rounded flex items-center justify-center bg-background/80 hover:bg-muted transition-colors"
                                  onClick={e => { e.stopPropagation(); setRenamingFolderId(folder.id); setRenamingFolderName(folder.name) }}
                                >
                                  <Pencil className="h-2 w-2 text-muted-foreground" />
                                </button>
                                <button
                                  className="h-4 w-4 rounded flex items-center justify-center bg-background/80 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                  onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.id) }}
                                >
                                  <Trash2 className="h-2 w-2 text-red-500" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {/* Assets */}
                          {savedAssets.map(asset => {
                            const isSelected = selectedRefs.includes(asset.id)
                            return (
                              <div
                                key={asset.id}
                                className={cn(
                                  "relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all group/asset break-inside-avoid",
                                  isSelected ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-muted-foreground/20"
                                )}
                                onClick={() => {
                                  setSelectedRefs(prev =>
                                    isSelected ? prev.filter(r => r !== asset.id) : [...prev, asset.id]
                                  )
                                }}
                              >
                                <img src={asset.thumbnailUrl} alt={asset.name} className="w-full h-auto object-contain" />
                                {isSelected && (
                                  <div className="absolute top-1 left-1">
                                    <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                      <Check className="h-2.5 w-2.5" />
                                    </div>
                                  </div>
                                )}
                                <button
                                  className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/asset:opacity-100 transition-opacity hover:bg-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedRefs(prev => prev.filter(r => r !== asset.id))
                                    setSavedAssets(prev => prev.filter(a => a.id !== asset.id))
                                    setAllAssets(prev => prev.filter(a => a.id !== asset.id))
                                    imageAssets.delete(asset.id).catch(() => {})
                                    import('@/lib/storage').then(({ deleteFile }) => {
                                      if (asset.storagePath) deleteFile(asset.storagePath).catch(() => {})
                                      if (asset.fullStoragePath) deleteFile(asset.fullStoragePath).catch(() => {})
                                    })
                                  }}
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            )
                          })}
                          {/* Upload skeletons */}
                          {uploadingPlaceholders.map(pid => (
                            <div key={pid} className="rounded-lg overflow-hidden break-inside-avoid">
                              <div className="w-full aspect-square bg-muted animate-pulse rounded-lg flex items-center justify-center">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {selectedRefs.length > 0 && (
                  <div className="border-t px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{selectedRefs.length} selected</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedRefs([])}>Clear</Button>
                  </div>
                )}
              </>
            ) : (
              <button
                className="flex-1 flex items-center justify-center hover:bg-muted/50 transition-colors"
                onClick={() => setAssetsPanelOpen(true)}
                title="Open assets panel"
              >
                <div className="flex flex-col items-center gap-1">
                  <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
                  {selectedRefs.length > 0 && (
                    <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">{selectedRefs.length}</span>
                  )}
                </div>
              </button>
            )}
          </div>
          </div>

          {/* Bottom composer — unified surface (input + docked controls) */}
          <div className="flex-shrink-0 px-3 pb-3 pt-1.5">
            {(selectedRefs.length > 0 || isGenerating) && (
              <div className="mb-2 flex items-center gap-2 overflow-x-auto px-1">
                {selectedRefs.map((id) => {
                  const asset = allAssets.find(a => a.id === id)
                  if (!asset) return null
                  return (
                    <div key={id} className="relative flex-shrink-0 group/att">
                      <img src={asset.thumbnailUrl} alt={asset.name} className="h-11 w-11 rounded-lg object-cover border border-primary/20" />
                      <button
                        onClick={() => setSelectedRefs(prev => prev.filter(r => r !== id))}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )
                })}
                {isGenerating && (
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {`Generating ${imageCount} image${imageCount > 1 ? 's' : ''}…`}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border bg-card shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
              <textarea
                ref={textareaRef}
                placeholder={selectedRefs.length > 0 ? "Describe how to use the reference image…" : "Describe the image you want to create…"}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={isGenerating}
                className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 min-h-[52px] max-h-[180px]"
              />
              <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2.5 pt-1">
                {/* Aspect ratio */}
                <div className="flex items-center rounded-lg bg-muted/60 p-0.5">
                  {([['landscape', RectangleHorizontal], ['square', Square], ['portrait', RectangleVertical]] as const).map(([val, Icon]) => (
                    <button
                      key={val}
                      onClick={() => setAspectRatio(val)}
                      disabled={isGenerating}
                      title={val}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md transition-all",
                        aspectRatio === val ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
                {/* Count */}
                <div className="flex items-center rounded-lg bg-muted/60 p-0.5">
                  {[2, 4, 6, 8].map(n => (
                    <button
                      key={n}
                      onClick={() => setImageCount(n)}
                      disabled={isGenerating}
                      title={`${n} images`}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold transition-all",
                        imageCount === n ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {/* Standing prompt */}
                <button
                  onClick={() => { setStandingPromptDraft(activeSession?.standingPrompt || ''); setStandingPromptOpen(true) }}
                  title={activeSession ? `Standing prompt for "${activeSession.name}"` : 'Standing prompt'}
                  className={cn(
                    "flex h-8 max-w-[200px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                    activeSession?.standingPrompt ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{activeSession?.standingPrompt || 'Session prompt'}</span>
                </button>
                {/* Event */}
                <button
                  onClick={() => setEventPopoverOpen(true)}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <CalendarDays className="h-3.5 w-3.5" />Event
                </button>

                <div className="flex-1" />

                {/* Generate */}
                {isGenerating ? (
                  <Button onClick={cancelGeneration} className="h-9 rounded-xl bg-red-500 px-4 text-white hover:bg-red-600">
                    <CircleStop className="h-4 w-4 mr-1.5" />Cancel
                  </Button>
                ) : (
                  <Button onClick={handleGenerate} disabled={!prompt.trim()} className="h-9 rounded-xl px-4">
                    <Send className="h-4 w-4 mr-1.5" />Generate
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'campaign' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <CampaignTab />
        </div>
      ) : activeTab === 'settings' ? (
        <div className="flex-1 overflow-y-auto px-1">
          <div className="mx-auto w-full max-w-xl space-y-5 py-4">
            <h2 className="text-lg font-semibold">Content Studio Settings</h2>
            <div className="flex items-center justify-between">
              <div><Label htmlFor="ig-enabled" className="text-sm font-medium">Enable Image Generation</Label><p className="text-xs text-muted-foreground mt-0.5">Turn on or off</p></div>
              <Switch id="ig-enabled" checked={settingsEnabled} onCheckedChange={setSettingsEnabled} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={settingsModel} onValueChange={(v) => setSettingsModel(v as ImageGenModel)}>
                <SelectTrigger><SelectValue placeholder="Select a model..." /></SelectTrigger>
                <SelectContent>
                  {IMAGE_GEN_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <div><div className="font-medium">{m.label}</div><div className="text-xs text-muted-foreground">{m.description}</div></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</> : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Accounts + usage stats */
        <div className="flex-1 space-y-6 overflow-y-auto px-1 pb-6">
            <div className="space-y-4 mt-0">
              {!managed ? (
                <Card><CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Settings className="h-12 w-12 mb-3 opacity-40" />
                    <p>Account management is not configured</p>
                    <p className="text-sm mb-4">This server has no account credential, so there is nothing to manage here.</p>
                  </div>
                </CardContent></Card>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Connected Google Accounts</h2>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={fetchAccounts} disabled={loadingAccounts}>
                        <RefreshCw className={cn("h-4 w-4 mr-1.5", loadingAccounts && "animate-spin")} />Refresh
                      </Button>
                      <Button size="sm" onClick={openRegisterNew}>
                        <UserPlus className="h-4 w-4 mr-1.5" />Register Account
                      </Button>
                    </div>
                  </div>

                  {loadingAccounts ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : accounts.length === 0 ? (
                    <Card><CardContent className="pt-6">
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Mail className="h-12 w-12 mb-3 opacity-40" />
                        <p>No accounts connected</p>
                        <p className="text-sm mb-4">Register a Google account to start generating images</p>
                        <Button onClick={openRegisterNew}><UserPlus className="h-4 w-4 mr-1.5" />Register Account</Button>
                      </div>
                    </CardContent></Card>
                  ) : (
                    <div className="space-y-2">
                      {accounts.map(acc => {
                        const isDisabled = settings?.imageGenDisabledEmails?.includes(acc.email) ?? false
                        const isDefault = settings?.imageGenPreferredEmail === acc.email
                        return (
                          <div
                            key={acc.email}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border px-3 py-2",
                              isDisabled && "opacity-60",
                              isDefault && "ring-1 ring-primary/30"
                            )}
                          >
                            <Switch
                              checked={!isDisabled}
                              onCheckedChange={async (checked) => {
                                const current = settings?.imageGenDisabledEmails || []
                                const updated = checked ? current.filter(e => e !== acc.email) : [...current, acc.email]
                                await updateSettings({ imageGenDisabledEmails: updated })
                              }}
                            />
                            <span
                              className={cn("h-2 w-2 flex-shrink-0 rounded-full", acc.health === 'OK' ? 'bg-green-500' : 'bg-red-500')}
                              title={acc.health}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={cn("truncate text-sm font-medium", isDisabled && "line-through text-muted-foreground")}>{acc.email}</span>
                                {isDefault && <Badge className="h-4 flex-shrink-0 bg-primary px-1.5 text-[10px]">Default</Badge>}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                {acc.error ? (
                                  <span className="text-red-500">{acc.error}</span>
                                ) : (
                                  <span title={acc.sessionExpires ? new Date(acc.sessionExpires).toLocaleString() : ''}>
                                    Session {acc.sessionExpires ? `expires ${new Date(acc.sessionExpires).toLocaleDateString()}` : 'N/A'}
                                  </span>
                                )}
                                {!isDefault && !isDisabled && (
                                  <button className="ml-2 text-primary hover:underline" onClick={() => updateSettings({ imageGenPreferredEmail: acc.email })}>
                                    Set default
                                  </button>
                                )}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => openRefreshSession(acc.email)} title="Refresh session">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive"
                              onClick={() => deleteAccount(acc.email)}
                              disabled={deletingEmail === acc.email}
                              title="Remove account"
                            >
                              {deletingEmail === acc.email ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Captcha Providers */}
                  <Card className="mt-6">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Captcha Providers</CardTitle>
                          <CardDescription>Required when Google triggers CAPTCHA challenges</CardDescription>
                        </div>
                        <Button
                          variant="outline" size="sm"
                          onClick={async () => {
                            setCaptchaOpen(!captchaOpen)
                            if (!captchaCurrent) {
                              const data = await fetchCaptchaProviders()
                              if (data) setCaptchaCurrent(data)
                            }
                          }}
                        >
                          {captchaOpen ? 'Hide' : 'Configure'}
                        </Button>
                      </div>
                    </CardHeader>
                    {captchaOpen && (
                      <CardContent className="space-y-4">
                        {/* Current providers */}
                        {captchaCurrent && Object.keys(captchaCurrent).length > 0 && !('freeCaptchaCredits' in captchaCurrent) && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Active providers:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(captchaCurrent).map(([name, key]) => (
                                <Badge key={name} variant="outline" className="text-xs gap-1.5">
                                  {name} <span className="text-muted-foreground">{key}</span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {captchaCurrent && 'freeCaptchaCredits' in captchaCurrent && (
                          <p className="text-xs text-muted-foreground">Free credits remaining: <strong>{captchaCurrent.freeCaptchaCredits}</strong></p>
                        )}

                        {/* Add provider form */}
                        <div className="flex items-end gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Provider</Label>
                            <Select value={captchaProvider} onValueChange={setCaptchaProvider}>
                              <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['SolveCaptcha', 'CapSolver', 'AntiCaptcha', '2Captcha', 'EzCaptcha', 'YesCaptcha', 'CapMonster'].map(p => (
                                  <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <Label className="text-xs">API Key</Label>
                            <Input
                              value={captchaApiKey}
                              onChange={e => setCaptchaApiKey(e.target.value)}
                              placeholder="Paste your API key..."
                              className="h-9 text-xs"
                            />
                          </div>
                          <Button
                            size="sm" className="h-9"
                            disabled={!captchaApiKey.trim() || captchaLoading}
                            onClick={async () => {
                              setCaptchaLoading(true)
                              const success = await setCaptchaProviders({ [captchaProvider]: captchaApiKey.trim() })
                              if (success) {
                                setCaptchaApiKey('')
                                const data = await fetchCaptchaProviders()
                                if (data) setCaptchaCurrent(data)
                              }
                              setCaptchaLoading(false)
                            }}
                          >
                            {captchaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Cheapest: SolveCaptcha (~$0.80/1K) · Fastest: CapSolver, AntiCaptcha (~$2-3/1K, 8-12s)
                        </p>
                      </CardContent>
                    )}
                  </Card>

                </>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Usage</h2>
              {(() => {
                // Build stats from persistent generation logs
                const successLogs = genLogs.filter(l => l.status === 'success')
                const failedLogs = genLogs.filter(l => l.status === 'failed')
                const totalImages = successLogs.reduce((sum, l) => sum + l.imageCount, 0)
                const byModel: Record<string, number> = {}
                const byDay: Record<string, number> = {}
                genLogs.forEach(l => {
                  const imgCount = l.status === 'success' ? l.imageCount : 0
                  byModel[l.model] = (byModel[l.model] || 0) + imgCount
                  const day = l.createdAt?.toMillis ? new Date(l.createdAt.toMillis()).toLocaleDateString() : 'Unknown'
                  byDay[day] = (byDay[day] || 0) + (l.status === 'success' ? l.imageCount : 0)
                })
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const todayCount = successLogs
                  .filter(l => l.createdAt?.toMillis?.() >= today.getTime())
                  .reduce((sum, l) => sum + l.imageCount, 0)
                const successRate = genLogs.length > 0 ? Math.round((successLogs.length / genLogs.length) * 100) : 0

                return genLogs.length === 0 ? (
                  <Card><CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Activity className="h-12 w-12 mb-3 opacity-40" /><p>No generations yet</p>
                    </div>
                  </CardContent></Card>
                ) : (
                  <div className="space-y-4">
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Card>
                        <CardContent className="pt-4 pb-4 text-center">
                          <p className="text-3xl font-bold">{totalImages}</p>
                          <p className="text-xs text-muted-foreground mt-1">Total Images</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-4 text-center">
                          <p className="text-3xl font-bold text-primary">{todayCount}</p>
                          <p className="text-xs text-muted-foreground mt-1">Today</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-4 text-center">
                          <p className="text-3xl font-bold">{genLogs.length}</p>
                          <p className="text-xs text-muted-foreground mt-1">Total Requests</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-4 text-center">
                          <p className="text-3xl font-bold text-green-500">{successRate}%</p>
                          <p className="text-xs text-muted-foreground mt-1">Success Rate</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Card>
                        <CardContent className="pt-4 pb-4 text-center">
                          <p className="text-2xl font-bold text-destructive">{failedLogs.length}</p>
                          <p className="text-xs text-muted-foreground mt-1">Failed</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-4 text-center">
                          <p className="text-2xl font-bold">{Object.keys(byModel).length}</p>
                          <p className="text-xs text-muted-foreground mt-1">Models Used</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-4 text-center">
                          <p className="text-2xl font-bold">{Object.keys(byDay).length}</p>
                          <p className="text-xs text-muted-foreground mt-1">Active Days</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Per-model breakdown */}
                    <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Usage by Model</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(byModel).sort((a, b) => b[1] - a[1]).map(([model, count]) => (
                            <div key={model} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                              <span className="text-sm font-medium">{modelLabel(model)}</span>
                              <Badge variant="secondary">{count} images</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Daily breakdown */}
                    <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Daily Usage</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                          {Object.entries(byDay).sort((a, b) => {
                            const da = new Date(a[0]).getTime()
                            const db = new Date(b[0]).getTime()
                            return db - da
                          }).map(([day, count]) => (
                            <div key={day} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                              <span className="text-sm text-muted-foreground">{day}</span>
                              <Badge variant="outline" className="font-normal">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}
            </div>
        </div>
      )}

      {/* Full Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={open => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none border-none p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-normal text-muted-foreground line-clamp-2">{previewImage?.prompt}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-foreground/70">{modelLabel(previewImage?.model)}</span>
              <span className="opacity-30">·</span>
              <span>{previewImage?.aspectRatio}</span>
              {previewImage?.fileSize && <><span className="opacity-30">·</span><span>{formatFileSize(previewImage.fileSize)}</span></>}
              {previewImage?.createdAt?.toMillis && <><span className="opacity-30">·</span><span>{new Date(previewImage.createdAt.toMillis()).toLocaleString()}</span></>}
            </DialogDescription>
          </DialogHeader>
          {previewImage && (
            <div className="flex flex-col h-[calc(100vh-8rem)]">
              {/* Zoomable image area */}
              <div
                ref={zoomContainerRef}
                className="relative overflow-hidden rounded-lg bg-muted/30 flex-1 flex items-center justify-center min-h-0"
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
              >
                <img
                  src={previewImage.imageUrl}
                  alt={previewImage.prompt}
                  draggable={false}
                  className="max-h-full max-w-full w-auto object-contain select-none transition-transform duration-150"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    cursor: zoom > 1 ? (isPanning.current ? 'grabbing' : 'grab') : 'zoom-in',
                  }}
                  onClick={() => { if (zoom === 1) handleZoomIn() }}
                />

                {/* Prev arrow */}
                {hasPrev && (
                  <Button
                    variant="secondary" size="icon"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur-sm"
                    onClick={goToPrev}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}

                {/* Next arrow */}
                {hasNext && (
                  <Button
                    variant="secondary" size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur-sm"
                    onClick={goToNext}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}

                {/* Bottom bar: counter + zoom controls */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3">
                  {/* Counter */}
                  <div className="bg-background/80 backdrop-blur-sm rounded-lg border shadow-sm px-3 py-1">
                    <span className="text-xs text-muted-foreground font-mono">{previewIndex + 1} / {generations.length}</span>
                  </div>

                  {/* Zoom controls */}
                  <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg border shadow-sm p-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={zoom <= 1}>
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={zoom >= 5}>
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    {zoom !== 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomReset}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 justify-center flex-shrink-0 pt-3">
                <Button variant="outline" size="sm" onClick={() => handleDownload(previewImage)}><Download className="h-4 w-4 mr-1.5" />Download</Button>
                <Button variant="outline" size="sm" onClick={() => saveToMediaLibrary(previewImage)} disabled={previewImage.savedToMedia}>
                  {previewImage.savedToMedia ? <><Check className="h-4 w-4 mr-1.5" />Saved to Media</> : <><FolderOpen className="h-4 w-4 mr-1.5" />Save to Media</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCopyPrompt(previewImage)}>
                  {copiedId === previewImage.id ? <><Check className="h-4 w-4 mr-1.5" />Copied</> : <><Copy className="h-4 w-4 mr-1.5" />Copy Prompt</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPrompt(previewImage.prompt); setPreviewImage(null) }}><Sparkles className="h-4 w-4 mr-1.5" />Reuse Prompt</Button>
                <Button variant="outline" size="sm" onClick={() => { setPreviewImage(null); setAssignEventOpen(previewImage!.id) }}>
                  <CalendarPlus className="h-4 w-4 mr-1.5" />Assign to Event
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(previewImage.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1.5" />Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import from Event Dialog */}
      <Dialog open={eventPopoverOpen} onOpenChange={open => { if (!open) { setEventPopoverOpen(false); setEventSearchQuery('') } }}>
        <DialogContent className="sm:max-w-7xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />Import from Event</DialogTitle>
            <DialogDescription>Select an event to import its description into the prompt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 flex-1 min-h-0 flex flex-col">
            <Input
              placeholder="Search events..."
              value={eventSearchQuery}
              onChange={e => setEventSearchQuery(e.target.value)}
              className="h-10 text-sm flex-shrink-0"
            />
            <EventCardGrid
              events={filteredCalendarEvents}
              onSelect={handleImportEventDescription}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign to Event Dialog */}
      <Dialog open={!!assignEventOpen} onOpenChange={open => { if (!open) { setAssignEventOpen(null); setEventSearchQuery('') } }}>
        <DialogContent className="sm:max-w-7xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5" />Assign to Event</DialogTitle>
            <DialogDescription>Choose a calendar event to assign this image to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 flex-1 min-h-0 flex flex-col">
            <Input
              placeholder="Search events..."
              value={eventSearchQuery}
              onChange={e => setEventSearchQuery(e.target.value)}
              className="h-10 text-sm flex-shrink-0"
            />
            <EventCardGrid
              events={filteredCalendarEvents}
              onSelect={evt => {
                const gen = generations.find(g => g.id === assignEventOpen)
                if (gen) setConfirmAssignEvent({ generation: gen, event: evt })
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Assign Dialog */}
      <Dialog open={!!confirmAssignEvent} onOpenChange={open => { if (!open) setConfirmAssignEvent(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign image to event?</DialogTitle>
            <DialogDescription>
              This will set the generated image as the image for <strong>&quot;{confirmAssignEvent?.event.title}&quot;</strong>.
              {confirmAssignEvent?.event.imageUrl && ' This event already has an image — it will be replaced.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAssignEvent(null)}>Cancel</Button>
            <Button onClick={() => confirmAssignEvent && handleAssignToEvent(confirmAssignEvent.generation, confirmAssignEvent.event)}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Standing Prompt Dialog */}
      <Dialog open={standingPromptOpen} onOpenChange={setStandingPromptOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Standing Prompt{activeSession ? ` · ${activeSession.name}` : ''}</DialogTitle>
            <DialogDescription>Prepended to every prompt in this session, so its images stay coherent.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="e.g. High quality, professional photography, 8K resolution, detailed textures..."
              value={standingPromptDraft}
              onChange={e => setStandingPromptDraft(e.target.value)}
              rows={10}
              className="text-sm"
            />
          </div>
          <DialogFooter>
            {activeSession?.standingPrompt && (
              <Button
                variant="ghost"
                className="mr-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={async () => {
                  if (!activeSessionId) return
                  setSavingStandingPrompt(true)
                  await setSessionStandingPrompt(activeSessionId, '')
                  setSavingStandingPrompt(false)
                  setStandingPromptOpen(false)
                }}
                disabled={savingStandingPrompt}
              >
                Clear
              </Button>
            )}
            <Button variant="outline" onClick={() => setStandingPromptOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!activeSessionId) return
                setSavingStandingPrompt(true)
                await setSessionStandingPrompt(activeSessionId, standingPromptDraft.trim())
                setSavingStandingPrompt(false)
                setStandingPromptOpen(false)
              }}
              disabled={savingStandingPrompt || !activeSessionId}
            >
              {savingStandingPrompt ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Account Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {refreshEmail ? <><RefreshCw className="h-5 w-5" />Refresh Session</> : <><UserPlus className="h-5 w-5" />Register Google Account</>}
            </DialogTitle>
            <DialogDescription>
              {refreshEmail
                ? <>Paste fresh cookies for <strong>{refreshEmail}</strong> to refresh the session.</>
                : 'Paste cookies from accounts.google.com to connect your Google account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted p-3 text-xs space-y-1.5">
              <p className="font-medium text-sm">How to get cookies:</p>
              <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
                <li>Open a fresh browser (Firefox/Opera recommended)</li>
                <li>Go to <strong>labs.google/fx/tools/flow</strong> and sign in</li>
                <li>Check &quot;Don&apos;t ask again on this device&quot; on 2FA</li>
                <li>Go to <strong>myaccount.google.com</strong></li>
                <li>DevTools (F12) → Storage → Cookies → <strong>accounts.google.com</strong></li>
                <li>Select all cookies (Ctrl+A) and copy (Ctrl+C)</li>
                <li>Paste below</li>
              </ol>
            </div>
            <div className="space-y-2">
              <Label>Cookies</Label>
              <Textarea
                placeholder="Paste your cookies here..."
                value={cookiesInput}
                onChange={e => setCookiesInput(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          </div>
          {registerError && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400 whitespace-pre-line">{registerError}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col">
            {registering && (
              <p className="text-xs text-muted-foreground text-center">This may take up to a minute — authenticating with Google...</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRegisterOpen(false)} disabled={registering}>Cancel</Button>
              <Button onClick={handleRegister} disabled={registering || !cookiesInput.trim()}>
                {registering
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{refreshEmail ? 'Refreshing session...' : 'Setting up account...'}</>
                  : refreshEmail ? 'Refresh Session' : 'Register Account'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  )
}
