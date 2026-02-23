'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2]

interface AudioPlayerProps {
  src: string
  duration?: number
  className?: string
}

export function AudioPlayer({ src, duration: propDuration, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(propDuration || 0)
  const [speed, setSpeed] = useState(1.5)

  const formatTime = (secs: number) => {
    const s = Math.round(secs)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    const audio = new Audio(src)
    audio.playbackRate = 1.5
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    })

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime)
    })

    audio.addEventListener('ended', () => {
      setPlaying(false)
      setCurrentTime(0)
    })

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [src])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
    }
  }, [playing])

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current
    const idx = SPEED_OPTIONS.indexOf(speed)
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]
    setSpeed(next)
    if (audio) audio.playbackRate = next
  }, [speed])

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    audio.currentTime = pct * duration
    setCurrentTime(audio.currentTime)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0"
        onClick={toggle}
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </Button>

      <div
        className="flex-1 h-1 bg-muted rounded-full cursor-pointer relative min-w-[60px]"
        onClick={handleSeek}
      >
        <div
          className="absolute top-0 left-0 h-full bg-primary rounded-full transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
        {formatTime(currentTime)}/{formatTime(duration)}
      </span>

      <button
        type="button"
        onClick={cycleSpeed}
        className={cn(
          'text-[10px] font-medium px-1 py-0.5 rounded shrink-0 transition-colors',
          speed === 1
            ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
            : 'text-primary bg-primary/10 hover:bg-primary/15'
        )}
        title="Playback speed"
      >
        {speed}x
      </button>
    </div>
  )
}
