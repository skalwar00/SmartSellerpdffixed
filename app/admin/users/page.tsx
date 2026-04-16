'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Crown, Clock, Search, MoreHorizontal, Loader2,
  ShieldOff, RefreshCw, Zap, AlertCircle, Users,
  Tag, Package, Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  upgradeToPro, downgradeToTrial, extendTrial, revokeAccess,
} from '../actions'

type Plan = {
  user_id: string
  plan_type: string
  expiry_date: string
  email?: string | null
  created_at?: string | null
  last_sign_in_at?: string | null
  sku_count?: number
  picklist_count?: number
}

function getDaysLeft(expiry: string) {
  return Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function PlanBadge({ plan, daysLeft }: { plan: string; daysLeft: number }) {
  if (plan === 'pro') return <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Pro</Badge>
  if (daysLeft > 0) return <Badge className="bg-blue-100 text-blue-800 border border-blue-200">Trial · {daysLeft}d left</Badge>
  return <Badge className="bg-red-100 text-red-800 border border-red-200">Expired</Badge>
}

function formatDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminUsersPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [pending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setPlans(Array.isArray(data) ? data : [])
    } catch {
      setPlans([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const now = new Date()
  const filtered = plans.filter((p) => {
    const daysLeft = getDaysLeft(p.expiry_date)
    const matchesSearch = !search ||
      p.user_id.toLowerCase().includes(search.toLowerCase()) ||
      (p.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'pro' ? p.plan_type === 'pro' :
      filter === 'trial' ? (p.plan_type === 'trial' && daysLeft > 0) :
      filter === 'expired' ? (p.plan_type !== 'pro' && new Date(p.expiry_date) < now) :
      true
    return matchesSearch && matchesFilter
  })

  const doAction = (userId: string, fn: () => Promise<void>) => {
    setActionId(userId)
    startTransition(async () => {
      try {
        await fn()
        await load()
        toast.success('User updated successfully')
      } catch {
        toast.error('Action failed — check console')
      } finally {
        setActionId(null)
      }
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{plans.length} registered users</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by email or user ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="pro">Pro Only</SelectItem>
                <SelectItem value="trial">Active Trial</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Users className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Usage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Joined / Last seen</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((p) => {
                    const daysLeft = getDaysLeft(p.expiry_date)
                    const isActing = actionId === p.user_id && pending
                    return (
                      <tr key={p.user_id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            {p.email ? (
                              <p className="font-medium">{p.email}</p>
                            ) : (
                              <p className="text-muted-foreground italic text-xs">No email found</p>
                            )}
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.user_id.slice(0, 16)}…</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <PlanBadge plan={p.plan_type} daysLeft={daysLeft} />
                            <p className="text-xs text-muted-foreground hidden sm:block">
                              Expires {formatDate(p.expiry_date)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Tag className="h-3 w-3 text-blue-500" />
                              <span className="font-semibold text-gray-700">{p.sku_count ?? 0}</span>
                              <span>SKUs</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Package className="h-3 w-3 text-green-500" />
                              <span className="font-semibold text-gray-700">{p.picklist_count ?? 0}</span>
                              <span>items</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>Joined: <span className="text-gray-700">{formatDate(p.created_at)}</span></p>
                            <p>Last seen: <span className="text-gray-700">{formatDate(p.last_sign_in_at)}</span></p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isActing ? (
                            <Loader2 className="h-4 w-4 animate-spin ml-auto text-muted-foreground" />
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {p.plan_type !== 'pro' && (
                                  <DropdownMenuItem onClick={() => doAction(p.user_id, () => upgradeToPro(p.user_id))}>
                                    <Crown className="h-3.5 w-3.5 mr-2 text-amber-500" />
                                    Upgrade to Pro
                                  </DropdownMenuItem>
                                )}
                                {p.plan_type === 'pro' && (
                                  <DropdownMenuItem onClick={() => doAction(p.user_id, () => downgradeToTrial(p.user_id))}>
                                    <Zap className="h-3.5 w-3.5 mr-2 text-blue-500" />
                                    Downgrade to Trial
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => doAction(p.user_id, () => extendTrial(p.user_id, 7))}>
                                  <Clock className="h-3.5 w-3.5 mr-2 text-green-500" />
                                  Extend +7 days
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => doAction(p.user_id, () => extendTrial(p.user_id, 30))}>
                                  <Clock className="h-3.5 w-3.5 mr-2 text-green-500" />
                                  Extend +30 days
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => doAction(p.user_id, () => revokeAccess(p.user_id))}
                                >
                                  <ShieldOff className="h-3.5 w-3.5 mr-2" />
                                  Revoke Access
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.some(p => !p.email) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Kuch users ka email nahi mila</p>
              <p className="mt-0.5">Ye users Supabase Auth mein registered nahi hain ya unka account delete ho chuka hai.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
