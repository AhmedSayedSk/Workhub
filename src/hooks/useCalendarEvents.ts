'use client'

import { useState, useEffect, useCallback } from 'react'
import { calendarEvents } from '@/lib/firestore'
import { CalendarEvent, CalendarEventInput, CalendarEventStatus, CalendarCategory } from '@/types'
import { toast } from 'react-toastify'

export function useCalendarEvents() {
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
    } catch (err) {
      console.error('Failed to create event:', err)
      toast.error('Failed to create event')
    }
  }, [fetchEvents])

  const updateEvent = useCallback(async (id: string, data: Partial<CalendarEventInput>) => {
    try {
      await calendarEvents.update(id, data)
      await fetchEvents()
      toast.success('Event updated')
    } catch {
      toast.error('Failed to update event')
    }
  }, [fetchEvents])

  const deleteEvent = useCallback(async (id: string) => {
    try {
      await calendarEvents.delete(id)
      setEvents(prev => prev.filter(e => e.id !== id))
      toast.success('Event deleted')
    } catch {
      toast.error('Failed to delete event')
    }
  }, [])

  const updateEventStatus = useCallback(async (id: string, status: CalendarEventStatus) => {
    try {
      await calendarEvents.update(id, { status })
      await fetchEvents()
    } catch {
      toast.error('Failed to update status')
    }
  }, [fetchEvents])

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
