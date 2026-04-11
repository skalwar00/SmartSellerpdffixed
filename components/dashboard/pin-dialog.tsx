'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PinDialogProps {
  open: boolean
  onClose: () => void
}

type Mode = 'enter' | 'set' | 'confirm'

export function PinDialog({ open, onClose }: PinDialogProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('enter')
  const [pin, setPin] = useState(['', '', '', ''])
  const [confirmPin, setConfirmPin] = useState(['', '', '', ''])
  const [showPin, setShowPin] = useState(false)
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const confirmInputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    setPin(['', '', '', ''])
    setConfirmPin(['', '', '', ''])
    setError('')
    setShake(false)
    setShowPin(false)
    checkExistingPin()
  }, [open])

  useEffect(() => {
    if (open && hasPin !== null) {
      setTimeout(() => inputsRef.current[0]?.focus(), 100)
    }
  }, [open, hasPin])

  const checkExistingPin = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const existingPin = user?.user_metadata?.costing_pin
    setHasPin(!!existingPin)
    setMode(existingPin ? 'enter' : 'set')
  }

  const triggerShake = (msg: string) => {
    setError(msg)
    setShake(true)
    setPin(['', '', '', ''])
    setTimeout(() => {
      setShake(false)
      inputsRef.current[0]?.focus()
    }, 500)
  }

  const handleDigit = (
    idx: number,
    val: string,
    arr: string[],
    setArr: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (!/^\d?$/.test(val)) return
    const next = [...arr]
    next[idx] = val
    setArr(next)
    setError('')
    if (val && idx < 3) refs.current[idx + 1]?.focus()
  }

  const handleKeyDown = (
    e: React.KeyboardEvent,
    idx: number,
    arr: string[],
    setArr: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && !arr[idx] && idx > 0) {
      refs.current[idx - 1]?.focus()
    }
    if (e.key === 'Enter') handleSubmit()
  }

  const handleSubmit = async () => {
    const entered = pin.join('')
    if (entered.length < 4) {
      setError('Please enter all 4 digits')
      return
    }

    setLoading(true)
    const supabase = createClient()

    if (mode === 'enter') {
      const { data: { user } } = await supabase.auth.getUser()
      const stored = user?.user_metadata?.costing_pin
      if (entered === stored) {
        onClose()
        router.push('/dashboard/costing')
      } else {
        triggerShake('Incorrect PIN. Try again.')
      }
    } else if (mode === 'set') {
      setMode('confirm')
      setConfirmPin(['', '', '', ''])
      setTimeout(() => confirmInputsRef.current[0]?.focus(), 100)
    } else if (mode === 'confirm') {
      const confirmed = confirmPin.join('')
      if (confirmed.length < 4) {
        setError('Please confirm all 4 digits')
        setLoading(false)
        return
      }
      if (entered !== confirmed) {
        setError('PINs do not match. Try again.')
        setPin(['', '', '', ''])
        setConfirmPin(['', '', '', ''])
        setMode('set')
        setTimeout(() => inputsRef.current[0]?.focus(), 100)
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.updateUser({
        data: { costing_pin: entered },
      })
      if (error) {
        setError('Failed to save PIN. Try again.')
      } else {
        onClose()
        router.push('/dashboard/costing')
      }
    }

    setLoading(false)
  }

  const PinInputs = ({
    arr,
    setArr,
    refs,
  }: {
    arr: string[]
    setArr: (v: string[]) => void
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  }) => (
    <div className={cn('flex justify-center gap-3', shake && 'animate-[shake_0.4s_ease-in-out]')}>
      {arr.map((digit, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type={showPin ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleDigit(i, e.target.value, arr, setArr, refs)}
          onKeyDown={e => handleKeyDown(e, i, arr, setArr, refs)}
          className={cn(
            'h-14 w-14 rounded-xl border-2 text-center text-xl font-bold outline-none transition-all duration-150',
            'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
            error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50',
          )}
        />
      ))}
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>

      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <Lock className="h-6 w-6 text-blue-500" />
            </div>
            <DialogTitle>
              {mode === 'enter' ? 'Enter Costing PIN' : mode === 'set' ? 'Set a Costing PIN' : 'Confirm PIN'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'enter'
                ? 'Enter your 4-digit PIN to access Costing Manager'
                : mode === 'set'
                ? 'Create a 4-digit PIN to protect your costing data'
                : 'Re-enter the PIN to confirm'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-2">
            <PinInputs
              arr={mode === 'confirm' ? confirmPin : pin}
              setArr={mode === 'confirm' ? setConfirmPin : setPin}
              refs={mode === 'confirm' ? confirmInputsRef : inputsRef}
            />

            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}

            <button
              type="button"
              onClick={() => setShowPin(s => !s)}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPin ? 'Hide PIN' : 'Show PIN'}
            </button>

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? 'Verifying…' : mode === 'enter' ? 'Unlock' : mode === 'set' ? 'Next' : 'Set PIN & Open'}
            </Button>

            {mode === 'enter' && (
              <button
                type="button"
                onClick={() => {
                  setPin(['', '', '', ''])
                  setConfirmPin(['', '', '', ''])
                  setError('')
                  setMode('set')
                  setTimeout(() => inputsRef.current[0]?.focus(), 100)
                }}
                className="text-center text-xs text-muted-foreground hover:text-blue-500 transition-colors underline underline-offset-2"
              >
                Forgot PIN? Reset it
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
