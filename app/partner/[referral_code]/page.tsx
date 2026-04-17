'use client'

import { useEffect, useState, use } from 'react'
import {
  Users, IndianRupee, TrendingUp, Clock, CheckCircle2,
  Copy, Share2, Loader2, AlertCircle, ArrowUpRight, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type Commission = {
  id: string
  referred_user_email: string | null
  commission_type: 'first' | 'recurring'
  payment_amount: number
  commission_percent: number
  commission_amount: number
  status: 'pending' | 'paid'
  created_at: string
}

type Stats = {
  totalReferred: number
  clientsWithPayment: number
  totalEarned: number
  pendingAmt: number
  paidAmt: number
}

type Partner = {
  name: string
  email: string
  referral_code: string
  status: 'pending' | 'active' | 'suspended'
}

export default function PartnerDashboard({ params }: { params: Promise<{ referral_code: string }> }) {
  const { referral_code } = use(params)
  const code = referral_code.toUpperCase()

  const [partner, setPartner]         = useState<Partner | null>(null)
  const [stats, setStats]             = useState<Stats | null>(null)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading]         = useState(true)
  const [notFound, setNotFound]       = useState(false)

  useEffect(() => {
    fetch(`/api/partner/dashboard/${code}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setPartner(data.partner)
        setStats(data.stats)
        setCommissions(data.commissions)
      })
      .finally(() => setLoading(false))
  }, [code])

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/r/${code}`
    : `/r/${code}`

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink)
    toast.success('Link copied to clipboard!')
  }

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: 'SmartSellerPick', url: inviteLink })
    } else {
      copyLink()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h1 className="text-xl font-bold text-white">Partner Not Found</h1>
        <p className="text-slate-400 text-sm">The partner code is invalid or your application is still under review.</p>
        <a href="/partner/register" className="text-orange-400 underline text-sm">
          Apply to become a partner
        </a>
      </div>
    )
  }

  const statusColor = partner?.status === 'active'
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : partner?.status === 'suspended'
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'

  const statusLabel = partner?.status === 'active' ? 'Active'
    : partner?.status === 'suspended' ? 'Suspended'
    : 'Under Review'

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Toaster />

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 border-b border-white/10 px-4 py-5">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.png" alt="SSP" className="h-6 w-6 object-contain" />
              <span className="text-xs text-slate-400 font-medium">SmartSellerPick</span>
            </div>
            <h1 className="text-lg font-bold">{partner?.name}</h1>
            <p className="text-xs text-slate-400">{partner?.email}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-5">

        {/* Under review notice */}
        {partner?.status === 'pending' && (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-4 flex gap-3 items-start">
            <Clock className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-300">Application Under Review</p>
              <p className="text-xs text-yellow-400/80 mt-0.5">
                Our team is reviewing your application. Once approved, you can start sharing your invite link and earning.
              </p>
            </div>
          </div>
        )}

        {/* Invite Link */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Your Partner Invite Link</p>
            <p className="text-xs text-slate-600 mt-0.5">Share this link with sellers to track your sign-ups</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5">
            <span className="text-xs text-orange-400 font-mono flex-1 truncate">{inviteLink}</span>
            <button onClick={copyLink} className="text-slate-400 hover:text-white transition-colors">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Link
            </button>
            <button
              onClick={shareLink}
              className="flex items-center justify-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Users className="h-4 w-4" />
              <span className="text-xs">Sign-ups</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.totalReferred ?? 0}</p>
            <p className="text-xs text-slate-500">Via your link</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Converted</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.clientsWithPayment ?? 0}</p>
            <p className="text-xs text-slate-500">Active subscribers</p>
          </div>
          <div className="bg-green-900/20 border border-green-500/20 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Paid Out</span>
            </div>
            <p className="text-3xl font-bold text-green-400">
              ₹{(stats?.paidAmt ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-green-600">Already received</p>
          </div>
          <div className="bg-orange-900/20 border border-orange-500/20 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-orange-400">
              <Wallet className="h-4 w-4" />
              <span className="text-xs">Due</span>
            </div>
            <p className="text-3xl font-bold text-orange-400">
              ₹{(stats?.pendingAmt ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-orange-600">Pending payout</p>
          </div>
        </div>

        {/* Earnings Structure */}
        <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Earnings Structure</p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-400"></span>
                <div>
                  <p className="text-sm text-slate-200 font-medium">First Subscription</p>
                  <p className="text-xs text-slate-500">One-time on new client sign-up</p>
                </div>
              </div>
              <span className="text-lg font-bold text-orange-400">50%</span>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400"></span>
                <div>
                  <p className="text-sm text-slate-200 font-medium">Recurring Renewals</p>
                  <p className="text-xs text-slate-500">Lifetime on every renewal</p>
                </div>
              </div>
              <span className="text-lg font-bold text-green-400">15%</span>
            </div>
          </div>
        </div>

        {/* Earnings History */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Earnings History</p>

          {commissions.length === 0 ? (
            <div className="bg-white/3 border border-white/8 rounded-2xl p-8 text-center space-y-2">
              <IndianRupee className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">No earnings recorded yet</p>
              <p className="text-xs text-slate-600">Your earnings will appear here once a referred client subscribes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commissions.map(c => (
                <div
                  key={c.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {c.referred_user_email ?? 'Client'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.commission_type === 'first'
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {c.commission_type === 'first' ? 'First Sub' : 'Renewal'}
                        </span>
                        <span className="text-xs text-slate-500">{c.commission_percent}% of ₹{c.payment_amount}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-white">₹{c.commission_amount}</p>
                      <span className={`flex items-center gap-1 text-xs justify-end ${
                        c.status === 'paid' ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {c.status === 'paid'
                          ? <><CheckCircle2 className="h-3 w-3" />Paid</>
                          : <><Clock className="h-3 w-3" />Pending</>
                        }
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    {new Date(c.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4 space-y-3 mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">How It Works</p>
          <div className="space-y-3">
            {[
              ['1', 'Share your unique partner link with e-commerce sellers.', 'text-orange-400'],
              ['2', 'Seller signs up using your link.', 'text-blue-400'],
              ['3', 'When they subscribe — you earn 50% of the first payment.', 'text-green-400'],
              ['4', 'Earn 15% on every renewal for the lifetime of their account.', 'text-purple-400'],
            ].map(([n, text, color]) => (
              <div key={n} className="flex items-start gap-3">
                <span className={`text-xs font-bold w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                  {n}
                </span>
                <p className="text-sm text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <a
          href="/partner/register"
          className="flex items-center justify-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors py-2"
        >
          Refer another partner
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
