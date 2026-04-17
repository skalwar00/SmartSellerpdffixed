'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export function DemoRequestModal({ open, onClose }: Props) {
  const [form, setForm] = useState({ company_name: '', mobile: '', email: '', city: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Kuch gadbad ho gaya, dobara try karein.')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuch gadbad ho gaya')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setSubmitted(false)
      setForm({ company_name: '', mobile: '', email: '', city: '' })
      setError(null)
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Request mil gayi!</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Hum jald hi aapse contact karenge demo schedule karne ke liye.
              </p>
            </div>
            <Button onClick={handleClose} className="mt-2 w-full">Theek hai</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Demo Book Karein</DialogTitle>
              <DialogDescription>
                Apni details bharo — hum aapko demo ke liye call karenge.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="company_name">Company / Shop Name</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  placeholder="Jaise: Rahul Fashion Hub"
                  required
                  value={form.company_name}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  placeholder="10 digit number"
                  required
                  pattern="[0-9]{10,15}"
                  value={form.mobile}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="aap@example.com"
                  required
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="Jaise: Surat, Mumbai, Delhi"
                  required
                  value={form.city}
                  onChange={handleChange}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Submit ho raha hai...' : 'Demo Request Submit Karein'}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
