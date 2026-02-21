'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, CachedAvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useThemeContext } from '@/components/layout/ThemeProvider'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { GEMINI_MODELS } from '@/lib/gemini'
import { GeminiModel } from '@/types'
import {
  Moon,
  Sun,
  Monitor,
  LogOut,
  User,
  Bell,
  Database,
  Sparkles,
  Keyboard,
  Loader2,
  CheckCircle2,
  Camera,
  Image as ImageIcon,
  Trash2,
  Clock,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react'
import { clearImageCache, getImageCacheInfo } from '@/lib/image-cache'
import { verifyPasskey } from '@/lib/passkey'

export default function SettingsPage() {
  const { theme, setTheme } = useThemeContext()
  const { user, signOut, updateUserProfile } = useAuth()
  const { settings, loading, saving, setAIModel, setAIEnabled, setThinkingTimePercent, setVaultPasskey, removeVaultPasskey } = useSettings()

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePhoto, setProfilePhoto] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [cacheCount, setCacheCount] = useState(0)
  const [clearingCache, setClearingCache] = useState(false)
  const [thinkingTimeLocal, setThinkingTimeLocal] = useState(0)
  const thinkingTimeTimer = useRef<NodeJS.Timeout | null>(null)

  // Passkey state
  const [passkeyForm, setPasskeyForm] = useState({ current: '', new: '', confirm: '' })
  const [passkeyError, setPasskeyError] = useState('')
  const [savingPasskey, setSavingPasskey] = useState(false)
  const [passkeySuccess, setPasskeySuccess] = useState('')
  const [showPasskeyFields, setShowPasskeyFields] = useState({ current: false, new: false, confirm: false })

  const refreshCacheInfo = useCallback(async () => {
    const info = await getImageCacheInfo()
    setCacheCount(info.count)
  }, [])

  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || '')
      setProfilePhoto(user.photoURL || '')
    }
  }, [user])

  useEffect(() => {
    refreshCacheInfo()
  }, [refreshCacheInfo])

  useEffect(() => {
    if (settings) {
      setThinkingTimeLocal(settings.thinkingTimePercent ?? 0)
    }
  }, [settings])

  const handleEditProfile = () => {
    setProfileName(user?.displayName || '')
    setProfilePhoto(user?.photoURL || '')
    setIsEditingProfile(true)
  }

  const handleCancelEdit = () => {
    setIsEditingProfile(false)
    setProfileName(user?.displayName || '')
    setProfilePhoto(user?.photoURL || '')
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await updateUserProfile({
        displayName: profileName || undefined,
        photoURL: profilePhoto || undefined,
      })
      setIsEditingProfile(false)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setSavingProfile(false)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Generate Gravatar URL from email using MD5 hash
  const generateGravatarUrl = async () => {
    if (!user?.email) return
    const email = user.email.trim().toLowerCase()
    // Use SubtleCrypto to generate MD5-like hash (actually SHA-256, but Gravatar accepts it)
    const msgBuffer = new TextEncoder().encode(email)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    setProfilePhoto(`https://www.gravatar.com/avatar/${hashHex}?d=identicon&s=200`)
  }

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      await clearImageCache()
      setCacheCount(0)
    } finally {
      setClearingCache(false)
    }
  }

  const hasPasskey = !!settings?.vaultPasskey

  const handleSetPasskey = async () => {
    setPasskeyError('')
    setPasskeySuccess('')

    if (hasPasskey) {
      // Changing passkey — verify current first
      if (!passkeyForm.current) {
        setPasskeyError('Current passkey is required')
        return
      }
      const valid = await verifyPasskey(passkeyForm.current, settings!.vaultPasskey!)
      if (!valid) {
        setPasskeyError('Current passkey is incorrect')
        return
      }
    }

    if (passkeyForm.new.length < 4) {
      setPasskeyError('Passkey must be at least 4 characters')
      return
    }
    if (passkeyForm.new !== passkeyForm.confirm) {
      setPasskeyError('Passkeys do not match')
      return
    }

    setSavingPasskey(true)
    try {
      await setVaultPasskey(passkeyForm.new)
      setPasskeyForm({ current: '', new: '', confirm: '' })
      setPasskeySuccess(hasPasskey ? 'Passkey changed successfully' : 'Passkey set successfully')
      setTimeout(() => setPasskeySuccess(''), 3000)
    } catch {
      setPasskeyError('Failed to save passkey')
    } finally {
      setSavingPasskey(false)
    }
  }

  const handleRemovePasskey = async () => {
    setPasskeyError('')
    setPasskeySuccess('')

    if (!passkeyForm.current) {
      setPasskeyError('Enter your current passkey to remove it')
      return
    }
    const valid = await verifyPasskey(passkeyForm.current, settings!.vaultPasskey!)
    if (!valid) {
      setPasskeyError('Current passkey is incorrect')
      return
    }

    setSavingPasskey(true)
    try {
      await removeVaultPasskey()
      setPasskeyForm({ current: '', new: '', confirm: '' })
      setPasskeySuccess('Passkey removed successfully')
      setTimeout(() => setPasskeySuccess(''), 3000)
    } catch {
      setPasskeyError('Failed to remove passkey')
    } finally {
      setSavingPasskey(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="time" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Time Tracking</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile
                  </CardTitle>
                  <CardDescription>Your profile information</CardDescription>
                </div>
                {!isEditingProfile && (
                  <Button variant="outline" size="sm" onClick={handleEditProfile}>
                    Edit Profile
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditingProfile ? (
                <>
                  {/* Edit Mode */}
                  {/* Avatar */}
                  <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20">
                      <CachedAvatarImage src={profilePhoto} alt={profileName} />
                      <AvatarFallback className="text-lg bg-primary/10">
                        {getInitials(profileName || user?.displayName || null)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Label>Avatar URL</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://example.com/avatar.jpg"
                          value={profilePhoto}
                          onChange={(e) => setProfilePhoto(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateGravatarUrl}
                          className="whitespace-nowrap"
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          Gravatar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enter a URL or click Gravatar to use your email avatar
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Name */}
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="Your name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium py-2">{user?.email}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                    >
                      {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={savingProfile}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* View Mode */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <CachedAvatarImage src={user?.photoURL || ''} alt={user?.displayName || ''} />
                      <AvatarFallback className="text-lg bg-primary/10">
                        {getInitials(user?.displayName || null)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-lg">{user?.displayName || 'No name set'}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Sign Out Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <LogOut className="h-5 w-5" />
                Sign Out
              </CardTitle>
              <CardDescription>Sign out of your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => signOut()}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data
              </CardTitle>
              <CardDescription>Manage your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Export Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Download all your data as JSON
                  </p>
                </div>
                <Button variant="outline">Export</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Image Cache
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {cacheCount} cached {cacheCount === 1 ? 'image' : 'images'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleClearCache}
                  disabled={clearingCache || cacheCount === 0}
                >
                  {clearingCache ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Select your preferred theme
                  </p>
                </div>
                <Select
                  value={theme}
                  onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </CardTitle>
              <CardDescription>Quick actions for power users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Open AI Assistant</span>
                  <kbd className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    Ctrl + K
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Quick Search</span>
                  <kbd className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    Ctrl + /
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">New Project</span>
                  <kbd className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    Ctrl + N
                  </kbd>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Vault Passkey
                {savingPasskey && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {hasPasskey
                  ? 'A passkey is set. Sensitive vault entries require verification before viewing.'
                  : 'Set a passkey to protect sensitive vault entries (passwords, API keys). You will be asked for it before revealing or copying protected data.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {hasPasskey && (
                    <div className="space-y-2">
                      <Label>Current Passkey</Label>
                      <div className="relative">
                        <Input
                          type={showPasskeyFields.current ? 'text' : 'password'}
                          placeholder="Enter current passkey"
                          value={passkeyForm.current}
                          onChange={(e) => {
                            setPasskeyForm({ ...passkeyForm, current: e.target.value })
                            setPasskeyError('')
                          }}
                          disabled={savingPasskey}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setShowPasskeyFields({ ...showPasskeyFields, current: !showPasskeyFields.current })}
                        >
                          {showPasskeyFields.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>{hasPasskey ? 'New Passkey' : 'Passkey'}</Label>
                    <div className="relative">
                      <Input
                        type={showPasskeyFields.new ? 'text' : 'password'}
                        placeholder={hasPasskey ? 'Enter new passkey' : 'Enter a passkey (min 4 characters)'}
                        value={passkeyForm.new}
                        onChange={(e) => {
                          setPasskeyForm({ ...passkeyForm, new: e.target.value })
                          setPasskeyError('')
                        }}
                        disabled={savingPasskey}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPasskeyFields({ ...showPasskeyFields, new: !showPasskeyFields.new })}
                      >
                        {showPasskeyFields.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Confirm {hasPasskey ? 'New ' : ''}Passkey</Label>
                    <div className="relative">
                      <Input
                        type={showPasskeyFields.confirm ? 'text' : 'password'}
                        placeholder="Confirm passkey"
                        value={passkeyForm.confirm}
                        onChange={(e) => {
                          setPasskeyForm({ ...passkeyForm, confirm: e.target.value })
                          setPasskeyError('')
                        }}
                        disabled={savingPasskey}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPasskeyFields({ ...showPasskeyFields, confirm: !showPasskeyFields.confirm })}
                      >
                        {showPasskeyFields.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {passkeyError && (
                    <p className="text-sm text-destructive">{passkeyError}</p>
                  )}

                  {passkeySuccess && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      {passkeySuccess}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSetPasskey}
                      disabled={savingPasskey || !passkeyForm.new || !passkeyForm.confirm}
                    >
                      {savingPasskey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {hasPasskey ? 'Change Passkey' : 'Set Passkey'}
                    </Button>
                    {hasPasskey && (
                      <Button
                        variant="destructive"
                        onClick={handleRemovePasskey}
                        disabled={savingPasskey || !passkeyForm.current}
                      >
                        {savingPasskey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Remove Passkey
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Tracking Tab */}
        <TabsContent value="time" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Tracking
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!saving && settings && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </CardTitle>
              <CardDescription>
                Configure how tracked time is displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Thinking Time Bonus</Label>
                    <p className="text-sm text-muted-foreground">
                      Add extra time to account for thinking, planning, and context switching.
                      This only affects displayed values — stored durations are unchanged.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="0"
                      max="200"
                      className="w-24"
                      value={thinkingTimeLocal}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(200, parseInt(e.target.value) || 0))
                        setThinkingTimeLocal(val)
                        if (thinkingTimeTimer.current) clearTimeout(thinkingTimeTimer.current)
                        thinkingTimeTimer.current = setTimeout(() => {
                          setThinkingTimePercent(val)
                        }, 800)
                      }}
                      disabled={saving}
                    />
                    <span className="text-sm font-medium">%</span>
                  </div>
                  {thinkingTimeLocal > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <p className="text-muted-foreground">
                        Currently adds{' '}
                        <span className="font-medium text-foreground">
                          {thinkingTimeLocal}%
                        </span>{' '}
                        to all displayed time entries.
                        A 1h entry will show as{' '}
                        <span className="font-medium text-foreground">
                          {Math.round(60 * (1 + thinkingTimeLocal / 100))}m
                        </span>.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Assistant
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!saving && settings && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </CardTitle>
              <CardDescription>
                Configure AI-powered features for task breakdown, time estimation, and insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* AI Enable/Disable */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable AI Features</Label>
                      <p className="text-sm text-muted-foreground">
                        Turn on AI-powered suggestions and assistance
                      </p>
                    </div>
                    <Switch
                      checked={settings?.aiEnabled ?? true}
                      onCheckedChange={(checked) => setAIEnabled(checked)}
                      disabled={saving}
                    />
                  </div>

                  <Separator />

                  {/* Model Selection */}
                  <div className="space-y-3">
                    <div className="space-y-0.5">
                      <Label>AI Model</Label>
                      <p className="text-sm text-muted-foreground">
                        Select the Gemini model for AI features
                      </p>
                    </div>

                    <Select
                      value={settings?.aiModel || 'gemini-3-flash-preview'}
                      onValueChange={(value) => setAIModel(value as GeminiModel)}
                      disabled={saving || settings?.aiEnabled === false}
                    >
                      <SelectTrigger className="w-full h-auto py-3 px-4">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent className="p-2">
                        {GEMINI_MODELS.map((model) => {
                          const badgeColors: Record<string, string> = {
                            blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                            green: 'bg-green-500/10 text-green-600 dark:text-green-400',
                            purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                          }
                          return (
                            <SelectItem
                              key={model.value}
                              value={model.value}
                              className="py-3 px-3 rounded-md cursor-pointer"
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{model.label}</span>
                                  {model.badge && (
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full ${
                                        badgeColors[model.badgeColor || 'green']
                                      }`}
                                    >
                                      {model.badge}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground leading-relaxed">
                                  {model.description}
                                </span>
                                <span className="text-xs text-primary/70 font-medium">
                                  {model.pricing}
                                </span>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>

                    {/* Show selected model info */}
                    {settings?.aiModel && (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm">
                        <p className="text-muted-foreground">
                          Currently using:{' '}
                          <span className="font-medium text-foreground">
                            {GEMINI_MODELS.find((m) => m.value === settings.aiModel)?.label}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {settings?.aiEnabled === false && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        AI features are currently disabled. Enable them to use the AI assistant
                        for task breakdown, time estimation, and productivity insights.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* AI Usage Info */}
          <Card>
            <CardHeader>
              <CardTitle>AI Features</CardTitle>
              <CardDescription>What AI can help you with</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Task Breakdown</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically break down features into actionable tasks
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">Time Estimation</p>
                    <p className="text-sm text-muted-foreground">
                      Get intelligent time estimates based on task complexity
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium">Productivity Insights</p>
                    <p className="text-sm text-muted-foreground">
                      Analyze your work patterns and get recommendations
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configure notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Timer Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Get reminded when timer is running for too long
                  </p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Deadline Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify before project deadlines
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Payment Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Remind about pending payments
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
