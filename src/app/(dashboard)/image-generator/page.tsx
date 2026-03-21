'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useImageGenerator } from '@/hooks/useImageGenerator'
import { useImageApi } from '@/hooks/useImageApi'
import { useSettings } from '@/hooks/useSettings'
import { ImageGeneration, ImageGenModel, ImageGenAspectRatio, ImageAsset, ImageAssetFolder } from '@/types'
import { imageAssets, imageAssetFolders } from '@/lib/firestore'
import { uploadBlob } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  UserPlus,
  RefreshCw,
  Activity,
  Shield,
  Clock,
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const IMAGE_GEN_MODELS: { value: ImageGenModel; label: string; description: string }[] = [
  { value: 'imagen-4', label: 'Imagen 4', description: 'Google Imagen 4 — high quality generation' },
  { value: 'nano-banana', label: 'Nano Banana', description: 'Gemini 2.5 Flash Image' },
  { value: 'nano-banana-2', label: 'Nano Banana 2', description: 'Gemini 2.5 Pro Image (supports upscale)' },
  { value: 'nano-banana-pro', label: 'Nano Banana Pro', description: 'Gemini 3 Pro Image (supports upscale)' },
]

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

function ImageCard({ gen, onPreview, onDownload, onDelete }: {
  gen: ImageGeneration
  onPreview: (g: ImageGeneration) => void
  onDownload: (g: ImageGeneration) => void
  onDelete: (id: string) => void
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className="group relative rounded-xl overflow-hidden border bg-muted cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-lg transition-all"
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
          </div>

          {/* Saved badge */}
          {gen.savedToMedia && (
            <div className="absolute top-2 left-2">
              <div className="bg-green-500 text-white rounded-full p-0.5 shadow-sm"><Check className="h-3 w-3" /></div>
            </div>
          )}

          {/* Bottom info overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[11px] text-white line-clamp-2 leading-snug">{gen.prompt}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-white/70">
              <span className="font-medium">{IMAGE_GEN_MODELS.find(m => m.value === gen.model)?.label || gen.model}</span>
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


export default function ImageGeneratorPage() {
  const { user } = useAuth()
  const {
    generations, isGenerating, isLoading,
    error: generationError, clearError,
    generate, cancelGeneration, saveToMediaLibrary, deleteGeneration,
  } = useImageGenerator()
  const {
    settings, updateSettings,
    setImageGenApiToken, setImageGenModel, setImageGenEnabled, setImageGenStandingPrompt,
  } = useSettings()
  const {
    accounts, jobs, loadingAccounts, loadingJobs,
    registering, deletingEmail,
    fetchAccounts, registerAccount, deleteAccount, fetchJobs,
    fetchCaptchaProviders, setCaptchaProviders, uploadAsset,
  } = useImageApi(settings?.imageGenApiToken)

  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<ImageGenAspectRatio>('landscape')
  const [imageCount, setImageCount] = useState(2)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(true)

  const [uploadingAssets, setUploadingAssets] = useState(false)
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsToken, setSettingsToken] = useState('')
  const [settingsModel, setSettingsModel] = useState<ImageGenModel | ''>('')
  const [settingsEnabled, setSettingsEnabled] = useState(true)
  const [showToken, setShowToken] = useState(false)
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

  // Active tab
  const [activeTab, setActiveTab] = useState('generate')

  useEffect(() => {
    if (settings) {
      setSettingsToken(settings.imageGenApiToken || '')
      setSettingsModel(settings.imageGenModel || '')
      setSettingsEnabled(settings.imageGenEnabled !== false)
    }
  }, [settings])

  useEffect(() => {
    if (activeTab === 'accounts' && settings?.imageGenApiToken) fetchAccounts()
    if (activeTab === 'jobs' && settings?.imageGenApiToken) fetchJobs()
  }, [activeTab, settings?.imageGenApiToken, fetchAccounts, fetchJobs])

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
      setSettingsToken(settings.imageGenApiToken || '')
      setSettingsModel(settings.imageGenModel || '')
      setSettingsEnabled(settings.imageGenEnabled !== false)
    }
    setShowToken(false)
    setSettingsOpen(true)
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await setImageGenApiToken(settingsToken || null)
      if (settingsModel) await setImageGenModel(settingsModel)
      await setImageGenEnabled(settingsEnabled)
      setSettingsOpen(false)
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

  if (!user) return null

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    let references: string[] | undefined

    // Upload selected assets to useapi.net if they don't have a mediaGenerationId yet
    if (selectedRefs.length > 0) {
      const selected = allAssets.filter(a => selectedRefs.includes(a.id))
      const needsUpload = selected.filter(a => !a.mediaGenerationId)
      const alreadyUploaded = selected.filter(a => a.mediaGenerationId).map(a => a.mediaGenerationId)

      if (needsUpload.length > 0) {
        setUploadingAssets(true)
        try {
          const results = await Promise.all(
            needsUpload.map(async (asset) => {
              // Fetch full-size image from Firebase Storage and upload to useapi.net
              const imageUrl = asset.fullUrl || asset.thumbnailUrl
              const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
              const res = await fetch(proxyUrl)
              const blob = await res.blob()
              const reader = new FileReader()
              const dataUrl = await new Promise<string>((resolve) => {
                reader.onload = () => resolve(reader.result as string)
                reader.readAsDataURL(blob)
              })
              const result = await uploadAsset(dataUrl, asset.name)
              if (result) {
                // Save mediaGenerationId back to Firestore for future reuse
                imageAssets.delete(asset.id).catch(() => {})
                const newId = await imageAssets.create({
                  mediaGenerationId: result.mediaGenerationId,
                  name: asset.name,
                  fullUrl: asset.fullUrl || asset.thumbnailUrl,
                  fullStoragePath: asset.fullStoragePath || asset.storagePath,
                  thumbnailUrl: asset.thumbnailUrl,
                  storagePath: asset.storagePath,
                  folderId: asset.folderId ?? null,
                  userId: user!.uid,
                })
                const updater = (a: ImageAsset) => a.id === asset.id ? { ...a, id: newId, mediaGenerationId: result.mediaGenerationId } : a
                setSavedAssets(prev => prev.map(updater))
                setAllAssets(prev => prev.map(updater))
                return result.mediaGenerationId
              }
              return null
            })
          )
          const uploaded = results.filter((r): r is string => !!r)
          references = [...alreadyUploaded, ...uploaded]
        } finally {
          setUploadingAssets(false)
        }
      } else {
        references = alreadyUploaded
      }
    }

    const standingPrompt = settings?.imageGenStandingPrompt?.trim()
    const fullPrompt = standingPrompt ? `${standingPrompt}\n${prompt.trim()}` : prompt.trim()
    await generate(fullPrompt, aspectRatio, imageCount, settings, references?.length ? references : undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating) handleGenerate()
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

  const handleDelete = (id: string) => {
    if (previewImage?.id === id) {
      // Navigate to next or prev before closing
      if (hasNext) goToNext()
      else if (hasPrev) goToPrev()
      else setPreviewImage(null)
    }
    deleteGeneration(id)
  }

  const hasToken = !!settings?.imageGenApiToken

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Image Generator
          </h1>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8">
              <TabsTrigger value="generate" className="text-xs px-3 h-7"><Sparkles className="h-3 w-3 mr-1" />Generate</TabsTrigger>
              <TabsTrigger value="accounts" className="text-xs px-3 h-7"><Mail className="h-3 w-3 mr-1" />Accounts{accounts.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{accounts.length}</Badge>}</TabsTrigger>
              <TabsTrigger value="jobs" className="text-xs px-3 h-7"><Activity className="h-3 w-3 mr-1" />Jobs</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpenSettings}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>

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
        <div className="flex-1 flex min-h-0 relative">
          {/* Center — Scrollable Image Grid */}
          <div className="flex-1 overflow-y-auto min-h-0 px-1 pt-2 pb-48">
            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : generations.length === 0 && !isGenerating ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <div className="relative mb-6">
                  <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 flex items-center justify-center">
                    <Wand2 className="h-10 w-10 text-primary/70" />
                  </div>
                </div>
                <p className="text-lg font-medium text-foreground">Create something amazing</p>
                <p className="text-sm mt-1">Describe the image you want to generate below</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 items-start">
                {/* Image cards */}
                {generations.map(gen => (
                  <ImageCard key={gen.id} gen={gen} onPreview={openPreview} onDownload={handleDownload} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>

          {/* Floating Prompt Bar */}
          <div className="absolute bottom-[2%] left-0 right-0 flex justify-center px-6 pointer-events-none z-10">
            <div className="w-full max-w-3xl pointer-events-auto">
              <div className="relative rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/30">
                {/* Generating overlay */}
                {(isGenerating || uploadingAssets) && (
                  <div className="absolute inset-0 z-20 rounded-2xl bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                    <div className="relative h-8 w-8">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                    </div>
                    <p className="text-xs font-medium text-primary">
                      {uploadingAssets ? 'Uploading assets...' : `Generating ${imageCount} image${imageCount > 1 ? 's' : ''}...`}
                    </p>
                    <Button onClick={cancelGeneration} variant="outline" size="sm" className="h-7 px-3 text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30">
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Selected assets preview */}
                {selectedRefs.length > 0 && !isGenerating && (
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-0.5 overflow-x-auto">
                    {selectedRefs.map((id) => {
                      const asset = allAssets.find(a => a.id === id)
                      if (!asset) return null
                      return (
                        <div key={id} className="relative flex-shrink-0 group/att">
                          <img src={asset.thumbnailUrl} alt={asset.name} className="h-16 w-16 rounded-lg object-cover border border-primary/20" />
                          <button
                            onClick={() => setSelectedRefs(prev => prev.filter(r => r !== id))}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Input + controls row */}
                <div className="flex items-center gap-2 p-3">
                  {/* Textarea */}
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={textareaRef}
                      placeholder={selectedRefs.length > 0 ? "Describe how to use the reference image..." : "Describe the image you want to create..."}
                      value={prompt}
                      onChange={e => {
                        setPrompt(e.target.value)
                        const el = e.target
                        el.style.height = 'auto'
                        el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                      }}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      disabled={isGenerating}
                      className="w-full resize-none bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/40 min-h-[2.25rem] max-h-[120px] py-1.5 leading-relaxed"
                    />
                  </div>

                  {/* Send / Stop */}
                  {isGenerating || uploadingAssets ? (
                    <Button onClick={cancelGeneration} size="icon" className="h-9 w-9 flex-shrink-0 rounded-lg bg-red-500 hover:bg-red-600 text-white">
                      {uploadingAssets ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleStop className="h-4 w-4" />}
                    </Button>
                  ) : (
                    <Button onClick={handleGenerate} disabled={!prompt.trim()} size="icon" className="h-9 w-9 flex-shrink-0 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Inline options */}
                <div className="flex items-center gap-2 px-3 pb-3 pt-0">
                    <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
                      {([['landscape', RectangleHorizontal], ['square', Square], ['portrait', RectangleVertical]] as const).map(([val, Icon]) => (
                        <Button
                          key={val}
                          variant={aspectRatio === val ? 'default' : 'ghost'}
                          size="sm" className="h-7 w-7 rounded-md p-0"
                          onClick={() => setAspectRatio(val)}
                          disabled={isGenerating}
                          title={val}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </Button>
                      ))}
                    </div>
                    <div className="w-px h-5 bg-border" />
                    <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
                      {[2, 4, 6, 8].map(n => (
                        <Button
                          key={n}
                          variant={imageCount === n ? 'default' : 'ghost'}
                          size="sm" className="h-7 w-7 rounded-md text-[11px] font-medium p-0"
                          onClick={() => setImageCount(n)}
                          disabled={isGenerating}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                    <div className="w-px h-5 bg-border" />
                    <button
                      className={cn(
                        "flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium transition-colors",
                        settings?.imageGenStandingPrompt
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => {
                        setStandingPromptDraft(settings?.imageGenStandingPrompt || '')
                        setStandingPromptOpen(true)
                      }}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span className="max-w-[120px] truncate">
                        {settings?.imageGenStandingPrompt || 'Default Prompt'}
                      </span>
                    </button>
                  </div>
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
                    <h3 className="text-xs font-semibold">Assets</h3>
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
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          {currentFolderId !== null ? (
                            <>
                              <Folder className="h-8 w-8 mb-2 opacity-20" />
                              <p className="text-[10px] text-center">Empty folder</p>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="h-8 w-8 mb-2 opacity-20" />
                              <p className="text-[10px] text-center">No assets yet</p>
                            </>
                          )}
                          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => assetFileInputRef.current?.click()}>
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
      ) : (
        /* Accounts & Jobs tabs */
        <div className="flex-1 overflow-y-auto px-1">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="accounts" className="space-y-4 mt-0">
              {!hasToken ? (
                <Card><CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Settings className="h-12 w-12 mb-3 opacity-40" />
                    <p>No API token configured</p>
                    <p className="text-sm mb-4">Add your useapi.net token in settings first</p>
                    <Button variant="outline" onClick={handleOpenSettings}><Settings className="h-4 w-4 mr-1.5" />Open Settings</Button>
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
                    <div className="grid gap-4">
                      {accounts.map(acc => {
                        const isDisabled = settings?.imageGenDisabledEmails?.includes(acc.email) ?? false
                        const isDefault = settings?.imageGenPreferredEmail === acc.email
                        return (
                          <Card key={acc.email} className={cn(isDisabled && "opacity-60", isDefault && "ring-1 ring-primary/30")}>
                            <CardContent className="pt-5 pb-5">
                              <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={!isDisabled}
                                      onCheckedChange={async (checked) => {
                                        const current = settings?.imageGenDisabledEmails || []
                                        const updated = checked
                                          ? current.filter(e => e !== acc.email)
                                          : [...current, acc.email]
                                        await updateSettings({ imageGenDisabledEmails: updated })
                                      }}
                                    />
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span className={cn("font-medium", isDisabled && "line-through text-muted-foreground")}>{acc.email}</span>
                                    <Badge variant={acc.health === 'OK' ? 'default' : 'destructive'} className={cn("text-xs", acc.health === 'OK' && "bg-green-500")}>
                                      {acc.health}
                                    </Badge>
                                    {isDisabled && <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>}
                                    {isDefault && <Badge className="text-xs bg-primary">Default</Badge>}
                                    {!isDefault && !isDisabled && (
                                      <button
                                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                                        onClick={() => updateSettings({ imageGenPreferredEmail: acc.email })}
                                      >
                                        Set as default
                                      </button>
                                    )}
                                  </div>
                                  {acc.error && <p className="text-sm text-red-500">{acc.error}</p>}
                                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Created: {new Date(acc.created).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1"><Shield className="h-3 w-3" />Session expires: {acc.sessionExpires ? new Date(acc.sessionExpires).toLocaleString() : 'N/A'}</span>
                                    <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />Next refresh: {acc.nextRefresh ? new Date(acc.nextRefresh).toLocaleString() : 'N/A'}</span>
                                  </div>
                                  {acc.projectTitle && <p className="text-xs text-muted-foreground">Project: {acc.projectTitle}</p>}
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={() => openRefreshSession(acc.email)}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-1.5" />Refresh
                                  </Button>
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={() => deleteAccount(acc.email)}
                                    disabled={deletingEmail === acc.email}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    {deletingEmail === acc.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1.5" />Remove</>}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
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

                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="text-base">Available API Endpoints</CardTitle>
                      <CardDescription>All useapi.net Google Flow features accessible from this app</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {[
                          { method: 'POST', path: '/images', label: 'Generate Images', desc: 'Generate 1-4 images from text prompt', available: true },
                          { method: 'POST', path: '/images/upscale', label: 'Upscale Image', desc: '2K/4K upscale (nano-banana-2, pro only)', available: true },
                          { method: 'POST', path: '/assets', label: 'Upload Reference', desc: 'Upload reference images for guided generation', available: true },
                          { method: 'GET', path: '/accounts', label: 'List Accounts', desc: 'View connected Google accounts', available: true },
                          { method: 'POST', path: '/accounts', label: 'Register Account', desc: 'Connect a Google account via cookies', available: true },
                          { method: 'DELETE', path: '/accounts/{email}', label: 'Remove Account', desc: 'Disconnect a Google account', available: true },
                          { method: 'GET', path: '/jobs', label: 'Job Stats', desc: 'View generation stats and load balancing', available: true },
                          { method: 'POST', path: '/videos', label: 'Generate Videos', desc: 'Requires Google AI Pro/Ultra subscription', available: false },
                        ].map((ep) => (
                          <div key={ep.path + ep.method} className={cn("flex items-start gap-3 rounded-lg border p-3", !ep.available && "opacity-50")}>
                            <Badge variant="outline" className={cn("text-xs font-mono flex-shrink-0 mt-0.5",
                              ep.method === 'GET' && 'border-green-500 text-green-600',
                              ep.method === 'POST' && 'border-blue-500 text-blue-600',
                              ep.method === 'DELETE' && 'border-red-500 text-red-600',
                            )}>{ep.method}</Badge>
                            <div>
                              <p className="text-sm font-medium">{ep.label}</p>
                              <p className="text-xs text-muted-foreground">{ep.desc}</p>
                              <code className="text-xs text-muted-foreground/60">{ep.path}</code>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4 mt-0">
              {!hasToken ? (
                <Card><CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Settings className="h-12 w-12 mb-3 opacity-40" /><p>No API token configured</p>
                    <Button variant="outline" className="mt-4" onClick={handleOpenSettings}><Settings className="h-4 w-4 mr-1.5" />Open Settings</Button>
                  </div>
                </CardContent></Card>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Job Statistics</h2>
                    <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loadingJobs}>
                      <RefreshCw className={cn("h-4 w-4 mr-1.5", loadingJobs && "animate-spin")} />Refresh
                    </Button>
                  </div>

                  {loadingJobs ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : !jobs ? (
                    <Card><CardContent className="pt-6">
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Activity className="h-12 w-12 mb-3 opacity-40" /><p>No job data yet</p><p className="text-sm">Stats appear after generating images</p>
                      </div>
                    </CardContent></Card>
                  ) : (
                    <div className="space-y-4">
                      {jobs.images?.summary && Object.entries(jobs.images.summary).map(([email, stats]) => (
                        <Card key={email}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" />{email}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                              <div className="text-center p-2 rounded-lg bg-muted">
                                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                                <p className="text-xs text-muted-foreground">Completed</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-muted">
                                <p className="text-2xl font-bold text-blue-600">{stats.executing}</p>
                                <p className="text-xs text-muted-foreground">Running</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-muted">
                                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                                <p className="text-xs text-muted-foreground">Failed</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-muted">
                                <p className="text-2xl font-bold text-yellow-600">{stats.rateLimited}</p>
                                <p className="text-xs text-muted-foreground">Rate Limited</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-muted">
                                <p className="text-2xl font-bold">{stats.avgResponseTime ? `${Math.round(stats.avgResponseTime / 1000)}s` : '-'}</p>
                                <p className="text-xs text-muted-foreground">Avg Time</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {jobs.images?.history && Object.keys(jobs.images.history).length > 0 && (
                        <Card>
                          <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Jobs (last 15 min)</CardTitle></CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {Object.entries(jobs.images.history).map(([jobId, job]) => (
                                <div key={jobId} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={job.httpStatus === 200 ? 'default' : 'destructive'} className={cn("text-xs", job.httpStatus === 200 && "bg-green-500")}>{job.httpStatus}</Badge>
                                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{jobId}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>{Math.round(job.responseTime / 1000)}s</span>
                                    <span>{job.email}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Full Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={open => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none border-none p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-normal text-muted-foreground line-clamp-2">{previewImage?.prompt}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-foreground/70">{IMAGE_GEN_MODELS.find(m => m.value === previewImage?.model)?.label || previewImage?.model}</span>
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
                <Button variant="outline" size="sm" onClick={() => handleDelete(previewImage.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1.5" />Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Image Generator Settings</DialogTitle>
            <DialogDescription>Configure your useapi.net token and model.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <div><Label htmlFor="ig-enabled" className="text-sm font-medium">Enable Image Generation</Label><p className="text-xs text-muted-foreground mt-0.5">Turn on or off</p></div>
              <Switch id="ig-enabled" checked={settingsEnabled} onCheckedChange={setSettingsEnabled} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ig-token">useapi.net API Token</Label>
              <div className="relative">
                <Input id="ig-token" type={showToken ? 'text' : 'password'} placeholder="user:XXXX-XXXXXXXXX" value={settingsToken} onChange={e => setSettingsToken(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</> : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Standing Prompt Dialog */}
      <Dialog open={standingPromptOpen} onOpenChange={setStandingPromptOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Standing Prompt</DialogTitle>
            <DialogDescription>This text is automatically prepended to every prompt you send.</DialogDescription>
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
            {settings?.imageGenStandingPrompt && (
              <Button
                variant="ghost"
                className="mr-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={async () => {
                  setSavingStandingPrompt(true)
                  await setImageGenStandingPrompt(null)
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
                setSavingStandingPrompt(true)
                await setImageGenStandingPrompt(standingPromptDraft.trim() || null)
                setSavingStandingPrompt(false)
                setStandingPromptOpen(false)
              }}
              disabled={savingStandingPrompt}
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
  )
}
