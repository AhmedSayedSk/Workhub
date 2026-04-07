'use client'

import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { FolderKanban, Clock, BarChart3, Users } from 'lucide-react'

const features = [
  { icon: FolderKanban, text: 'Manage projects with Kanban boards' },
  { icon: Clock, text: 'Track time and generate timesheets' },
  { icon: BarChart3, text: 'Invoicing and financial insights' },
  { icon: Users, text: 'Collaborate with your team seamlessly' },
]

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side — Hero / Marketing */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        {/* Background image */}
        <Image
          src="/login-bg.png"
          alt=""
          fill
          className="object-cover"
          priority
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-slate-900/75" />

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col pl-16 xl:pl-24 pr-12 py-12 xl:py-16 text-white w-full h-full">
          {/* Top — Logo */}
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="WorkHub"
              width={56}
              height={56}
              className="h-14 w-14"
            />
            <div>
              <span className="text-3xl xl:text-4xl font-bold tracking-tight">WorkHub</span>
              <span className="block text-sm text-white/50">by Sikasio</span>
            </div>
          </div>

          {/* Center — Content */}
          <div className="flex-1 flex items-center">
            <div className="max-w-lg text-left">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4">
              Your workspace,
              <br />
              <span className="text-teal-300">organized.</span>
            </h1>
            <p className="text-lg text-white/70 mb-10">
              Projects, time tracking, invoices, and team collaboration — all in one place. Built for freelancers and small teams who move fast.
            </p>

            {/* Feature list */}
            <div className="space-y-4">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <f.icon className="h-4 w-4 text-teal-300" />
                  </div>
                  <span className="text-sm text-white/80">{f.text}</span>
                </div>
              ))}
            </div>

            </div>
          </div>

          {/* Bottom — Footer */}
          <p className="text-xs text-white/40">
            sikasio.com
          </p>
        </div>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex items-center justify-center bg-background p-6 sm:p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
