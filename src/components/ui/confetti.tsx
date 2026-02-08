'use client'

import { useEffect, useRef } from 'react'

interface ConfettiProps {
  active: boolean
  originX?: number
  originY?: number
  onComplete?: () => void
}

export function Confetti({ active, originX, originY, onComplete }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!active || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const cx = originX ?? canvas.width / 2
    const cy = originY ?? canvas.height / 2

    const colors = [
      '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
      '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
    ]

    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      w: number
      h: number
      color: string
      rotation: number
      rotationSpeed: number
      opacity: number
    }

    const particles: Particle[] = []
    const count = 120

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 12 + 4
      particles.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        opacity: 1,
      })
    }

    let animationId: number
    let cancelled = false
    const gravity = 0.25
    const startTime = Date.now()
    const duration = 2500

    const animate = () => {
      if (cancelled) return
      const elapsed = Date.now() - startTime
      if (elapsed > duration) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        onCompleteRef.current?.()
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        p.vy += gravity
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotationSpeed
        p.vx *= 0.99
        p.opacity = Math.max(0, 1 - elapsed / duration)

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      cancelled = true
      cancelAnimationFrame(animationId)
    }
  // Only re-run when active flips to true or origin changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, originX, originY])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
    />
  )
}
