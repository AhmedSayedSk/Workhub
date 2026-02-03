'use client'

import * as React from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface CalendarProps {
  selected?: Date | null
  onSelect?: (date: Date) => void
  className?: string
}

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const days: Date[] = []
  let day = startDate
  while (day <= endDate) {
    days.push(day)
    day = addDays(day, 1)
  }

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const handleSelectDate = (date: Date) => {
    onSelect?.(date)
  }

  return (
    <div className={cn('p-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((weekDay) => (
          <div
            key={weekDay}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {weekDay}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((dayItem, index) => {
          const isCurrentMonth = isSameMonth(dayItem, currentMonth)
          const isSelected = selected && isSameDay(dayItem, selected)
          const isTodayDate = isToday(dayItem)

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectDate(dayItem)}
              className={cn(
                'h-9 w-9 rounded-md text-sm font-normal transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                !isCurrentMonth && 'text-muted-foreground/40',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                isTodayDate && !isSelected && 'bg-accent text-accent-foreground font-semibold',
              )}
            >
              {format(dayItem, 'd')}
            </button>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => {
            const today = new Date()
            setCurrentMonth(today)
            onSelect?.(today)
          }}
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-xs text-muted-foreground"
          onClick={() => onSelect?.(undefined as unknown as Date)}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
