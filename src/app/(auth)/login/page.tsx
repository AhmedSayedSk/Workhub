'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'
import { audit } from '@/lib/firestore'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { FirebaseError } from 'firebase/app'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const cred = await signIn(email, password)
      audit({ type: 'login', action: 'login_success', actorUid: cred.user.uid, actorEmail: cred.user.email || email })
      router.push('/')
    } catch (error: unknown) {
      const errorCode = error instanceof FirebaseError ? error.code : 'unknown'
      audit({ type: 'login_failed', action: 'login_failed', actorUid: null, actorEmail: email, details: { errorCode } })
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Mobile logo — only visible on small screens where the left panel is hidden */}
      <div className="flex justify-center mb-8 lg:hidden">
        <Image
          src="/logo-with-title.png"
          alt="WorkHub"
          width={200}
          height={60}
          className="h-14 w-auto"
          priority
        />
      </div>

      <div className="space-y-2 mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="pr-10 h-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full h-11" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Powered by Sikasio Works
      </p>
    </div>
  )
}
