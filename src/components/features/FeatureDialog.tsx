'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Feature, FeatureInput, FeatureStatus, Priority } from '@/types'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Layers,
  Code,
  Database,
  Globe,
  Lock,
  Mail,
  MessageSquare,
  Settings,
  Shield,
  ShoppingCart,
  User,
  Users,
  Zap,
  Bell,
  Calendar,
  Camera,
  CreditCard,
  FileText,
  Heart,
  Home,
  Image,
  Layout,
  Map,
  Music,
  Phone,
  Search,
  Star,
  Upload,
  Video,
  Wifi,
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Award,
  Banknote,
  BarChart,
  Battery,
  Bluetooth,
  Bookmark,
  Box,
  Briefcase,
  Bug,
  Building,
  Cake,
  Calculator,
  Check,
  CheckCircle,
  ChevronRight,
  Clipboard,
  Clock,
  Cloud,
  Cpu,
  Crosshair,
  Crown,
  DollarSign,
  Download,
  Droplet,
  Edit,
  Eye,
  Facebook,
  File,
  Filter,
  Flag,
  Flame,
  Folder,
  Gamepad2,
  Gift,
  Github,
  Glasses,
  Grid,
  Hammer,
  HardDrive,
  Headphones,
  HelpCircle,
  Inbox,
  Info,
  Instagram,
  Key,
  Laptop,
  Layers2,
  Lightbulb,
  Link,
  List,
  Locate,
  MapPin,
  Maximize,
  Megaphone,
  Menu,
  Mic,
  Monitor,
  Moon,
  Mountain,
  MousePointer,
  Navigation,
  Package,
  Palette,
  Paperclip,
  Pause,
  Pencil,
  Percent,
  PieChart,
  Pin,
  Plane,
  Play,
  Plug,
  Plus,
  Podcast,
  Power,
  Printer,
  Puzzle,
  QrCode,
  Radio,
  RefreshCw,
  Repeat,
  Rocket,
  Rss,
  Ruler,
  Save,
  Scale,
  Scissors,
  Send,
  Server,
  Share,
  ShoppingBag,
  Shuffle,
  Sidebar,
  Signal,
  Smartphone,
  Smile,
  Snowflake,
  Speaker,
  Sun,
  Sunset,
  Table,
  Tablet,
  Tag,
  Target,
  Terminal,
  Thermometer,
  ThumbsUp,
  Timer,
  ToggleLeft,
  Wrench,
  Trash,
  TrendingUp,
  Triangle,
  Trophy,
  Truck,
  Tv,
  Twitter,
  Umbrella,
  Unlock,
  UserCheck,
  UserPlus,
  Voicemail,
  Volume2,
  Wallet,
  Watch,
  Wind,
  XCircle,
  Youtube,
  type LucideIcon,
} from 'lucide-react'

// Available icons for features
const featureIcons: { name: string; icon: LucideIcon }[] = [
  { name: 'layers', icon: Layers },
  { name: 'code', icon: Code },
  { name: 'database', icon: Database },
  { name: 'globe', icon: Globe },
  { name: 'lock', icon: Lock },
  { name: 'mail', icon: Mail },
  { name: 'message', icon: MessageSquare },
  { name: 'settings', icon: Settings },
  { name: 'shield', icon: Shield },
  { name: 'cart', icon: ShoppingCart },
  { name: 'user', icon: User },
  { name: 'users', icon: Users },
  { name: 'zap', icon: Zap },
  { name: 'bell', icon: Bell },
  { name: 'calendar', icon: Calendar },
  { name: 'camera', icon: Camera },
  { name: 'credit-card', icon: CreditCard },
  { name: 'file-text', icon: FileText },
  { name: 'heart', icon: Heart },
  { name: 'home', icon: Home },
  { name: 'image', icon: Image },
  { name: 'layout', icon: Layout },
  { name: 'map', icon: Map },
  { name: 'music', icon: Music },
  { name: 'phone', icon: Phone },
  { name: 'search', icon: Search },
  { name: 'star', icon: Star },
  { name: 'upload', icon: Upload },
  { name: 'video', icon: Video },
  { name: 'wifi', icon: Wifi },
  { name: 'activity', icon: Activity },
  { name: 'alert-circle', icon: AlertCircle },
  { name: 'alert-triangle', icon: AlertTriangle },
  { name: 'archive', icon: Archive },
  { name: 'arrow-right', icon: ArrowRight },
  { name: 'award', icon: Award },
  { name: 'banknote', icon: Banknote },
  { name: 'bar-chart', icon: BarChart },
  { name: 'battery', icon: Battery },
  { name: 'bluetooth', icon: Bluetooth },
  { name: 'bookmark', icon: Bookmark },
  { name: 'box', icon: Box },
  { name: 'briefcase', icon: Briefcase },
  { name: 'bug', icon: Bug },
  { name: 'building', icon: Building },
  { name: 'cake', icon: Cake },
  { name: 'calculator', icon: Calculator },
  { name: 'check', icon: Check },
  { name: 'check-circle', icon: CheckCircle },
  { name: 'chevron-right', icon: ChevronRight },
  { name: 'clipboard', icon: Clipboard },
  { name: 'clock', icon: Clock },
  { name: 'cloud', icon: Cloud },
  { name: 'cpu', icon: Cpu },
  { name: 'crosshair', icon: Crosshair },
  { name: 'crown', icon: Crown },
  { name: 'dollar-sign', icon: DollarSign },
  { name: 'download', icon: Download },
  { name: 'droplet', icon: Droplet },
  { name: 'edit', icon: Edit },
  { name: 'eye', icon: Eye },
  { name: 'facebook', icon: Facebook },
  { name: 'file', icon: File },
  { name: 'filter', icon: Filter },
  { name: 'flag', icon: Flag },
  { name: 'flame', icon: Flame },
  { name: 'folder', icon: Folder },
  { name: 'gamepad', icon: Gamepad2 },
  { name: 'gift', icon: Gift },
  { name: 'github', icon: Github },
  { name: 'glasses', icon: Glasses },
  { name: 'grid', icon: Grid },
  { name: 'hammer', icon: Hammer },
  { name: 'hard-drive', icon: HardDrive },
  { name: 'headphones', icon: Headphones },
  { name: 'help-circle', icon: HelpCircle },
  { name: 'inbox', icon: Inbox },
  { name: 'info', icon: Info },
  { name: 'instagram', icon: Instagram },
  { name: 'key', icon: Key },
  { name: 'laptop', icon: Laptop },
  { name: 'layers-2', icon: Layers2 },
  { name: 'lightbulb', icon: Lightbulb },
  { name: 'link', icon: Link },
  { name: 'list', icon: List },
  { name: 'locate', icon: Locate },
  { name: 'map-pin', icon: MapPin },
  { name: 'maximize', icon: Maximize },
  { name: 'megaphone', icon: Megaphone },
  { name: 'menu', icon: Menu },
  { name: 'mic', icon: Mic },
  { name: 'monitor', icon: Monitor },
  { name: 'moon', icon: Moon },
  { name: 'mountain', icon: Mountain },
  { name: 'mouse-pointer', icon: MousePointer },
  { name: 'navigation', icon: Navigation },
  { name: 'package', icon: Package },
  { name: 'palette', icon: Palette },
  { name: 'paperclip', icon: Paperclip },
  { name: 'pause', icon: Pause },
  { name: 'pencil', icon: Pencil },
  { name: 'percent', icon: Percent },
  { name: 'pie-chart', icon: PieChart },
  { name: 'pin', icon: Pin },
  { name: 'plane', icon: Plane },
  { name: 'play', icon: Play },
  { name: 'plug', icon: Plug },
  { name: 'plus', icon: Plus },
  { name: 'podcast', icon: Podcast },
  { name: 'power', icon: Power },
  { name: 'printer', icon: Printer },
  { name: 'puzzle', icon: Puzzle },
  { name: 'qr-code', icon: QrCode },
  { name: 'radio', icon: Radio },
  { name: 'refresh', icon: RefreshCw },
  { name: 'repeat', icon: Repeat },
  { name: 'rocket', icon: Rocket },
  { name: 'rss', icon: Rss },
  { name: 'ruler', icon: Ruler },
  { name: 'save', icon: Save },
  { name: 'scale', icon: Scale },
  { name: 'scissors', icon: Scissors },
  { name: 'send', icon: Send },
  { name: 'server', icon: Server },
  { name: 'share', icon: Share },
  { name: 'shopping-bag', icon: ShoppingBag },
  { name: 'shuffle', icon: Shuffle },
  { name: 'sidebar', icon: Sidebar },
  { name: 'signal', icon: Signal },
  { name: 'smartphone', icon: Smartphone },
  { name: 'smile', icon: Smile },
  { name: 'snowflake', icon: Snowflake },
  { name: 'speaker', icon: Speaker },
  { name: 'sun', icon: Sun },
  { name: 'sunset', icon: Sunset },
  { name: 'table', icon: Table },
  { name: 'tablet', icon: Tablet },
  { name: 'tag', icon: Tag },
  { name: 'target', icon: Target },
  { name: 'terminal', icon: Terminal },
  { name: 'thermometer', icon: Thermometer },
  { name: 'thumbs-up', icon: ThumbsUp },
  { name: 'timer', icon: Timer },
  { name: 'toggle', icon: ToggleLeft },
  { name: 'tool', icon: Wrench },
  { name: 'trash', icon: Trash },
  { name: 'trending-up', icon: TrendingUp },
  { name: 'triangle', icon: Triangle },
  { name: 'trophy', icon: Trophy },
  { name: 'truck', icon: Truck },
  { name: 'tv', icon: Tv },
  { name: 'twitter', icon: Twitter },
  { name: 'umbrella', icon: Umbrella },
  { name: 'unlock', icon: Unlock },
  { name: 'user-check', icon: UserCheck },
  { name: 'user-plus', icon: UserPlus },
  { name: 'voicemail', icon: Voicemail },
  { name: 'volume', icon: Volume2 },
  { name: 'wallet', icon: Wallet },
  { name: 'watch', icon: Watch },
  { name: 'wind', icon: Wind },
  { name: 'wrench', icon: Wrench },
  { name: 'x-circle', icon: XCircle },
  { name: 'youtube', icon: Youtube },
]

export function getFeatureIcon(iconName: string | null): LucideIcon {
  if (!iconName) return Layers
  const found = featureIcons.find((i) => i.name === iconName)
  return found?.icon || Layers
}

interface FeatureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature?: Feature | null
  projectId: string
  onSubmit: (data: FeatureInput) => Promise<void>
}

export function FeatureDialog({
  open,
  onOpenChange,
  feature,
  projectId,
  onSubmit,
}: FeatureDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [iconSearch, setIconSearch] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: '' as Priority | '',
    estimatedHours: '',
    status: 'pending' as FeatureStatus,
    icon: null as string | null,
  })

  useEffect(() => {
    if (feature) {
      setFormData({
        name: feature.name,
        description: feature.description,
        priority: feature.priority || '',
        estimatedHours: feature.estimatedHours.toString(),
        status: feature.status,
        icon: feature.icon || null,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        priority: '',
        estimatedHours: '',
        status: 'pending',
        icon: null,
      })
    }
  }, [feature, open])

  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        projectId,
        name: formData.name,
        description: formData.description,
        priority: (formData.priority || null) as Priority,
        estimatedHours: parseFloat(formData.estimatedHours) || 0,
        status: formData.status,
        icon: formData.icon,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const SelectedIcon = getFeatureIcon(formData.icon)

  const isEdit = !!feature

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Feature' : 'Create Feature'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the feature details'
              : 'Add a new feature to organize your tasks'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Icon & Name Row */}
          <div className="flex gap-4 items-start">
            {/* Icon Picker */}
            <Popover open={iconPickerOpen} onOpenChange={(open) => {
                setIconPickerOpen(open)
                if (!open) setIconSearch('')
              }}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex-shrink-0 w-16 h-16 mt-5 rounded-xl border-2 border-dashed flex items-center justify-center transition-all hover:border-primary/50 hover:bg-muted/50 group',
                    formData.icon
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-muted-foreground/25'
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
                    formData.icon
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                  )}>
                    <SelectedIcon className="h-6 w-6" />
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search icons..."
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-3">
                    <div className="grid grid-cols-7 gap-1">
                      {featureIcons
                        .filter(({ name }) =>
                          name.toLowerCase().includes(iconSearch.toLowerCase())
                        )
                        .map(({ name, icon: Icon }) => (
                          <button
                            key={name}
                            type="button"
                            className={cn(
                              'h-9 w-9 rounded-lg flex items-center justify-center transition-all hover:bg-muted',
                              formData.icon === name && 'bg-primary/15 text-primary ring-2 ring-primary/30'
                            )}
                            onClick={() => {
                              setFormData({ ...formData, icon: name })
                              setIconPickerOpen(false)
                              setIconSearch('')
                            }}
                            title={name}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        ))}
                    </div>
                    {featureIcons.filter(({ name }) =>
                      name.toLowerCase().includes(iconSearch.toLowerCase())
                    ).length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">
                        No icons found
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Name & Label */}
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Feature Name *</Label>
              <Input
                placeholder="e.g., User Authentication"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="h-11 text-base"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Feature description..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value === 'none' ? '' : value as Priority })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as FeatureStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Estimated Hours</Label>
            <Input
              type="number"
              placeholder="0"
              value={formData.estimatedHours}
              onChange={(e) =>
                setFormData({ ...formData, estimatedHours: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
