'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Generate years from 2020 to 2035
const years = Array.from({ length: 16 }, (_, i) => 2020 + i)

interface MonthPickerProps {
  value?: string // Format: YYYY-MM
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function MonthPicker({
  value,
  onChange,
  placeholder = 'Pick a month',
  className,
  disabled,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parse the value to get year and month
  const parsedDate = value ? new Date(value + '-01') : null
  const selectedYear = parsedDate?.getFullYear() || new Date().getFullYear()
  const selectedMonth = parsedDate?.getMonth() ?? new Date().getMonth()

  const handleMonthChange = (monthIndex: string) => {
    const newValue = `${selectedYear}-${String(parseInt(monthIndex) + 1).padStart(2, '0')}`
    onChange?.(newValue)
  }

  const handleYearChange = (year: string) => {
    const newValue = `${year}-${String(selectedMonth + 1).padStart(2, '0')}`
    onChange?.(newValue)
  }

  const displayValue = parsedDate
    ? format(parsedDate, 'MMMM yyyy')
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-between text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{displayValue}</span>
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Month</label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={month} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Year</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={handleYearChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
