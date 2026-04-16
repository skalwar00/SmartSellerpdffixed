'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  RefreshCw, Loader2, Activity, Package, RotateCcw, Clock,
  Search, AlertCircle, CheckCircle2, XCircle, ChevronRight,
  TrendingUp, Calendar, ImageIcon,
} from 'lucide-react'

type DaySummary = {
  date: string
  pushCount: number
  pushSkuCount: number
  pushTotalQty: number
  resetCount: number
  resetCompletions: number
  resetRemainingQty: number
  sessionMinutes: number
  imageViewCount: number
}

type UserActivity = {
  user_id: string
  email: string
  days: DaySummary[]
}

type ActivityData = {
  days: string[]
  users: UserActivity[]
}

type EventLog = {
  id: string
  event_type: string
  metadata: Record<string, number | boolean | string>
  created_at: string
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatFullDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatMinutes(mins: number) {
  if (mins === 0) return null
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function DayCell({ day }: { day: DaySummary }) {
  const hasAny = day.pushCount > 0 || day.resetCount > 0 || day.sessionMinutes > 0 || day.imageViewCount > 0
  if (!hasAny) {
    return (
      <td className="px-2 py-2 text-center align-top">
        <span className="text-xs text-gray-300">—</span>
      </td>
    )
  }

  return (
    <td className="px-2 py-2 align-top min-w-[120px]">
      <div className="space-y-1">
        {day.pushCount > 0 && (
          <div className="flex items-start gap-1.5 rounded-md bg-blue-50 border border-blue-100 px-2 py-1.5">
            <Package className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-xs leading-tight">
              <p className="font-semibold text-blue-700">{day.pushCount}x Push</p>
              <p className="text-blue-500">{day.pushSkuCount} SKUs · {day.pushTotalQty} qty</p>
            </div>
          </div>
        )}
        {day.resetCount > 0 && (
          <div className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 border ${
            day.resetCompletions === day.resetCount
              ? 'bg-green-50 border-green-100'
              : day.resetCompletions > 0
              ? 'bg-amber-50 border-amber-100'
              : 'bg-red-50 border-red-100'
          }`}>
            <RotateCcw className={`h-3 w-3 mt-0.5 shrink-0 ${
              day.resetCompletions === day.resetCount ? 'text-green-500' :
              day.resetCompletions > 0 ? 'text-amber-500' : 'text-red-400'
            }`} />
            <div className="text-xs leading-tight">
              <p className={`font-semibold ${
                day.resetCompletions === day.resetCount ? 'text-green-700' :
                day.resetCompletions > 0 ? 'text-amber-700' : 'text-red-600'
              }`}>
                {day.resetCount}x Reset
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {day.resetCompletions === day.resetCount ? (
                  <span className="flex items-center gap-0.5 text-green-600">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    All complete
                  </span>
                ) : day.resetCompletions > 0 ? (
                  <span className="text-amber-600">{day.resetCompletions}/{day.resetCount} complete</span>
                ) : (
                  <span className="flex items-center gap-0.5 text-red-500">
                    <XCircle className="h-2.5 w-2.5" />
                    {day.resetRemainingQty} remaining
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {day.sessionMinutes > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-purple-50 border border-purple-100 px-2 py-1.5">
            <Clock className="h-3 w-3 text-purple-500 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-purple-700">{formatMinutes(day.sessionMinutes)}</span>
              <span className="text-purple-400 ml-1">open</span>
            </div>
          </div>
        )}
        {day.imageViewCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-orange-50 border border-orange-100 px-2 py-1.5">
            <ImageIcon className="h-3 w-3 text-orange-400 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-orange-600">{day.imageViewCount}x</span>
              <span className="text-orange-400 ml-1">image views</span>
            </div>
          </div>
        )}
      </div>
    </td>
  )
}

function UserRow({ user, days, onClick }: { user: UserActivity; days: string[]; onClick: () => void }) {
  const totalPushes = user.days.reduce((s, d) => s + d.pushCount, 0)
  const totalResets = user.days.reduce((s, d) => s + d.resetCount, 0)
  const totalMinutes = user.days.reduce((s, d) => s + d.sessionMinutes, 0)
  const totalImageViews = user.days.reduce((s, d) => s + d.imageViewCount, 0)
  const activeDays = user.days.filter(d => d.pushCount > 0 || d.resetCount > 0 || d.sessionMinutes > 0 || d.imageViewCount > 0).length

  return (
    <tr
      className="border-b hover:bg-blue-50/30 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <td className="px-4 py-3 align-top min-w-[200px] sticky left-0 bg-white border-r group-hover:bg-blue-50/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate max-w-[160px]" title={user.email}>{user.email}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {activeDays > 0 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 text-gray-500">
                  {activeDays}d active
                </Badge>
              )}
              {totalPushes > 0 && (
                <Badge className="text-xs px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">
                  {totalPushes} push
                </Badge>
              )}
              {totalResets > 0 && (
                <Badge className="text-xs px-1.5 py-0 bg-green-100 text-green-700 border-green-200">
                  {totalResets} reset
                </Badge>
              )}
              {totalMinutes > 0 && (
                <Badge className="text-xs px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200">
                  {formatMinutes(totalMinutes)}
                </Badge>
              )}
              {totalImageViews > 0 && (
                <Badge className="text-xs px-1.5 py-0 bg-orange-100 text-orange-600 border-orange-200">
                  {totalImageViews} img
                </Badge>
              )}
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-400 shrink-0 mt-0.5 transition-colors" />
        </div>
      </td>
      {user.days.map((day) => (
        <DayCell key={day.date} day={day} />
      ))}
    </tr>
  )
}

function EventItem({ event }: { event: EventLog }) {
  const meta = event.metadata ?? {}

  if (event.event_type === 'picklist_push') {
    const skuCount = Number(meta.sku_count ?? 0)
    const totalQty = Number(meta.total_qty ?? 0)
    const unmapped = Number(meta.unmapped_count ?? 0)
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 shrink-0">
            <Package className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="w-px flex-1 bg-gray-100" />
        </div>
        <div className="pb-4 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-blue-700">Picklist Push</p>
            <span className="text-xs text-muted-foreground shrink-0">{formatTime(event.created_at)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200 font-normal">
              {skuCount} SKUs
            </Badge>
            <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200 font-normal">
              {totalQty} total qty
            </Badge>
            {unmapped > 0 && (
              <Badge className="text-xs bg-amber-50 text-amber-700 border-amber-200 font-normal">
                {unmapped} unmapped
              </Badge>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (event.event_type === 'picklist_reset') {
    const totalItems = Number(meta.total_items ?? 0)
    const totalQty = Number(meta.total_qty ?? 0)
    const pickedQty = Number(meta.picked_qty ?? 0)
    const remainingQty = Number(meta.remaining_qty ?? 0)
    const isComplete = Boolean(meta.is_complete)
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${
            isComplete ? 'bg-green-100' : remainingQty > 0 ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <RotateCcw className={`h-3.5 w-3.5 ${
              isComplete ? 'text-green-600' : remainingQty > 0 ? 'text-red-500' : 'text-amber-600'
            }`} />
          </div>
          <div className="w-px flex-1 bg-gray-100" />
        </div>
        <div className="pb-4 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold ${
                isComplete ? 'text-green-700' : remainingQty > 0 ? 'text-red-600' : 'text-amber-700'
              }`}>Picklist Reset</p>
              {isComplete ? (
                <span className="flex items-center gap-0.5 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-xs text-red-500">
                  <XCircle className="h-3 w-3" /> Incomplete
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{formatTime(event.created_at)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge className="text-xs bg-gray-50 text-gray-600 border-gray-200 font-normal">
              {totalItems} SKUs
            </Badge>
            <Badge className="text-xs bg-gray-50 text-gray-600 border-gray-200 font-normal">
              {totalQty} total qty
            </Badge>
            <Badge className="text-xs bg-green-50 text-green-700 border-green-200 font-normal">
              {pickedQty} picked
            </Badge>
            {remainingQty > 0 && (
              <Badge className="text-xs bg-red-50 text-red-600 border-red-200 font-normal">
                {remainingQty} remaining
              </Badge>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (event.event_type === 'session_ping') {
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-50 shrink-0 border border-purple-100">
            <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          </div>
          <div className="w-px flex-1 bg-gray-100" />
        </div>
        <div className="pb-3 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-purple-600 font-medium">Dashboard open</p>
            <span className="text-xs text-muted-foreground">{formatTime(event.created_at)}</span>
          </div>
        </div>
      </div>
    )
  }

  if (event.event_type === 'image_view') {
    const sku = String(meta.master_sku ?? '')
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 border border-orange-100 shrink-0">
            <ImageIcon className="h-3.5 w-3.5 text-orange-400" />
          </div>
          <div className="w-px flex-1 bg-gray-100" />
        </div>
        <div className="pb-4 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-orange-600">Image Viewed</p>
            <span className="text-xs text-muted-foreground shrink-0">{formatTime(event.created_at)}</span>
          </div>
          {sku && (
            <p className="text-xs text-orange-500 mt-0.5 font-mono">{sku}</p>
          )}
        </div>
      </div>
    )
  }

  return null
}

function groupEventsByDay(events: EventLog[]) {
  const map = new Map<string, EventLog[]>()
  for (const e of events) {
    const day = new Date(e.created_at).toISOString().slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(e)
  }
  return map
}

function UserTimeline({ userId, email }: { userId: string; email: string }) {
  const [events, setEvents] = useState<EventLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/activity/${userId}`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then(d => setEvents(Array.isArray(d.events) ? d.events : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading timeline…
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
        <Activity className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No events in the last 7 days</p>
      </div>
    )
  }

  const grouped = groupEventsByDay(events)
  const sortedDays = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))

  const pushEvents = events.filter(e => e.event_type === 'picklist_push')
  const resetEvents = events.filter(e => e.event_type === 'picklist_reset')
  const pingEvents = events.filter(e => e.event_type === 'session_ping')
  const imageViewEvents = events.filter(e => e.event_type === 'image_view')
  const totalQty = pushEvents.reduce((s, e) => s + Number((e.metadata as Record<string, number>).total_qty ?? 0), 0)
  const completedResets = resetEvents.filter(e => e.metadata?.is_complete).length

  const topViewedSkus = imageViewEvents.reduce<Record<string, number>>((acc, e) => {
    const sku = String(e.metadata?.master_sku ?? '')
    if (sku) acc[sku] = (acc[sku] ?? 0) + 1
    return acc
  }, {})
  const topSku = Object.entries(topViewedSkus).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{pushEvents.length}</p>
          <p className="text-xs text-blue-500 mt-0.5">Pushes</p>
          <p className="text-xs text-blue-400">{totalQty} qty total</p>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{resetEvents.length}</p>
          <p className="text-xs text-green-500 mt-0.5">Resets</p>
          <p className="text-xs text-green-400">{completedResets} complete</p>
        </div>
        <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 text-center">
          <p className="text-2xl font-bold text-purple-700">{formatMinutes(pingEvents.length * 5) ?? '0m'}</p>
          <p className="text-xs text-purple-500 mt-0.5">Time open</p>
          <p className="text-xs text-purple-400">est. from pings</p>
        </div>
        <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{imageViewEvents.length}</p>
          <p className="text-xs text-orange-500 mt-0.5">Image views</p>
          <p className="text-xs text-orange-400 truncate">{topSku ? `${topSku[0]} ×${topSku[1]}` : 'by packer'}</p>
        </div>
      </div>

      <div className="space-y-6">
        {sortedDays.map(day => {
          const dayEvents = grouped.get(day) ?? []
          const nonPingEvents = dayEvents.filter(e => e.event_type !== 'session_ping')
          const pingCount = dayEvents.filter(e => e.event_type === 'session_ping').length
          const firstPing = dayEvents.filter(e => e.event_type === 'session_ping').at(-1)
          const lastPing = dayEvents.filter(e => e.event_type === 'session_ping').at(0)

          const displayEvents: EventLog[] = []
          for (const e of nonPingEvents) displayEvents.push(e)
          if (pingCount > 0 && firstPing && lastPing) {
            displayEvents.push({
              id: `ping-summary-${day}`,
              event_type: 'session_ping_summary',
              metadata: { ping_count: pingCount, first_ping: firstPing.created_at, last_ping: lastPing.created_at } as Record<string, number | boolean | string>,
              created_at: lastPing.created_at,
            })
          }
          displayEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

          return (
            <div key={day}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {formatFullDate(day)}
                </p>
              </div>
              <div className="pl-1">
                {displayEvents.map((event) => {
                  if (event.event_type === 'session_ping_summary') {
                    const pingCount = Number(event.metadata.ping_count)
                    const firstTime = String(event.metadata.first_ping)
                    const lastTime = String(event.metadata.last_ping)
                    return (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-50 border border-purple-100 shrink-0">
                            <Clock className="h-3.5 w-3.5 text-purple-500" />
                          </div>
                          <div className="w-px flex-1 bg-gray-100" />
                        </div>
                        <div className="pb-4 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-purple-700">Dashboard Session</p>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatTime(firstTime)} – {formatTime(lastTime)}
                            </span>
                          </div>
                          <p className="text-xs text-purple-500 mt-0.5">
                            ~{formatMinutes(pingCount * 5) ?? '&lt;5m'} open · {pingCount} check-ins
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return <EventItem key={event.id} event={event} />
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminActivityPage() {
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/activity')
      if (!res.ok) {
        setData(null)
        return
      }
      const json = await res.json()
      if (!json || !Array.isArray(json.users)) {
        setData(null)
        return
      }
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = (data?.users ?? []).filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase())
  )

  const hasTableError = !loading && data === null

  const openDrilldown = (user: UserActivity) => {
    setSelectedUser(user)
    setSheetOpen(true)
  }

  return (
    <div className="mx-auto max-w-full space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Activity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Last 7 days — picklist pushes, resets, and dashboard time</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {hasTableError && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">user_activity_log table missing or access error</p>
              <p className="mt-0.5">Run this SQL in Supabase to create it:</p>
              <pre className="mt-2 bg-amber-100 rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON user_activity_log (user_id, created_at DESC);`}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {data && (
          <p className="text-sm text-muted-foreground">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Daily Activity Breakdown</CardTitle>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              Click a row to see full timeline
            </Badge>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-4 text-xs mt-1">
            <span className="flex items-center gap-1"><Package className="h-3 w-3 text-blue-500" /> Picklist Push</span>
            <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3 text-green-500" /> Picklist Reset</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-purple-500" /> Dashboard Time</span>
            <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3 text-orange-400" /> Packer Image Views</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading activity…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Activity className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No activity found in the last 7 days</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 bg-gray-50/80 border-r min-w-[210px]">
                      User
                    </th>
                    {(data?.days ?? []).map((day) => (
                      <th key={day} className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-[130px]">
                        {formatDate(day)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((user) => (
                    <UserRow
                      key={user.user_id}
                      user={user}
                      days={data?.days ?? []}
                      onClick={() => openDrilldown(user)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Activity Timeline
            </SheetTitle>
            <SheetDescription className="truncate">
              {selectedUser?.email}
            </SheetDescription>
          </SheetHeader>
          {selectedUser && (
            <UserTimeline userId={selectedUser.user_id} email={selectedUser.email} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
