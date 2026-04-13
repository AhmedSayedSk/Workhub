'use client'

import { useState, useEffect, useCallback } from 'react'
import { calendarEvents, audit } from '@/lib/firestore'
import { useAuth } from './useAuth'
import { CalendarEvent, CalendarEventInput, CalendarEventStatus, CalendarCategory } from '@/types'
import { toast } from 'react-toastify'

export function useCalendarEvents() {
  const { user } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      const result = await calendarEvents.getAll()
      setEvents(result)
    } catch (err) {
      console.error('Failed to load calendar events:', err)
      toast.error('Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const createEvent = useCallback(async (data: CalendarEventInput) => {
    try {
      await calendarEvents.create(data)
      await fetchEvents()
      toast.success('Event created')
      audit({ type: 'calendar', action: 'created', actorUid: user?.uid || null, actorEmail: user?.email || '', targetName: data.title })
    } catch (err) {
      console.error('Failed to create event:', err)
      toast.error('Failed to create event')
    }
  }, [fetchEvents, user])

  const updateEvent = useCallback(async (id: string, data: Partial<CalendarEventInput>) => {
    try {
      await calendarEvents.update(id, data)
      await fetchEvents()
      toast.success('Event updated')
      audit({ type: 'calendar', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', targetId: id, targetName: data.title })
    } catch {
      toast.error('Failed to update event')
    }
  }, [fetchEvents, user])

  const deleteEvent = useCallback(async (id: string) => {
    try {
      const event = events.find(e => e.id === id)
      await calendarEvents.delete(id)
      setEvents(prev => prev.filter(e => e.id !== id))
      toast.success('Event deleted')
      audit({ type: 'calendar', action: 'deleted', actorUid: user?.uid || null, actorEmail: user?.email || '', targetId: id, targetName: event?.title })
    } catch {
      toast.error('Failed to delete event')
    }
  }, [events, user])

  const updateEventStatus = useCallback(async (id: string, status: CalendarEventStatus) => {
    try {
      await calendarEvents.update(id, { status })
      const existing = events.find((e) => e.id === id)
      audit({ type: 'calendar', action: 'status_changed', actorUid: user?.uid || null, actorEmail: user?.email || '', targetId: id, targetName: existing?.title, details: { status } })
      await fetchEvents()
    } catch {
      toast.error('Failed to update status')
    }
  }, [fetchEvents, events, user])

  return {
    events,
    loading,
    createEvent,
    updateEvent,
    deleteEvent,
    updateEventStatus,
    refetch: fetchEvents,
  }
}
