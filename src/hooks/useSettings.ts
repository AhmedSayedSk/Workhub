'use client'

import { useState, useEffect, useCallback } from 'react'
import { appSettings, audit } from '@/lib/firestore'
import { AppSettings, AppSettingsInput, GeminiModel, ImageGenModel } from '@/types'
import { hashPasskey } from '@/lib/passkey'
import { useAuth } from './useAuth'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const loadSettings = useCallback(async () => {
    if (!user) {
      setSettings(null)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const data = await appSettings.getOrCreate()
      setSettings(data)
    } catch (err) {
      console.error('Error loading settings:', err)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const updateSettings = useCallback(async (updates: Partial<AppSettingsInput>) => {
    try {
      setSaving(true)
      setError(null)
      await appSettings.update(updates)
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              ...updates,
            }
          : null
      )
    } catch (err) {
      console.error('Error updating settings:', err)
      setError('Failed to save settings')
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  const setAIModel = useCallback(
    async (model: GeminiModel) => {
      await updateSettings({ aiModel: model })
      audit({ type: 'settings', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', details: { field: 'aiModel', value: model } })
    },
    [updateSettings, user]
  )

  const setAIEnabled = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ aiEnabled: enabled })
      audit({ type: 'settings', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', details: { field: 'aiEnabled', value: enabled } })
    },
    [updateSettings, user]
  )

  const setThinkingTimePercent = useCallback(
    async (percent: number) => {
      await updateSettings({ thinkingTimePercent: percent })
    },
    [updateSettings]
  )

  const setVaultPasskey = useCallback(
    async (passkey: string) => {
      const hashed = await hashPasskey(passkey)
      await updateSettings({ vaultPasskey: hashed })
      audit({ type: 'settings', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', details: { field: 'vaultPasskey', value: 'set' } })
    },
    [updateSettings, user]
  )

  const removeVaultPasskey = useCallback(async () => {
    await updateSettings({ vaultPasskey: null })
    audit({ type: 'settings', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', details: { field: 'vaultPasskey', value: 'removed' } })
  }, [updateSettings, user])

  const setNotifyTimerReminder = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ notifyTimerReminder: enabled })
    },
    [updateSettings]
  )

  const setTimerReminderMinutes = useCallback(
    async (minutes: number) => {
      await updateSettings({ timerReminderMinutes: minutes })
    },
    [updateSettings]
  )

  const setNotifyDeadlineAlerts = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ notifyDeadlineAlerts: enabled })
    },
    [updateSettings]
  )

  const setDeadlineAlertDays = useCallback(
    async (days: number) => {
      await updateSettings({ deadlineAlertDays: days })
    },
    [updateSettings]
  )

  const setNotifyPaymentReminders = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ notifyPaymentReminders: enabled })
    },
    [updateSettings]
  )

  const setNotifyDailySummary = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ notifyDailySummary: enabled })
    },
    [updateSettings]
  )

  const setDailySummaryHour = useCallback(
    async (hour: number) => {
      await updateSettings({ dailySummaryHour: hour })
    },
    [updateSettings]
  )

  const setNotifyIdleReminder = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ notifyIdleReminder: enabled })
    },
    [updateSettings]
  )

  const setIdleReminderMinutes = useCallback(
    async (minutes: number) => {
      await updateSettings({ idleReminderMinutes: minutes })
    },
    [updateSettings]
  )

  const setNotifyTaskDue = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ notifyTaskDue: enabled })
    },
    [updateSettings]
  )

  const setTaskDueHoursBefore = useCallback(
    async (hours: number) => {
      await updateSettings({ taskDueHoursBefore: hours })
    },
    [updateSettings]
  )

  const setNotifyBreakReminder = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ notifyBreakReminder: enabled })
    },
    [updateSettings]
  )

  const setBreakReminderMinutes = useCallback(
    async (minutes: number) => {
      await updateSettings({ breakReminderMinutes: minutes })
    },
    [updateSettings]
  )

  const setNotifyCalendarEvents = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ notifyCalendarEvents: enabled })
    },
    [updateSettings]
  )

  const setCalendarEventHoursBefore = useCallback(
    async (hours: number) => {
      await updateSettings({ calendarEventHoursBefore: hours })
    },
    [updateSettings]
  )

  return {
    settings,
    loading,
    saving,
    error,
    updateSettings,
    setAIModel,
    setAIEnabled,
    setThinkingTimePercent,
    setVaultPasskey,
    removeVaultPasskey,
    setNotifyTimerReminder,
    setTimerReminderMinutes,
    setNotifyDeadlineAlerts,
    setDeadlineAlertDays,
    setNotifyPaymentReminders,
    setNotifyDailySummary,
    setDailySummaryHour,
    setNotifyIdleReminder,
    setIdleReminderMinutes,
    setNotifyTaskDue,
    setTaskDueHoursBefore,
    setNotifyBreakReminder,
    setBreakReminderMinutes,
    setNotifyCalendarEvents,
    setCalendarEventHoursBefore,
    setImageGenApiToken: useCallback(
      async (token: string | null) => { await updateSettings({ imageGenApiToken: token }) },
      [updateSettings]
    ),
    setImageGenModel: useCallback(
      async (model: ImageGenModel) => { await updateSettings({ imageGenModel: model }) },
      [updateSettings]
    ),
    setImageGenEnabled: useCallback(
      async (enabled: boolean) => { await updateSettings({ imageGenEnabled: enabled }) },
      [updateSettings]
    ),
    setImageGenStandingPrompt: useCallback(
      async (prompt: string | null) => { await updateSettings({ imageGenStandingPrompt: prompt }) },
      [updateSettings]
    ),
    refreshSettings: loadSettings,
  }
}
