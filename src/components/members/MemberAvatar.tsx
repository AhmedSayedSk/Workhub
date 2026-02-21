'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Member } from '@/types'
import { cn } from '@/lib/utils'

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
}

interface MemberAvatarProps {
  member: Member
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function MemberAvatar({ member, size = 'md', className }: MemberAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], className)} title={member.name}>
      {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
      <AvatarFallback
        className="font-medium text-white"
        style={{ backgroundColor: member.color }}
      >
        {getInitials(member.name)}
      </AvatarFallback>
    </Avatar>
  )
}
