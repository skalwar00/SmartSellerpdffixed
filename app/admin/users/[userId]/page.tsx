'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, Package, RotateCcw, Clock, CheckCircle2, AlertCircle, Wifi } from 'lucide-react'

type ResetEvent = {
  total_qty: number
  picked_qty: number
  remaining_qty: number
  is_complete: boolean
  time: string
}

type DayActivity = {
  date: string
  pushes: number
  skus_pushed: number
  qty_pushed: number
  resets: ResetEvent[]
  session_pings: number
}

function formatDay(d: string) {
  const date = new Date(d)
  const today = new Date().toLocaleDateString('en-CA')
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA')
  if (d === today) return 'Today'
  if (d === yesterday) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function sessionTime(pings: number) {
  const mins = pings * 5
  if (mins === 0) return '—'
  if (mins < 60) return `~${mins} min`
  return `~${Math.round(mins / 60 * 10) / 10} hr`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function UserActivityPage() {
  const { userId } = useParams<{ userId: string }>()
  const [days, setDays] = useState<DayActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/users/${userId}/activity`)
      .then(r => r.json())
      .then(d => {
        if (d.error === 'table_missing') { setTableMissing(true); return }
        setDays(d.days ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const hasAnyActivity = days.some(d => d.pushes > 0 || d.resets.length > 0 || d.session_pings > 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users"><ArrowLeft className="h-4 w-4 mr-1" />Users</Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">User Activity</h1>
          <p className="text-xs text-muted-foreground font-mono">{userId}</p>
        </div>
      </div>

      {tableMissing && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-3">
                <p className="font-semibold">Activity log table nahi bani hai abhi</p>
                <p>Supabase Dashboard mein SQL Editor mein ye query run karein:</p>
                <pre className="rounded-lg bg-amber-100 p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto">{`create table user_activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  event_type text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index on user_activity_log (user_id, created_at desc);
alter table user_activity_log enable row level security;
create policy "Users can log own activity"
  on user_activity_log for insert
  with check (auth.uid() = user_id);
create policy "Admins can read all"
  on user_activity_log for select
  using (true);`}</pre>
                <p className="text-xs">Table banane ke baad activity automatically track hone lagegi.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading activity…
        </div>
      ) : !tableMissing && !hasAnyActivity ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm font-medium">No activity in last 7 days</p>
            <p className="text-xs mt-1">User ne koi push, reset ya login nahi kiya</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const isActive = day.pushes > 0 || day.resets.length > 0 || day.session_pings > 0
            return (
              <Card key={day.date} className={isActive ? '' : 'opacity-40'}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{formatDay(day.date)}</CardTitle>
                      <CardDescription className="text-xs">{day.date}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Wifi className="h-3.5 w-3.5 text-green-500" />
                      <span className="font-medium text-gray-700">{sessionTime(day.session_pings)}</span>
                      <span>online</span>
                    </div>
                  </div>
                </CardHeader>
                {isActive && (
                  <CardContent className="space-y-3 pt-0">
                    {day.pushes > 0 && (
                      <div className="rounded-lg border bg-blue-50/50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-sm font-semibold text-blue-700">Picklist Push</span>
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{day.pushes}x</Badge>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span><span className="font-semibold text-gray-700">{day.skus_pushed}</span> SKUs added</span>
                          <span><span className="font-semibold text-gray-700">{day.qty_pushed}</span> total qty</span>
                        </div>
                      </div>
                    )}

                    {day.resets.length > 0 && (
                      <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
                          <span className="text-sm font-semibold text-gray-700">Picklist Reset</span>
                          <Badge variant="secondary" className="text-xs">{day.resets.length}x</Badge>
                        </div>
                        {day.resets.map((r, i) => (
                          <div key={i} className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-xs">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{formatTime(r.time)}</span>
                              <span>Qty: <span className="font-semibold">{r.picked_qty}/{r.total_qty}</span> picked</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {r.is_complete ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  <span className="text-green-600 font-medium">Complete</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                  <span className="text-amber-600 font-medium">{r.remaining_qty} remaining</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isActive && (
                      <p className="text-xs text-muted-foreground text-center py-2">No activity</p>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
