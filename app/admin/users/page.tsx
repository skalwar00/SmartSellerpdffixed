'use client'

import { useEffect, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
} from 'lucide-react'
import { toast } from 'sonner'
import {
  upgradeToPro, downgradeToTrial, extendTrial, revokeAccess,
} from '../actions'

type Plan = {
  user_id: string
  plan_type: string
  expiry_date: string
  email?: string
}

function getDaysLeft(expiry: string) {
  return Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function PlanBadge({ plan, daysLeft }: { plan: string; daysLeft: number }) {
  if (plan === 'pro') return <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Pro</Badge>
  if (daysLeft > 0) return <Badge className="bg-blue-100 text-blue-800 border border-blue-200">Trial · {daysLeft}d left</Badge>
  return <Badge className="bg-red-100 text-red-800 border border-red-200">Expired</Badge>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Expiry</th>
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
                            <p className="font-medium">{p.email ?? <span className="text-muted-foreground italic">No email on file</span>}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.user_id.slice(0, 20)}…</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <PlanBadge plan={p.plan_type} daysLeft={daysLeft} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {new Date(p.expiry_date).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
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

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Want to see user emails?</p>
            <p className="mt-0.5">Emails appear automatically once a user submits a payment request. You can also add a <code className="bg-amber-100 px-1 rounded">email</code> column to the <code className="bg-amber-100 px-1 rounded">users_plan</code> table and store it during sign-up.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
