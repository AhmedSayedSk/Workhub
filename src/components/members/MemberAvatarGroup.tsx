'use client'

import { Member } from '@/types'
import { MemberAvatar } from './MemberAvatar'
import { cn } from '@/lib/utils'

interface MemberAvatarGroupProps {
  members: Member[]
  max?: number
  size?: 'sm' | 'md'
  className?: string
}

export function MemberAvatarGroup({ members, max = 3, size = 'sm', className }: MemberAvatarGroupProps) {
  const visible = members.slice(0, max)
  const overflow = members.length - max

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visible.map((member) => (
        <MemberAvatar
          key={member.id}
          member={member}
          size={size}
          className="ring-2 ring-background"
        />
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-muted text-muted-foreground font-medium ring-2 ring-background',
            size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-8 w-8 text-[10px]'
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
