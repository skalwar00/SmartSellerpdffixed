'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Users, IndianRupee, CheckCircle2, Clock, XCircle,
  RefreshCw, Loader2, TrendingUp, ExternalLink, BadgeCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

type Partner = {
  id: string
  name: string
  email: string
  phone: string | null
  referral_code: string
  status: 'pending' | 'active' | 'suspended'
  created_at: string
}

type Commission = {
  id: string
  partner_id: string
  referred_user_email: string | null
  commission_type: 'first' | 'recurring'
  payment_amount: number
  commission_percent: number
  commission_amount: number
  status: 'pending' | 'paid'
  created_at: string
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active')
    return <Badge className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" />Active</Badge>
  if (status === 'suspended')
    return <Badge className="bg-red-100 text-red-800 border-red-200 gap-1"><XCircle className="h-3 w-3" />Suspended</Badge>
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1"><Clock className="h-3 w-3" />Pending</Badge>
}

export default function AdminPartnersPage() {
  const [partners, setPartners]         = useState<Partner[]>([])
  const [commissions, setCommissions]   = useState<Commission[]>([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState<Partner | null>(null)
  const [, startTransition]             = useTransition()

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/partners')
      const data = await res.json()
      setPartners(data.partners ?? [])
      setCommissions(data.commissions ?? [])
    } catch {
      toast.error('Failed to load partners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const updateStatus = (partnerId: string, action: 'approve' | 'suspend' | 'reset') => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/partners/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partnerId, action }),
        })
        if (!res.ok) throw new Error()
        toast.success('Status updated')
        await load()
        if (selected?.id === partnerId) {
          setSelected(prev => prev ? {
            ...prev,
            status: action === 'approve' ? 'active' : action === 'suspend' ? 'suspended' : 'pending'
          } : null)
        }
      } catch {
        toast.error('Failed to update status')
      }
    })
  }

  const payCommission = (commissionId: string) => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/partners/pay-commission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commissionId }),
        })
        if (!res.ok) throw new Error()
        toast.success('Commission marked as paid')
        await load()
      } catch {
        toast.error('Failed to mark as paid')
      }
    })
  }

  const partnerCommissions = (pid: string) => commissions.filter(c => c.partner_id === pid)
  const totalEarned = (pid: string) => partnerCommissions(pid).reduce((s, c) => s + c.commission_amount, 0)
  const pendingAmt  = (pid: string) => partnerCommissions(pid).filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0)

  const overallStats = {
    total: partners.length,
    active: partners.filter(p => p.status === 'active').length,
    pending: partners.filter(p => p.status === 'pending').length,
    totalCommissions: commissions.reduce((s, c) => s + c.commission_amount, 0),
    unpaid: commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0),
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Partners</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Affiliate partner management aur commission tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <a
            href="/partner/register"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              Partner Page
            </Button>
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Partners', value: overallStats.total, icon: Users, color: 'text-blue-600' },
          { label: 'Active', value: overallStats.active, icon: BadgeCheck, color: 'text-green-600' },
          { label: 'Total Commissions', value: `₹${overallStats.totalCommissions.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-purple-600' },
          { label: 'Unpaid', value: `₹${overallStats.unpaid.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading partners…
        </div>
      ) : partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <Users className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No partners yet</p>
          <p className="text-xs mt-1">Share the partner registration page to get started</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Partner List */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">All Partners</h2>
            {partners.map(p => {
              const earned  = totalEarned(p.id)
              const pending = pendingAmt(p.id)
              const isSelected = selected?.id === p.id
              return (
                <Card
                  key={p.id}
                  className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                  onClick={() => setSelected(isSelected ? null : p)}
                >
                  <div className={`h-1.5 w-full rounded-t-lg ${p.status === 'active' ? 'bg-green-400' : p.status === 'suspended' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                        {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                      </div>
                      <StatusBadge status={p.status} />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-gray-100 border rounded-full px-2.5 py-1 font-mono font-medium">
                        {p.referral_code}
                      </span>
                      <a
                        href={`/partner/${p.referral_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                      >
                        Dashboard <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Total Earned</span>
                        <p className="font-bold text-base mt-0.5">₹{earned.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Pending</span>
                        <p className="font-bold text-base mt-0.5 text-orange-600">₹{pending.toLocaleString('en-IN')}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {p.status !== 'active' && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                          onClick={e => { e.stopPropagation(); updateStatus(p.id, 'approve') }}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                        </Button>
                      )}
                      {p.status !== 'suspended' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 h-8 text-xs"
                          onClick={e => { e.stopPropagation(); updateStatus(p.id, 'suspend') }}
                        >
                          <XCircle className="h-3 w-3 mr-1" />Suspend
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Commission Detail */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {selected ? `${selected.name} — Commissions` : 'Commission History (All)'}
            </h2>

            {(selected ? partnerCommissions(selected.id) : commissions).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border rounded-xl">
                <IndianRupee className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No commissions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(selected ? partnerCommissions(selected.id) : commissions).map(c => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.referred_user_email ?? 'Client'}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              c.commission_type === 'first'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {c.commission_type === 'first' ? 'First (50%)' : 'Renewal (15%)'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {c.commission_percent}% of ₹{c.payment_amount}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(c.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-2">
                          <p className="text-lg font-bold">₹{c.commission_amount}</p>
                          {c.status === 'paid' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />Paid
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => payCommission(c.id)}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
