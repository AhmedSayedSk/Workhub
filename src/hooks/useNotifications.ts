'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSettings } from './useSettings'
import { useTimerStore } from '@/store/timerStore'
import { projects, monthlyPayments } from '@/lib/firestore'
import { sendBrowserNotification, getNotificationPermission } from '@/lib/notifications'
import { toast } from './useToast'

const CHECK_INTERVAL_MS = 60_000 // 1 minute

export function useNotifications() {
  const { settings } = useSettings()
  const timerReminderFired = useRef(false)
  const notifiedDeadlines = useRef(new Set<string>())
  const notifiedPayments = useRef(new Set<string>())
  const prevTimerStartTime = useRef<number | null>(null)

  const notify = useCallback((title: string, body: string, tag: string) => {
    toast({ title, description: body })
    sendBrowserNotification(title, { body, tag })
  }, [])

  const checkTimerReminder = useCallback(() => {
    if (!settings?.notifyTimerReminder) return

    const state = useTimerStore.getState()

    // Reset flag when timer restarts
    if (state.startTime !== prevTimerStartTime.current) {
      timerReminderFired.current = false
      prevTimerStartTime.current = state.startTime
    }

    if (!state.isRunning || timerReminderFired.current) return

    const elapsed = state.getElapsedTime()
    const thresholdMs = (settings.timerReminderMinutes ?? 120) * 60_000

    if (elapsed >= thresholdMs) {
      timerReminderFired.current = true
      const mins = Math.round(elapsed / 60_000)
      const taskLabel = state.currentTaskName
        ? `on "${state.currentTaskName}"`
        : ''
      notify(
        'Timer Running',
        `Your timer has been running for ${mins} minutes ${taskLabel}. Consider taking a break or stopping.`,
        'timer-reminder'
      )
    }
  }, [settings, notify])

  const checkDeadlineAlerts = useCallback(async () => {
    if (!settings?.notifyDeadlineAlerts) return

    try {
      const activeProjects = await projects.getByStatus('active')
      const now = new Date()
      const alertDays = settings.deadlineAlertDays ?? 3

      for (const project of activeProjects) {
        if (!project.deadline || notifiedDeadlines.current.has(project.id)) continue

        const deadlineDate = project.deadline.toDate()
        const daysUntil = Math.ceil(
          (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysUntil <= alertDays && daysUntil >= 0) {
          notifiedDeadlines.current.add(project.id)
          const label = daysUntil === 0
            ? 'today'
            : daysUntil === 1
              ? 'tomorrow'
              : `in ${daysUntil} days`
          notify(
            'Deadline Approaching',
            `"${project.name}" deadline is ${label}.`,
            `deadline-${project.id}`
          )
        }
      }
    } catch (err) {
      console.error('Deadline check failed:', err)
    }
  }, [settings, notify])

  const checkPaymentReminders = useCallback(async () => {
    if (!settings?.notifyPaymentReminders) return

    try {
      const payments = await monthlyPayments.getAll()
      const pending = payments.filter((p) => p.status === 'pending')

      for (const payment of pending) {
        if (notifiedPayments.current.has(payment.id)) continue
        notifiedPayments.current.add(payment.id)
        notify(
          'Payment Pending',
          `Payment of ${payment.amount} for ${payment.month} is still pending.`,
          `payment-${payment.id}`
        )
      }
    } catch (err) {
      console.error('Payment check failed:', err)
    }
  }, [settings, notify])

  useEffect(() => {
    if (!settings) return
    if (getNotificationPermission() === 'unsupported') return

    // Run initial checks
    checkTimerReminder()
    checkDeadlineAlerts()
    checkPaymentReminders()

    const interval = setInterval(() => {
      checkTimerReminder()
      checkDeadlineAlerts()
      checkPaymentReminders()
    }, CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [settings, checkTimerReminder, checkDeadlineAlerts, checkPaymentReminders])
}
