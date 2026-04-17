'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, Users, IndianRupee, TrendingUp, Sparkles } from 'lucide-react'

export default function PartnerRegisterPage() {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]   = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Registration failed')
      setDone(json.referral_code)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Application Submitted</h2>
            <p className="text-sm text-slate-400 mt-1">Our team will review and approve your application shortly.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Your Partner Code</p>
            <p className="text-3xl font-bold text-orange-400 tracking-widest">{done}</p>
            <p className="text-xs text-slate-500">Your dashboard goes live once approved</p>
          </div>
          <div className="bg-blue-900/30 border border-blue-500/20 rounded-xl p-3 text-left space-y-1">
            <p className="text-xs font-semibold text-blue-300">Your partner invite link:</p>
            <p className="text-xs text-slate-400 break-all font-mono">
              {typeof window !== 'undefined' ? window.location.origin : ''}/r/{done}
            </p>
          </div>
          <Link
            href={`/partner/${done}`}
            className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            View My Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4 gap-8">

      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-3">
          <img src="/logo.png" alt="SSP" className="h-10 w-10 object-contain" />
          <span className="text-xl font-bold text-white">SmartSellerPick</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Partner Program</h1>
        <p className="text-slate-400 text-sm max-w-xs">
          Introduce sellers to SmartSellerPick and earn a share of every successful subscription.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center space-y-1">
          <IndianRupee className="h-5 w-5 text-orange-400 mx-auto" />
          <p className="text-2xl font-bold text-white">50%</p>
          <p className="text-xs text-slate-400">First subscription</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center space-y-1">
          <TrendingUp className="h-5 w-5 text-green-400 mx-auto" />
          <p className="text-2xl font-bold text-white">15%</p>
          <p className="text-xs text-slate-400">Every renewal</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-orange-400" />
          <h2 className="text-lg font-bold text-white">Apply Now — It&apos;s Free</h2>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">Full Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Rahul Sharma"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">Email Address *</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="rahul@example.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">WhatsApp Number <span className="text-slate-600">(optional)</span></label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="9876543210"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</>
            : <><Users className="h-4 w-4" />Submit Application</>
          }
        </button>

        <p className="text-center text-xs text-slate-500">
          You will receive your dashboard link once approved.
        </p>
      </form>
    </div>
  )
}
