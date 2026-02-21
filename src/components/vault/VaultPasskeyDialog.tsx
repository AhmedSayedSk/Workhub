'use client'

import { useState } from 'react'
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

  const handleVerify = async () => {
    if (!passkey.trim()) {
      setError('Please enter the passkey')
      return
    }

    setVerifying(true)
    setError('')

    try {
      const valid = await verifyPasskey(passkey, storedHash)
      if (valid) {
        setPasskey('')
        setError('')
        onVerified()
      } else {
        setError('Incorrect passkey')
      }
    } catch {
      setError('Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && passkey.trim()) {
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
                onChange={(e) => {
                  setPasskey(e.target.value)
                  setError('')
                }}
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
