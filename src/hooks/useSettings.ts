'use client'

import { useState, useEffect, useCallback } from 'react'
import { appSettings } from '@/lib/firestore'
import { AppSettings, AppSettingsInput, GeminiModel, ImageGenModel } from '@/types'
import { hashPasskey } from '@/lib/passkey'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
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
  }, [])

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
    },
    [updateSettings]
  )

  const setAIEnabled = useCallback(
    async (enabled: boolean) => {
      await updateSettings({ aiEnabled: enabled })
    },
    [updateSettings]
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
    },
    [updateSettings]
  )

  const removeVaultPasskey = useCallback(async () => {
    await updateSettings({ vaultPasskey: null })
  }, [updateSettings])

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
