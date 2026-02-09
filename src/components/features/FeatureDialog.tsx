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
  // Additional icons for more variety
  Accessibility,
  Airplay,
  Anchor,
  Aperture,
  AtSign,
  Baby,
  Banana,
  Bed,
  Beer,
  Bird,
  Bike,
  Binary,
  Bone,
  Bot,
  Brain,
  Bus,
  Cable,
  Cat,
  Cherry,
  Church,
  CircleDot,
  Citrus,
  Clapperboard,
  CloudRain,
  Coffee,
  Coins,
  Compass,
  Construction,
  Contact,
  Cookie,
  Dices,
  Disc,
  Dog,
  Drama,
  Ear,
  Egg,
  Factory,
  Fan,
  Fence,
  Fingerprint,
  Fish,
  FlaskConical,
  Flower,
  Footprints,
  Forklift,
  Frown,
  Gem,
  Ghost,
  GraduationCap,
  Grape,
  HandMetal,
  Hash,
  HeartPulse,
  Hexagon,
  Hospital,
  Hotel,
  Hourglass,
  IceCreamCone,
  Infinity,
  Joystick,
  Kanban,
  Landmark,
  Languages,
  Leaf,
  Library,
  LifeBuoy,
  Linkedin,
  Magnet,
  MailOpen,
  MapPinned,
  Medal,
  MessageCircle,
  Microscope,
  Milestone,
  Newspaper,
  Nut,
  Orbit,
  PaintBucket,
  Palmtree,
  PanelLeft,
  Parentheses,
  PawPrint,
  Pen,
  PersonStanding,
  Piano,
  Pizza,
  Popcorn,
  Presentation,
  Receipt,
  Recycle,
  Regex,
  Route,
  Sailboat,
  Satellite,
  School,
  ScrollText,
  Ship,
  Shirt,
  Skull,
  Sofa,
  Sparkles,
  Sprout,
  Stamp,
  Stethoscope,
  Store,
  SunMedium,
  Swords,
  Syringe,
  Telescope,
  Tent,
  TestTube,
  Ticket,
  Tornado,
  Tractor,
  Train,
  TreePine,
  Unplug,
  UtensilsCrossed,
  Vegan,
  Volleyball,
  Vote,
  Warehouse,
  Waves,
  Webhook,
  Wheat,
  Wine,
  Workflow,
  Worm,
  type LucideIcon,
} from 'lucide-react'

// Available icons for features with keyword tags for smart search
const featureIcons: { name: string; icon: LucideIcon; tags: string[] }[] = [
  { name: 'layers', icon: Layers, tags: ['stack', 'group', 'organize', 'structure'] },
  { name: 'code', icon: Code, tags: ['development', 'programming', 'dev', 'html', 'software', 'engineering'] },
  { name: 'database', icon: Database, tags: ['data', 'storage', 'sql', 'backend', 'server'] },
  { name: 'globe', icon: Globe, tags: ['web', 'world', 'internet', 'website', 'international', 'network'] },
  { name: 'lock', icon: Lock, tags: ['security', 'auth', 'password', 'private', 'protected', 'authentication'] },
  { name: 'mail', icon: Mail, tags: ['email', 'message', 'communication', 'inbox', 'notification', 'letter'] },
  { name: 'message', icon: MessageSquare, tags: ['chat', 'communication', 'comment', 'text', 'conversation', 'support'] },
  { name: 'settings', icon: Settings, tags: ['config', 'configuration', 'gear', 'preferences', 'options', 'admin'] },
  { name: 'shield', icon: Shield, tags: ['security', 'protection', 'safety', 'guard', 'defense', 'auth'] },
  { name: 'cart', icon: ShoppingCart, tags: ['shopping', 'ecommerce', 'buy', 'purchase', 'payment', 'store', 'commerce'] },
  { name: 'user', icon: User, tags: ['profile', 'account', 'person', 'member', 'avatar', 'auth'] },
  { name: 'users', icon: Users, tags: ['team', 'group', 'people', 'members', 'community', 'collaboration'] },
  { name: 'zap', icon: Zap, tags: ['fast', 'speed', 'lightning', 'power', 'energy', 'performance', 'quick'] },
  { name: 'bell', icon: Bell, tags: ['notification', 'alert', 'reminder', 'alarm', 'push'] },
  { name: 'calendar', icon: Calendar, tags: ['date', 'schedule', 'event', 'time', 'booking', 'appointment', 'planner'] },
  { name: 'camera', icon: Camera, tags: ['photo', 'picture', 'image', 'media', 'capture', 'photography'] },
  { name: 'credit-card', icon: CreditCard, tags: ['payment', 'money', 'finance', 'billing', 'checkout', 'transaction', 'pay'] },
  { name: 'file-text', icon: FileText, tags: ['document', 'text', 'content', 'article', 'report', 'docs', 'writing'] },
  { name: 'heart', icon: Heart, tags: ['favorite', 'like', 'love', 'health', 'wellness', 'wishlist'] },
  { name: 'home', icon: Home, tags: ['dashboard', 'main', 'house', 'landing', 'homepage'] },
  { name: 'image', icon: Image, tags: ['photo', 'picture', 'media', 'gallery', 'graphic'] },
  { name: 'layout', icon: Layout, tags: ['design', 'ui', 'template', 'interface', 'page', 'frontend'] },
  { name: 'map', icon: Map, tags: ['location', 'navigation', 'gps', 'directions', 'geography', 'places'] },
  { name: 'music', icon: Music, tags: ['audio', 'sound', 'media', 'song', 'player', 'streaming'] },
  { name: 'phone', icon: Phone, tags: ['call', 'mobile', 'contact', 'telephone', 'communication'] },
  { name: 'search', icon: Search, tags: ['find', 'lookup', 'explore', 'discover', 'filter', 'query'] },
  { name: 'star', icon: Star, tags: ['favorite', 'rating', 'review', 'featured', 'bookmark', 'important'] },
  { name: 'upload', icon: Upload, tags: ['file', 'import', 'attachment', 'media', 'cloud'] },
  { name: 'video', icon: Video, tags: ['media', 'stream', 'recording', 'camera', 'content', 'movie'] },
  { name: 'wifi', icon: Wifi, tags: ['network', 'internet', 'connection', 'wireless', 'signal', 'online'] },
  { name: 'activity', icon: Activity, tags: ['analytics', 'monitoring', 'health', 'pulse', 'status', 'log'] },
  { name: 'alert-circle', icon: AlertCircle, tags: ['warning', 'error', 'notification', 'danger', 'attention'] },
  { name: 'alert-triangle', icon: AlertTriangle, tags: ['warning', 'caution', 'error', 'danger', 'attention'] },
  { name: 'archive', icon: Archive, tags: ['storage', 'backup', 'history', 'old', 'save'] },
  { name: 'arrow-right', icon: ArrowRight, tags: ['next', 'forward', 'direction', 'flow', 'navigation'] },
  { name: 'award', icon: Award, tags: ['achievement', 'prize', 'medal', 'reward', 'recognition', 'badge'] },
  { name: 'banknote', icon: Banknote, tags: ['money', 'payment', 'finance', 'cash', 'billing', 'income', 'pay'] },
  { name: 'bar-chart', icon: BarChart, tags: ['analytics', 'chart', 'graph', 'statistics', 'report', 'data', 'dashboard'] },
  { name: 'battery', icon: Battery, tags: ['power', 'energy', 'charge', 'device', 'status'] },
  { name: 'bluetooth', icon: Bluetooth, tags: ['wireless', 'connection', 'device', 'pair'] },
  { name: 'bookmark', icon: Bookmark, tags: ['save', 'favorite', 'mark', 'read', 'later'] },
  { name: 'box', icon: Box, tags: ['package', 'product', 'container', 'shipping', 'inventory'] },
  { name: 'briefcase', icon: Briefcase, tags: ['work', 'business', 'job', 'career', 'portfolio', 'professional'] },
  { name: 'bug', icon: Bug, tags: ['error', 'issue', 'debug', 'fix', 'problem', 'testing', 'qa'] },
  { name: 'building', icon: Building, tags: ['company', 'office', 'organization', 'business', 'corporate', 'enterprise'] },
  { name: 'cake', icon: Cake, tags: ['birthday', 'celebration', 'event', 'party', 'anniversary'] },
  { name: 'calculator', icon: Calculator, tags: ['math', 'calculate', 'finance', 'number', 'accounting'] },
  { name: 'check', icon: Check, tags: ['done', 'complete', 'success', 'approve', 'confirm', 'verify'] },
  { name: 'check-circle', icon: CheckCircle, tags: ['done', 'complete', 'success', 'approve', 'verify', 'confirmed'] },
  { name: 'chevron-right', icon: ChevronRight, tags: ['next', 'forward', 'arrow', 'expand', 'navigation'] },
  { name: 'clipboard', icon: Clipboard, tags: ['copy', 'paste', 'notes', 'task', 'checklist', 'document'] },
  { name: 'clock', icon: Clock, tags: ['time', 'schedule', 'timer', 'deadline', 'tracking', 'hours'] },
  { name: 'cloud', icon: Cloud, tags: ['storage', 'hosting', 'server', 'backup', 'sync', 'upload'] },
  { name: 'cpu', icon: Cpu, tags: ['processor', 'hardware', 'performance', 'computing', 'system', 'tech'] },
  { name: 'crosshair', icon: Crosshair, tags: ['target', 'focus', 'aim', 'precision', 'location'] },
  { name: 'crown', icon: Crown, tags: ['premium', 'vip', 'king', 'royal', 'top', 'pro', 'subscription'] },
  { name: 'dollar-sign', icon: DollarSign, tags: ['money', 'payment', 'finance', 'price', 'currency', 'billing', 'cost', 'pay'] },
  { name: 'download', icon: Download, tags: ['file', 'save', 'export', 'get', 'install'] },
  { name: 'droplet', icon: Droplet, tags: ['water', 'liquid', 'color', 'theme', 'weather', 'rain'] },
  { name: 'edit', icon: Edit, tags: ['write', 'modify', 'change', 'update', 'pencil', 'compose'] },
  { name: 'eye', icon: Eye, tags: ['view', 'visibility', 'watch', 'preview', 'show', 'read'] },
  { name: 'facebook', icon: Facebook, tags: ['social', 'media', 'network', 'sharing'] },
  { name: 'file', icon: File, tags: ['document', 'attachment', 'upload', 'content'] },
  { name: 'filter', icon: Filter, tags: ['sort', 'search', 'refine', 'funnel', 'query'] },
  { name: 'flag', icon: Flag, tags: ['report', 'mark', 'milestone', 'country', 'priority', 'important'] },
  { name: 'flame', icon: Flame, tags: ['fire', 'hot', 'trending', 'popular', 'streak'] },
  { name: 'folder', icon: Folder, tags: ['directory', 'file', 'organize', 'category', 'group', 'storage'] },
  { name: 'gamepad', icon: Gamepad2, tags: ['game', 'gaming', 'play', 'controller', 'entertainment'] },
  { name: 'gift', icon: Gift, tags: ['present', 'reward', 'bonus', 'surprise', 'promotion', 'offer'] },
  { name: 'github', icon: Github, tags: ['code', 'repository', 'development', 'git', 'version', 'social'] },
  { name: 'glasses', icon: Glasses, tags: ['read', 'view', 'accessibility', 'vision', 'focus'] },
  { name: 'grid', icon: Grid, tags: ['layout', 'gallery', 'dashboard', 'tiles', 'view'] },
  { name: 'hammer', icon: Hammer, tags: ['build', 'tool', 'construct', 'fix', 'repair', 'development'] },
  { name: 'hard-drive', icon: HardDrive, tags: ['storage', 'disk', 'data', 'server', 'backup', 'hardware'] },
  { name: 'headphones', icon: Headphones, tags: ['audio', 'music', 'sound', 'listen', 'media', 'support'] },
  { name: 'help-circle', icon: HelpCircle, tags: ['question', 'help', 'faq', 'support', 'info', 'guide'] },
  { name: 'inbox', icon: Inbox, tags: ['mail', 'message', 'notification', 'queue', 'receive'] },
  { name: 'info', icon: Info, tags: ['information', 'about', 'details', 'help', 'tooltip'] },
  { name: 'instagram', icon: Instagram, tags: ['social', 'media', 'photo', 'network', 'sharing'] },
  { name: 'key', icon: Key, tags: ['security', 'auth', 'password', 'access', 'api', 'authentication', 'login'] },
  { name: 'laptop', icon: Laptop, tags: ['computer', 'device', 'desktop', 'work', 'tech', 'hardware'] },
  { name: 'layers-2', icon: Layers2, tags: ['stack', 'group', 'organize', 'structure', 'levels'] },
  { name: 'lightbulb', icon: Lightbulb, tags: ['idea', 'tip', 'suggestion', 'insight', 'innovation', 'creative'] },
  { name: 'link', icon: Link, tags: ['url', 'chain', 'connection', 'reference', 'hyperlink', 'share'] },
  { name: 'list', icon: List, tags: ['menu', 'items', 'todo', 'checklist', 'tasks', 'order'] },
  { name: 'locate', icon: Locate, tags: ['location', 'gps', 'position', 'find', 'current', 'nearby'] },
  { name: 'map-pin', icon: MapPin, tags: ['location', 'place', 'address', 'marker', 'gps', 'pin'] },
  { name: 'maximize', icon: Maximize, tags: ['fullscreen', 'expand', 'resize', 'enlarge', 'zoom'] },
  { name: 'megaphone', icon: Megaphone, tags: ['announcement', 'marketing', 'promotion', 'broadcast', 'campaign', 'ads'] },
  { name: 'menu', icon: Menu, tags: ['hamburger', 'navigation', 'sidebar', 'options', 'toggle'] },
  { name: 'mic', icon: Mic, tags: ['audio', 'voice', 'record', 'sound', 'speech', 'podcast'] },
  { name: 'monitor', icon: Monitor, tags: ['screen', 'display', 'desktop', 'computer', 'device', 'tv'] },
  { name: 'moon', icon: Moon, tags: ['dark', 'night', 'theme', 'mode', 'sleep'] },
  { name: 'mountain', icon: Mountain, tags: ['landscape', 'nature', 'outdoor', 'adventure', 'travel'] },
  { name: 'mouse-pointer', icon: MousePointer, tags: ['cursor', 'click', 'interface', 'ui', 'interaction'] },
  { name: 'navigation', icon: Navigation, tags: ['direction', 'gps', 'compass', 'route', 'location'] },
  { name: 'package', icon: Package, tags: ['product', 'delivery', 'shipping', 'box', 'module', 'npm', 'library'] },
  { name: 'palette', icon: Palette, tags: ['color', 'design', 'theme', 'art', 'style', 'creative', 'paint'] },
  { name: 'paperclip', icon: Paperclip, tags: ['attachment', 'file', 'document', 'attach', 'clip'] },
  { name: 'pause', icon: Pause, tags: ['stop', 'wait', 'break', 'media', 'control'] },
  { name: 'pencil', icon: Pencil, tags: ['edit', 'write', 'draw', 'compose', 'create'] },
  { name: 'percent', icon: Percent, tags: ['discount', 'sale', 'rate', 'percentage', 'math', 'offer'] },
  { name: 'pie-chart', icon: PieChart, tags: ['analytics', 'chart', 'statistics', 'report', 'data', 'graph'] },
  { name: 'pin', icon: Pin, tags: ['location', 'mark', 'save', 'attach', 'important', 'sticky'] },
  { name: 'plane', icon: Plane, tags: ['travel', 'flight', 'airport', 'trip', 'transport', 'vacation'] },
  { name: 'play', icon: Play, tags: ['start', 'media', 'video', 'audio', 'begin', 'run'] },
  { name: 'plug', icon: Plug, tags: ['plugin', 'extension', 'connect', 'integration', 'power', 'api'] },
  { name: 'plus', icon: Plus, tags: ['add', 'new', 'create', 'more', 'increase'] },
  { name: 'podcast', icon: Podcast, tags: ['audio', 'media', 'show', 'streaming', 'broadcast', 'radio'] },
  { name: 'power', icon: Power, tags: ['on', 'off', 'switch', 'energy', 'start', 'shutdown'] },
  { name: 'printer', icon: Printer, tags: ['print', 'document', 'paper', 'output', 'office'] },
  { name: 'puzzle', icon: Puzzle, tags: ['extension', 'plugin', 'module', 'integration', 'piece', 'addon'] },
  { name: 'qr-code', icon: QrCode, tags: ['scan', 'barcode', 'link', 'mobile', 'code'] },
  { name: 'radio', icon: Radio, tags: ['broadcast', 'audio', 'media', 'stream', 'live'] },
  { name: 'refresh', icon: RefreshCw, tags: ['reload', 'sync', 'update', 'retry', 'loop'] },
  { name: 'repeat', icon: Repeat, tags: ['loop', 'cycle', 'recur', 'again', 'replay'] },
  { name: 'rocket', icon: Rocket, tags: ['launch', 'deploy', 'speed', 'startup', 'fast', 'release', 'ship'] },
  { name: 'rss', icon: Rss, tags: ['feed', 'blog', 'news', 'subscribe', 'content'] },
  { name: 'ruler', icon: Ruler, tags: ['measure', 'size', 'dimension', 'design', 'tool'] },
  { name: 'save', icon: Save, tags: ['disk', 'store', 'keep', 'preserve', 'file'] },
  { name: 'scale', icon: Scale, tags: ['balance', 'weight', 'measure', 'justice', 'compare'] },
  { name: 'scissors', icon: Scissors, tags: ['cut', 'trim', 'crop', 'edit', 'tool'] },
  { name: 'send', icon: Send, tags: ['message', 'mail', 'submit', 'deliver', 'share', 'communication'] },
  { name: 'server', icon: Server, tags: ['backend', 'hosting', 'data', 'infrastructure', 'api', 'cloud'] },
  { name: 'share', icon: Share, tags: ['social', 'link', 'send', 'distribute', 'export'] },
  { name: 'shopping-bag', icon: ShoppingBag, tags: ['ecommerce', 'store', 'buy', 'purchase', 'shopping', 'payment'] },
  { name: 'shuffle', icon: Shuffle, tags: ['random', 'mix', 'reorder', 'rearrange'] },
  { name: 'sidebar', icon: Sidebar, tags: ['layout', 'menu', 'panel', 'navigation', 'ui'] },
  { name: 'signal', icon: Signal, tags: ['network', 'connection', 'reception', 'wireless', 'status'] },
  { name: 'smartphone', icon: Smartphone, tags: ['mobile', 'phone', 'device', 'app', 'responsive'] },
  { name: 'smile', icon: Smile, tags: ['emoji', 'happy', 'reaction', 'feedback', 'face', 'mood'] },
  { name: 'snowflake', icon: Snowflake, tags: ['winter', 'cold', 'weather', 'frozen', 'ice'] },
  { name: 'speaker', icon: Speaker, tags: ['audio', 'sound', 'volume', 'music', 'output'] },
  { name: 'sun', icon: Sun, tags: ['light', 'day', 'theme', 'bright', 'weather', 'mode'] },
  { name: 'sunset', icon: Sunset, tags: ['evening', 'weather', 'nature', 'landscape'] },
  { name: 'table', icon: Table, tags: ['data', 'grid', 'spreadsheet', 'list', 'database', 'rows'] },
  { name: 'tablet', icon: Tablet, tags: ['device', 'ipad', 'mobile', 'responsive', 'screen'] },
  { name: 'tag', icon: Tag, tags: ['label', 'category', 'price', 'badge', 'metadata', 'classify'] },
  { name: 'target', icon: Target, tags: ['goal', 'aim', 'focus', 'objective', 'kpi', 'metric'] },
  { name: 'terminal', icon: Terminal, tags: ['code', 'command', 'cli', 'console', 'development', 'shell'] },
  { name: 'thermometer', icon: Thermometer, tags: ['temperature', 'weather', 'health', 'status', 'level'] },
  { name: 'thumbs-up', icon: ThumbsUp, tags: ['like', 'approve', 'feedback', 'good', 'positive', 'vote'] },
  { name: 'timer', icon: Timer, tags: ['countdown', 'time', 'clock', 'deadline', 'stopwatch', 'tracking'] },
  { name: 'toggle', icon: ToggleLeft, tags: ['switch', 'on', 'off', 'setting', 'control', 'boolean'] },
  { name: 'tool', icon: Wrench, tags: ['fix', 'repair', 'settings', 'maintenance', 'utility', 'config'] },
  { name: 'trash', icon: Trash, tags: ['delete', 'remove', 'bin', 'discard', 'cleanup'] },
  { name: 'trending-up', icon: TrendingUp, tags: ['growth', 'increase', 'analytics', 'profit', 'progress', 'chart'] },
  { name: 'triangle', icon: Triangle, tags: ['shape', 'warning', 'geometry', 'play'] },
  { name: 'trophy', icon: Trophy, tags: ['achievement', 'winner', 'prize', 'award', 'competition', 'gamification'] },
  { name: 'truck', icon: Truck, tags: ['delivery', 'shipping', 'transport', 'logistics', 'order'] },
  { name: 'tv', icon: Tv, tags: ['screen', 'display', 'video', 'media', 'entertainment', 'monitor'] },
  { name: 'twitter', icon: Twitter, tags: ['social', 'media', 'network', 'sharing', 'x'] },
  { name: 'umbrella', icon: Umbrella, tags: ['weather', 'rain', 'protection', 'insurance', 'cover'] },
  { name: 'unlock', icon: Unlock, tags: ['security', 'access', 'open', 'public', 'free'] },
  { name: 'user-check', icon: UserCheck, tags: ['verify', 'approve', 'auth', 'confirmed', 'validated', 'identity'] },
  { name: 'user-plus', icon: UserPlus, tags: ['register', 'signup', 'invite', 'add', 'member', 'onboarding'] },
  { name: 'voicemail', icon: Voicemail, tags: ['audio', 'message', 'phone', 'call', 'recording'] },
  { name: 'volume', icon: Volume2, tags: ['audio', 'sound', 'speaker', 'loud', 'mute'] },
  { name: 'wallet', icon: Wallet, tags: ['money', 'payment', 'finance', 'balance', 'billing', 'pay'] },
  { name: 'watch', icon: Watch, tags: ['time', 'wearable', 'clock', 'device', 'smartwatch'] },
  { name: 'wind', icon: Wind, tags: ['weather', 'air', 'breeze', 'nature'] },
  { name: 'wrench', icon: Wrench, tags: ['fix', 'repair', 'tool', 'settings', 'maintenance', 'config'] },
  { name: 'x-circle', icon: XCircle, tags: ['close', 'cancel', 'error', 'remove', 'delete', 'dismiss'] },
  { name: 'youtube', icon: Youtube, tags: ['video', 'social', 'media', 'streaming', 'content'] },
  // Additional icons
  { name: 'accessibility', icon: Accessibility, tags: ['a11y', 'disabled', 'inclusive', 'wheelchair', 'access'] },
  { name: 'airplay', icon: Airplay, tags: ['cast', 'stream', 'screen', 'mirror', 'wireless'] },
  { name: 'anchor', icon: Anchor, tags: ['marine', 'ship', 'port', 'dock', 'link', 'stable'] },
  { name: 'aperture', icon: Aperture, tags: ['camera', 'lens', 'photo', 'focus', 'shutter'] },
  { name: 'at-sign', icon: AtSign, tags: ['email', 'mention', 'address', 'contact', 'social'] },
  { name: 'baby', icon: Baby, tags: ['child', 'kid', 'infant', 'family', 'parenting'] },
  { name: 'banana', icon: Banana, tags: ['fruit', 'food', 'snack', 'healthy', 'nutrition'] },
  { name: 'bed', icon: Bed, tags: ['sleep', 'hotel', 'rest', 'room', 'accommodation', 'booking'] },
  { name: 'beer', icon: Beer, tags: ['drink', 'beverage', 'bar', 'celebration', 'social', 'pub'] },
  { name: 'bird', icon: Bird, tags: ['animal', 'nature', 'tweet', 'fly', 'wildlife'] },
  { name: 'bike', icon: Bike, tags: ['bicycle', 'cycling', 'transport', 'fitness', 'sport', 'exercise'] },
  { name: 'binary', icon: Binary, tags: ['code', 'data', 'programming', 'digital', 'tech', 'computer'] },
  { name: 'bone', icon: Bone, tags: ['pet', 'dog', 'health', 'skeleton', 'medical'] },
  { name: 'bot', icon: Bot, tags: ['robot', 'ai', 'automation', 'chatbot', 'assistant', 'artificial intelligence'] },
  { name: 'brain', icon: Brain, tags: ['ai', 'intelligence', 'thinking', 'mind', 'smart', 'ml', 'learning'] },
  { name: 'bus', icon: Bus, tags: ['transport', 'public', 'travel', 'vehicle', 'commute'] },
  { name: 'cable', icon: Cable, tags: ['wire', 'connection', 'usb', 'plug', 'network', 'hardware'] },
  { name: 'cat', icon: Cat, tags: ['pet', 'animal', 'kitten', 'feline'] },
  { name: 'cherry', icon: Cherry, tags: ['fruit', 'food', 'berry', 'sweet'] },
  { name: 'church', icon: Church, tags: ['religion', 'worship', 'building', 'faith', 'community'] },
  { name: 'circle-dot', icon: CircleDot, tags: ['radio', 'select', 'option', 'record', 'target'] },
  { name: 'citrus', icon: Citrus, tags: ['fruit', 'orange', 'lemon', 'food', 'fresh', 'vitamin'] },
  { name: 'clapperboard', icon: Clapperboard, tags: ['movie', 'film', 'cinema', 'video', 'production', 'director'] },
  { name: 'cloud-rain', icon: CloudRain, tags: ['weather', 'rain', 'storm', 'forecast', 'wet'] },
  { name: 'coffee', icon: Coffee, tags: ['drink', 'beverage', 'cafe', 'morning', 'break', 'cup'] },
  { name: 'coins', icon: Coins, tags: ['money', 'payment', 'finance', 'currency', 'cash', 'crypto', 'token'] },
  { name: 'compass', icon: Compass, tags: ['navigation', 'direction', 'explore', 'travel', 'safari', 'guide'] },
  { name: 'construction', icon: Construction, tags: ['build', 'work', 'progress', 'development', 'wip', 'under'] },
  { name: 'contact', icon: Contact, tags: ['person', 'address', 'book', 'people', 'directory', 'crm'] },
  { name: 'cookie', icon: Cookie, tags: ['tracking', 'privacy', 'consent', 'snack', 'bake', 'food'] },
  { name: 'dices', icon: Dices, tags: ['game', 'random', 'chance', 'luck', 'roll', 'gambling'] },
  { name: 'disc', icon: Disc, tags: ['music', 'cd', 'record', 'vinyl', 'media', 'storage'] },
  { name: 'dog', icon: Dog, tags: ['pet', 'animal', 'puppy', 'canine'] },
  { name: 'drama', icon: Drama, tags: ['theater', 'acting', 'mask', 'entertainment', 'comedy', 'tragedy'] },
  { name: 'ear', icon: Ear, tags: ['listen', 'hearing', 'audio', 'sound', 'accessibility'] },
  { name: 'egg', icon: Egg, tags: ['food', 'breakfast', 'cooking', 'easter'] },
  { name: 'factory', icon: Factory, tags: ['manufacturing', 'industry', 'production', 'warehouse', 'industrial'] },
  { name: 'fan', icon: Fan, tags: ['cool', 'air', 'ventilation', 'spin', 'rotation'] },
  { name: 'fence', icon: Fence, tags: ['boundary', 'barrier', 'garden', 'property', 'privacy'] },
  { name: 'fingerprint', icon: Fingerprint, tags: ['biometric', 'identity', 'security', 'auth', 'scan', 'verification'] },
  { name: 'fish', icon: Fish, tags: ['animal', 'sea', 'ocean', 'food', 'aquarium', 'marine'] },
  { name: 'flask', icon: FlaskConical, tags: ['science', 'lab', 'experiment', 'chemistry', 'research', 'test'] },
  { name: 'flower', icon: Flower, tags: ['nature', 'plant', 'garden', 'bloom', 'spring', 'beauty'] },
  { name: 'footprints', icon: Footprints, tags: ['steps', 'walk', 'tracking', 'trail', 'fitness', 'path'] },
  { name: 'forklift', icon: Forklift, tags: ['warehouse', 'logistics', 'shipping', 'inventory', 'factory'] },
  { name: 'frown', icon: Frown, tags: ['sad', 'unhappy', 'emotion', 'face', 'feedback', 'negative'] },
  { name: 'gem', icon: Gem, tags: ['diamond', 'premium', 'luxury', 'valuable', 'jewel', 'ruby'] },
  { name: 'ghost', icon: Ghost, tags: ['halloween', 'spooky', 'hidden', 'fun', 'invisible'] },
  { name: 'graduation-cap', icon: GraduationCap, tags: ['education', 'school', 'university', 'learning', 'degree', 'student'] },
  { name: 'grape', icon: Grape, tags: ['fruit', 'wine', 'food', 'vine', 'berry'] },
  { name: 'hand-metal', icon: HandMetal, tags: ['rock', 'gesture', 'cool', 'music', 'metal'] },
  { name: 'hash', icon: Hash, tags: ['hashtag', 'number', 'tag', 'channel', 'category', 'social'] },
  { name: 'heart-pulse', icon: HeartPulse, tags: ['health', 'medical', 'heartbeat', 'fitness', 'vital', 'wellness'] },
  { name: 'hexagon', icon: Hexagon, tags: ['shape', 'geometry', 'polygon', 'structure', 'cell'] },
  { name: 'hospital', icon: Hospital, tags: ['health', 'medical', 'clinic', 'care', 'emergency', 'doctor'] },
  { name: 'hotel', icon: Hotel, tags: ['accommodation', 'travel', 'booking', 'room', 'stay', 'hospitality'] },
  { name: 'hourglass', icon: Hourglass, tags: ['time', 'wait', 'loading', 'patience', 'deadline', 'countdown'] },
  { name: 'ice-cream', icon: IceCreamCone, tags: ['dessert', 'food', 'sweet', 'treat', 'summer'] },
  { name: 'infinity', icon: Infinity, tags: ['loop', 'endless', 'forever', 'unlimited', 'math', 'devops'] },
  { name: 'joystick', icon: Joystick, tags: ['game', 'gaming', 'controller', 'play', 'arcade'] },
  { name: 'kanban', icon: Kanban, tags: ['board', 'task', 'project', 'agile', 'workflow', 'management'] },
  { name: 'landmark', icon: Landmark, tags: ['bank', 'government', 'building', 'institution', 'monument'] },
  { name: 'languages', icon: Languages, tags: ['translate', 'i18n', 'multilingual', 'localization', 'global'] },
  { name: 'leaf', icon: Leaf, tags: ['nature', 'eco', 'green', 'plant', 'organic', 'environment', 'sustainable'] },
  { name: 'library', icon: Library, tags: ['books', 'reading', 'education', 'knowledge', 'reference', 'collection'] },
  { name: 'life-buoy', icon: LifeBuoy, tags: ['help', 'support', 'rescue', 'safety', 'emergency', 'assistance'] },
  { name: 'linkedin', icon: Linkedin, tags: ['social', 'professional', 'network', 'career', 'business'] },
  { name: 'magnet', icon: Magnet, tags: ['attract', 'pull', 'force', 'magnetic', 'retention'] },
  { name: 'mail-open', icon: MailOpen, tags: ['email', 'read', 'notification', 'message', 'opened'] },
  { name: 'map-pinned', icon: MapPinned, tags: ['location', 'saved', 'marked', 'place', 'destination'] },
  { name: 'medal', icon: Medal, tags: ['achievement', 'award', 'prize', 'winner', 'recognition', 'sport'] },
  { name: 'message-circle', icon: MessageCircle, tags: ['chat', 'comment', 'conversation', 'bubble', 'talk', 'dm'] },
  { name: 'microscope', icon: Microscope, tags: ['science', 'research', 'lab', 'analyze', 'study', 'detail'] },
  { name: 'milestone', icon: Milestone, tags: ['progress', 'goal', 'checkpoint', 'achievement', 'roadmap'] },
  { name: 'newspaper', icon: Newspaper, tags: ['news', 'article', 'blog', 'press', 'media', 'content', 'journalism'] },
  { name: 'nut', icon: Nut, tags: ['hardware', 'bolt', 'tool', 'mechanic', 'fix'] },
  { name: 'orbit', icon: Orbit, tags: ['space', 'planet', 'rotation', 'satellite', 'cycle'] },
  { name: 'paint-bucket', icon: PaintBucket, tags: ['color', 'fill', 'design', 'art', 'style', 'theme'] },
  { name: 'palm-tree', icon: Palmtree, tags: ['tropical', 'vacation', 'beach', 'summer', 'travel', 'holiday'] },
  { name: 'panel-left', icon: PanelLeft, tags: ['sidebar', 'layout', 'panel', 'ui', 'dashboard'] },
  { name: 'parentheses', icon: Parentheses, tags: ['code', 'math', 'brackets', 'group', 'expression'] },
  { name: 'paw-print', icon: PawPrint, tags: ['pet', 'animal', 'dog', 'cat', 'veterinary', 'track'] },
  { name: 'pen', icon: Pen, tags: ['write', 'signature', 'draw', 'note', 'compose', 'author'] },
  { name: 'person-standing', icon: PersonStanding, tags: ['person', 'human', 'body', 'standing', 'people'] },
  { name: 'piano', icon: Piano, tags: ['music', 'instrument', 'keyboard', 'play', 'compose'] },
  { name: 'pizza', icon: Pizza, tags: ['food', 'restaurant', 'delivery', 'meal', 'fast food'] },
  { name: 'popcorn', icon: Popcorn, tags: ['movie', 'cinema', 'snack', 'entertainment', 'theater'] },
  { name: 'presentation', icon: Presentation, tags: ['slides', 'meeting', 'talk', 'pitch', 'powerpoint', 'demo'] },
  { name: 'receipt', icon: Receipt, tags: ['payment', 'invoice', 'bill', 'purchase', 'transaction', 'order'] },
  { name: 'recycle', icon: Recycle, tags: ['eco', 'green', 'environment', 'reuse', 'sustainable', 'reduce'] },
  { name: 'regex', icon: Regex, tags: ['code', 'pattern', 'search', 'expression', 'programming', 'match'] },
  { name: 'route', icon: Route, tags: ['path', 'direction', 'navigation', 'map', 'journey', 'gps'] },
  { name: 'sailboat', icon: Sailboat, tags: ['boat', 'ship', 'sea', 'ocean', 'travel', 'sailing'] },
  { name: 'satellite', icon: Satellite, tags: ['space', 'signal', 'gps', 'communication', 'orbit', 'network'] },
  { name: 'school', icon: School, tags: ['education', 'learning', 'student', 'class', 'teaching', 'academy'] },
  { name: 'scroll-text', icon: ScrollText, tags: ['document', 'terms', 'legal', 'contract', 'policy', 'tos'] },
  { name: 'ship', icon: Ship, tags: ['boat', 'vessel', 'sea', 'transport', 'cruise', 'marine'] },
  { name: 'shirt', icon: Shirt, tags: ['clothing', 'fashion', 'wear', 'apparel', 'textile', 'tshirt'] },
  { name: 'skull', icon: Skull, tags: ['danger', 'death', 'poison', 'pirate', 'halloween', 'warning'] },
  { name: 'sofa', icon: Sofa, tags: ['furniture', 'living', 'room', 'comfort', 'home', 'interior'] },
  { name: 'sparkles', icon: Sparkles, tags: ['ai', 'magic', 'new', 'feature', 'premium', 'special', 'highlight'] },
  { name: 'sprout', icon: Sprout, tags: ['growth', 'plant', 'seed', 'nature', 'new', 'startup', 'begin'] },
  { name: 'stamp', icon: Stamp, tags: ['approve', 'certified', 'official', 'mail', 'mark'] },
  { name: 'stethoscope', icon: Stethoscope, tags: ['medical', 'doctor', 'health', 'hospital', 'diagnosis'] },
  { name: 'store', icon: Store, tags: ['shop', 'ecommerce', 'market', 'retail', 'business', 'storefront'] },
  { name: 'sun-medium', icon: SunMedium, tags: ['light', 'bright', 'day', 'weather', 'theme'] },
  { name: 'swords', icon: Swords, tags: ['battle', 'conflict', 'fight', 'game', 'competition', 'versus'] },
  { name: 'syringe', icon: Syringe, tags: ['medical', 'injection', 'vaccine', 'health', 'drug'] },
  { name: 'telescope', icon: Telescope, tags: ['space', 'astronomy', 'explore', 'discover', 'vision', 'research'] },
  { name: 'tent', icon: Tent, tags: ['camping', 'outdoor', 'adventure', 'nature', 'travel', 'event'] },
  { name: 'test-tube', icon: TestTube, tags: ['science', 'lab', 'experiment', 'testing', 'research', 'chemistry'] },
  { name: 'ticket', icon: Ticket, tags: ['event', 'pass', 'entry', 'cinema', 'concert', 'booking', 'support'] },
  { name: 'tornado', icon: Tornado, tags: ['weather', 'storm', 'disaster', 'wind', 'spin'] },
  { name: 'tractor', icon: Tractor, tags: ['farm', 'agriculture', 'vehicle', 'rural', 'field'] },
  { name: 'train', icon: Train, tags: ['transport', 'travel', 'railway', 'commute', 'metro', 'subway'] },
  { name: 'tree-pine', icon: TreePine, tags: ['nature', 'forest', 'tree', 'christmas', 'outdoor', 'environment'] },
  { name: 'unplug', icon: Unplug, tags: ['disconnect', 'offline', 'detach', 'unlink', 'remove'] },
  { name: 'utensils', icon: UtensilsCrossed, tags: ['food', 'restaurant', 'dining', 'cooking', 'kitchen', 'meal'] },
  { name: 'vegan', icon: Vegan, tags: ['plant', 'food', 'organic', 'healthy', 'diet', 'green'] },
  { name: 'volleyball', icon: Volleyball, tags: ['sport', 'game', 'ball', 'team', 'fitness', 'recreation'] },
  { name: 'vote', icon: Vote, tags: ['poll', 'election', 'ballot', 'decide', 'democracy', 'survey'] },
  { name: 'warehouse', icon: Warehouse, tags: ['storage', 'inventory', 'logistics', 'factory', 'stock'] },
  { name: 'waves', icon: Waves, tags: ['water', 'ocean', 'sea', 'sound', 'audio', 'signal'] },
  { name: 'webhook', icon: Webhook, tags: ['api', 'integration', 'callback', 'automation', 'trigger', 'event'] },
  { name: 'wheat', icon: Wheat, tags: ['agriculture', 'farm', 'grain', 'food', 'harvest', 'crop'] },
  { name: 'wine', icon: Wine, tags: ['drink', 'beverage', 'alcohol', 'celebration', 'glass', 'dining'] },
  { name: 'workflow', icon: Workflow, tags: ['process', 'automation', 'pipeline', 'flow', 'diagram', 'steps'] },
  { name: 'worm', icon: Worm, tags: ['bug', 'nature', 'garden', 'soil', 'insect'] },
]

function matchesIconSearch(entry: { name: string; tags: string[] }, query: string): boolean {
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter(Boolean)
  return words.every(
    (word) =>
      entry.name.includes(word) ||
      entry.tags.some((tag) => tag.includes(word))
  )
}

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
                        .filter((entry) =>
                          iconSearch ? matchesIconSearch(entry, iconSearch) : true
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
                    {iconSearch && featureIcons.filter((entry) =>
                      matchesIconSearch(entry, iconSearch)
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
