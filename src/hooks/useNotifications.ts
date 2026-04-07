'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useSettings } from './useSettings'
import { useTimerStore } from '@/store/timerStore'
import { projects, monthlyPayments, calendarEvents } from '@/lib/firestore'
import { sendBrowserNotification, getNotificationPermission } from '@/lib/notifications'
import { toast } from './useToast'
import { ToastAction } from '@/components/ui/toast'

const CHECK_INTERVAL_MS = 60_000 // 1 minute
const DISMISSED_KEY = 'workhub_dismissed_notifications'

function getDismissedNotifications(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function dismissNotification(tag: string) {
  const dismissed = getDismissedNotifications()
  dismissed.add(tag)
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
}

function isNotificationDismissed(tag: string): boolean {
  return getDismissedNotifications().has(tag)
}

export function useNotifications() {
  const { settings } = useSettings()
  const { user } = useAuth()
  const timerReminderFired = useRef(false)
  const notifiedDeadlines = useRef(new Set<string>())
  const notifiedPayments = useRef(new Set<string>())
  const prevTimerStartTime = useRef<number | null>(null)
  const dailySummaryFired = useRef(false)
  const idleReminderFired = useRef(false)
  const breakReminderFired = useRef(false)
  const notifiedCalendarEvents = useRef(new Set<string>())
  const lastActivityTime = useRef<number>(Date.now())

  const notifyDismissable = useCallback((title: string, body: string, tag: string) => {
    if (isNotificationDismissed(tag)) return false

    toast({
      title,
      description: body,
      action: React.createElement(ToastAction, {
        altText: 'Got it',
        onClick: () => dismissNotification(tag),
      }, 'Got it') as any,
    })
    sendBrowserNotification(title, { body, tag })
    return true
  }, [])

  // Track user activity for idle detection
  useEffect(() => {
    const updateActivity = () => {
      lastActivityTime.current = Date.now()
      idleReminderFired.current = false
    }
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('click', updateActivity)
    return () => {
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('click', updateActivity)
    }
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
      notifyDismissable(
        'Timer Running',
        `Your timer has been running for ${mins} minutes ${taskLabel}. Consider taking a break or stopping.`,
        'timer-reminder'
      )
    }
  }, [settings, notifyDismissable])

  const checkDeadlineAlerts = useCallback(async () => {
    if (!settings?.notifyDeadlineAlerts) return

    try {
      const activeProjects = await projects.getByStatus('active', user?.uid)
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
          const tag = `deadline-${project.id}`
          const label = daysUntil === 0
            ? 'today'
            : daysUntil === 1
              ? 'tomorrow'
              : `in ${daysUntil} days`
          notifyDismissable(
            'Deadline Approaching',
            `"${project.name}" deadline is ${label}.`,
            tag
          )
        }
      }
    } catch (err) {
      console.error('Deadline check failed:', err)
    }
  }, [settings, user, notifyDismissable])

  const checkPaymentReminders = useCallback(async () => {
    if (!settings?.notifyPaymentReminders) return

    try {
      const payments = await monthlyPayments.getAll()
      const pending = payments.filter((p) => p.status === 'pending')

      for (const payment of pending) {
        if (notifiedPayments.current.has(payment.id)) continue
        notifiedPayments.current.add(payment.id)
        const tag = `payment-${payment.id}`
        notifyDismissable(
          'Payment Pending',
          `Payment of ${payment.amount} for ${payment.month} is still pending.`,
          tag
        )
      }
    } catch (err) {
      console.error('Payment check failed:', err)
    }
  }, [settings, notifyDismissable])

  const checkDailySummary = useCallback(() => {
    if (!settings?.notifyDailySummary) return
    if (dailySummaryFired.current) return

    const now = new Date()
    const targetHour = settings.dailySummaryHour ?? 18

    if (now.getHours() === targetHour) {
      dailySummaryFired.current = true
      const today = new Date().toISOString().slice(0, 10)
      notifyDismissable(
        'Daily Summary',
        'Time to review your daily progress. Check your time entries and plan for tomorrow.',
        `daily-summary-${today}`
      )
    }
  }, [settings, notifyDismissable])

  // Reset daily summary flag at midnight
  useEffect(() => {
    const resetAtMidnight = () => {
      const now = new Date()
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        dailySummaryFired.current = false
      }
    }
    const interval = setInterval(resetAtMidnight, 60_000)
    return () => clearInterval(interval)
  }, [])

  const checkIdleReminder = useCallback(() => {
    if (!settings?.notifyIdleReminder) return
    if (idleReminderFired.current) return

    const state = useTimerStore.getState()
    // Only remind if no timer is running
    if (state.isRunning) {
      idleReminderFired.current = false
      return
    }

    const idleMs = Date.now() - lastActivityTime.current
    const thresholdMs = (settings.idleReminderMinutes ?? 30) * 60_000

    if (idleMs >= thresholdMs) {
      idleReminderFired.current = true
      notifyDismissable(
        'No Timer Running',
        `You\'ve been active for ${Math.round(idleMs / 60_000)} minutes without a timer. Don\'t forget to track your time!`,
        'idle-reminder'
      )
    }
  }, [settings, notifyDismissable])

  const checkBreakReminder = useCallback(() => {
    if (!settings?.notifyBreakReminder) return

    const state = useTimerStore.getState()
    if (!state.isRunning || breakReminderFired.current) return

    // Reset when timer restarts
    if (state.startTime !== prevTimerStartTime.current) {
      breakReminderFired.current = false
    }

    const elapsed = state.getElapsedTime()
    const thresholdMs = (settings.breakReminderMinutes ?? 90) * 60_000

    if (elapsed >= thresholdMs) {
      breakReminderFired.current = true
      notifyDismissable(
        'Take a Break',
        `You\'ve been working for ${Math.round(elapsed / 60_000)} minutes. Consider taking a short break to stay productive.`,
        'break-reminder'
      )
    }
  }, [settings, notifyDismissable])

  const checkCalendarEventReminders = useCallback(async () => {
    if (!settings?.notifyCalendarEvents) return

    try {
      const now = new Date()
      const hoursBefore = settings.calendarEventHoursBefore ?? 1
      const lookAheadEnd = new Date(now.getTime() + hoursBefore * 3_600_000)

      const upcoming = await calendarEvents.getUpcoming(now, lookAheadEnd)

      for (const event of upcoming) {
        if (event.allDay) continue
        if (event.status === 'cancelled' || event.status === 'done') continue
        if (notifiedCalendarEvents.current.has(event.id)) continue

        notifiedCalendarEvents.current.add(event.id)

        const startTime = event.start.toDate()
        const hoursUntil = (startTime.getTime() - now.getTime()) / 3_600_000
        const timeLabel =
          hoursUntil < 0.05
            ? 'starting now'
            : hoursUntil < 1
              ? `in ${Math.round(hoursUntil * 60)} minutes`
              : hoursUntil < 2
                ? 'in 1 hour'
                : `in ${Math.round(hoursUntil)} hours`

        const tag = `calendar-event-${event.id}`
        notifyDismissable(
          'Upcoming Event',
          `"${event.title}" ${timeLabel}.`,
          tag
        )
      }
    } catch (err) {
      console.error('Calendar event reminder check failed:', err)
    }
  }, [settings, notifyDismissable])

  useEffect(() => {
    if (!settings) return
    if (getNotificationPermission() === 'unsupported') return

    // Run initial checks
    checkTimerReminder()
    checkDeadlineAlerts()
    checkPaymentReminders()
    checkDailySummary()
    checkIdleReminder()
    checkBreakReminder()
    checkCalendarEventReminders()

    const interval = setInterval(() => {
      checkTimerReminder()
      checkDeadlineAlerts()
      checkPaymentReminders()
      checkDailySummary()
      checkIdleReminder()
      checkBreakReminder()
      checkCalendarEventReminders()
    }, CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, checkTimerReminder, checkDeadlineAlerts, checkPaymentReminders, checkDailySummary, checkIdleReminder, checkBreakReminder, checkCalendarEventReminders])
}
