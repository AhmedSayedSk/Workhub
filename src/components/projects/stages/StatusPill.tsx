'use client'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  tone: 'neutral' | 'info' | 'warn' | 'success' | 'danger'
  className?: string
}

const TONE: Record<Props['tone'], string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  warn: 'bg-amber-100 text-amber-800 border-amber-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  danger: 'bg-rose-100 text-rose-700 border-rose-200',
}

export function StatusPill({ label, tone, className }: Props) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', TONE[tone], className)}>
      {label}
    </span>
  )
}
