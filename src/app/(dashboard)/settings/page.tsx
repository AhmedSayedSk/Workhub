'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
} from 'lucide-react'

export default function SettingsPage() {
  const { theme, setTheme } = useThemeContext()
  const { user, signOut, updateUserProfile } = useAuth()
  const { settings, loading, saving, setAIModel, setAIEnabled } = useSettings()

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePhoto, setProfilePhoto] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || '')
      setProfilePhoto(user.photoURL || '')
    }
  }, [user])

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
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
                      <AvatarImage src={profilePhoto} alt={profileName} />
                      <AvatarFallback className="text-lg bg-primary/10">
                        {getInitials(profileName || user?.displayName || null)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Label>Avatar URL</Label>
                      <Input
                        placeholder="https://example.com/avatar.jpg"
                        value={profilePhoto}
                        onChange={(e) => setProfilePhoto(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter a URL for your profile picture
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
                      <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || ''} />
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
