'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { verifyPasskey } from '@/lib/passkey'
import { Loader2, Shield, Eye, EyeOff } from 'lucide-react'

interface VaultPasskeyDialogProps {
  open: boolean
  storedHash: string
  onVerified: () => void
  onCancel: () => void
}

export function VaultPasskeyDialog({ open, storedHash, onVerified, onCancel }: VaultPasskeyDialogProps) {
  const [passkey, setPasskey] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [showPasskey, setShowPasskey] = useState(false)
  const autoVerifyRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleVerify = useCallback(async (value?: string | unknown) => {
    const key = typeof value === 'string' ? value : passkey
    if (!key.trim()) {
      setError('Please enter the passkey')
      return
    }

    setVerifying(true)
    setError('')

    try {
      const valid = await verifyPasskey(key, storedHash)
      if (valid) {
        setPasskey('')
        setError('')
        onVerified()
      } else {
        if (!autoVerifyRef.current) {
          setError('Incorrect passkey')
        }
      }
    } catch {
      if (!autoVerifyRef.current) {
        setError('Verification failed')
      }
    } finally {
      setVerifying(false)
      autoVerifyRef.current = false
    }
  }, [passkey, storedHash, onVerified])

  const handleChange = (value: string) => {
    setPasskey(value)
    setError('')
    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Auto-verify when passkey reaches a reasonable length (4+ chars)
    if (value.trim().length >= 4) {
      autoVerifyRef.current = true
      debounceRef.current = setTimeout(async () => {
        try {
          const valid = await verifyPasskey(value, storedHash)
          if (valid) {
            setPasskey('')
            setError('')
            onVerified()
          }
        } catch {
          // silent on auto-verify
        } finally {
          autoVerifyRef.current = false
        }
      }, 300)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && passkey.trim()) {
      autoVerifyRef.current = false
      handleVerify()
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setPasskey('')
      setError('')
      onCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Vault Protected
          </DialogTitle>
          <DialogDescription>
            Enter your vault passkey to access sensitive data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Passkey</Label>
            <div className="relative">
              <Input
                type={showPasskey ? 'text' : 'password'}
                placeholder="Enter vault passkey"
                value={passkey}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={verifying}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPasskey(!showPasskey)}
              >
                {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={verifying}>
            Cancel
          </Button>
          <Button onClick={handleVerify} disabled={verifying || !passkey.trim()}>
            {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
