import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, Clock, CreditCard, AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react'
import Link from 'next/link'

function StatCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string; value: number | string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function AdminOverviewPage() {
  const supabase = createAdminClient()

  const [{ data: plans }, { data: payments }] = await Promise.all([
    supabase.from('users_plan').select('*'),
    supabase.from('payment_requests').select('*').order('created_at', { ascending: false }),
  ])

  const allPlans = plans ?? []
  const allPayments = payments ?? []

  const now = new Date()
  const totalUsers = allPlans.length
  const activeTrials = allPlans.filter(
    (p) => p.plan_type === 'trial' && new Date(p.expiry_date) > now
  ).length
  const proUsers = allPlans.filter((p) => p.plan_type === 'pro').length
  const expiredUsers = allPlans.filter(
    (p) => p.plan_type !== 'pro' && new Date(p.expiry_date) < now
  ).length
  const pendingPayments = allPayments.filter((p) => p.status === 'pending').length

  const recentPayments = allPayments.slice(0, 8)
  const setupNeeded = payments === null

  const statusIcon = (s: string) =>
    s === 'approved' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
    s === 'rejected' ? <XCircle className="h-4 w-4 text-red-500" /> :
    <Clock className="h-4 w-4 text-amber-500" />

  const statusColor = (s: string) =>
    s === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
    s === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
    'bg-amber-100 text-amber-800 border-amber-200'

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">SmartSeller Suite admin dashboard</p>
      </div>

      {setupNeeded && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Database setup required</p>
              <p className="mt-0.5">The <code className="bg-amber-100 px-1 rounded">payment_requests</code> table does not exist yet.
                Visit <Link href="/admin/payments" className="underline font-medium">Payments</Link> for setup instructions.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={totalUsers} icon={Users} color="bg-blue-100 text-blue-600" sub={`${proUsers} pro · ${activeTrials} trial`} />
        <StatCard title="Active Trials" value={activeTrials} icon={Clock} color="bg-violet-100 text-violet-600" sub="Within expiry date" />
        <StatCard title="Pro Members" value={proUsers} icon={Crown} color="bg-amber-100 text-amber-600" sub="Paying subscribers" />
        <StatCard title="Pending Payments" value={pendingPayments} icon={CreditCard} color={pendingPayments > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'} sub="Awaiting verification" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">User Breakdown</CardTitle>
            <CardDescription>All registered users by status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Pro Members', count: proUsers, color: 'bg-amber-500' },
              { label: 'Active Trials', count: activeTrials, color: 'bg-blue-500' },
              { label: 'Expired / Blocked', count: expiredUsers, color: 'bg-red-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-36 text-sm text-muted-foreground">{label}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: totalUsers ? `${(count / totalUsers) * 100}%` : '0%' }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Payment Requests</CardTitle>
                <CardDescription>Latest submissions from users</CardDescription>
              </div>
              <Link href="/admin/payments" className="text-xs text-primary hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No payment requests yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border bg-gray-50/50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.email ?? 'Unknown User'}</p>
                      <p className="text-xs text-muted-foreground">
                        ₹{p.amount} · {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <Badge className={`text-xs border shrink-0 ml-3 ${statusColor(p.status)}`}>
                      <span className="flex items-center gap-1">
                        {statusIcon(p.status)}
                        {p.status}
                      </span>
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
