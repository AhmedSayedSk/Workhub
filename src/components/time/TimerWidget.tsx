'use client'

import { useEffect, useState } from 'react'
import { useTimerStore } from '@/store/timerStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatTimerDisplay } from '@/lib/utils'
import { Play, Pause, Square, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeEntries } from '@/lib/firestore'
import { useToast } from '@/hooks/useToast'

export function TimerWidget() {
  const {
    isRunning,
    isPaused,
    currentTaskName,
    currentProjectName,
    currentSubtaskId,
    currentTaskId,
    currentProjectId,
    pauseTimer,
    resumeTimer,
    stopTimer,
    getElapsedTime,
  } = useTimerStore()

  const [elapsed, setElapsed] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsed(getElapsedTime())
      }, 1000)
    } else if (isPaused) {
      setElapsed(getElapsedTime())
    }

    return () => clearInterval(interval)
  }, [isRunning, isPaused, getElapsedTime])

  const handleStop = async () => {
    const { subtaskId, taskId, projectId, duration } = stopTimer()

    if (subtaskId && taskId && projectId && duration > 0) {
      try {
        await timeEntries.create({
          subtaskId,
          taskId,
          projectId,
          startTime: new Date(Date.now() - duration * 60000),
          endTime: new Date(),
          duration,
          notes: '',
          isManual: false,
        })

        toast({
          title: 'Time logged',
          description: `${duration} minutes recorded`,
          variant: 'success',
        })
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to save time entry',
          variant: 'destructive',
        })
      }
    }

    setElapsed(0)
  }

  if (!isRunning && !isPaused) {
    return null
  }

  return (
    <Card className={cn(
      'fixed bottom-6 right-6 p-4 shadow-lg z-50 w-80',
      'bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80'
    )}>
      <div className="space-y-3">
        {/* Timer Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-3 h-3 rounded-full',
              isPaused ? 'bg-amber-500 dark:bg-amber-400' : 'bg-green-600 dark:bg-green-400 timer-pulse'
            )} />
            <span className="text-2xl font-mono font-bold">
              {formatTimerDisplay(elapsed)}
            </span>
          </div>
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Task Info */}
        <div className="space-y-1">
          <p className="text-sm font-medium truncate">{currentTaskName}</p>
          <p className="text-xs text-muted-foreground truncate">{currentProjectName}</p>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {isPaused ? (
            <Button
              onClick={resumeTimer}
              className="flex-1"
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          ) : (
            <Button
              onClick={pauseTimer}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          <Button
            onClick={handleStop}
            variant="destructive"
            size="sm"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
