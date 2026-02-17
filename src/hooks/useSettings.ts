'use client'

import { useState, useEffect, useCallback } from 'react'
import { appSettings } from '@/lib/firestore'
import { AppSettings, AppSettingsInput, GeminiModel } from '@/types'

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

  return {
    settings,
    loading,
    saving,
    error,
    updateSettings,
    setAIModel,
    setAIEnabled,
    setThinkingTimePercent,
    refreshSettings: loadSettings,
  }
}
