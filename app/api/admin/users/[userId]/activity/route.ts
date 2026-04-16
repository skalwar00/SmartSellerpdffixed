import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId } = await params
  const admin = createAdminClient()

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: events, error } = await admin
    .from('user_activity_log')
    .select('event_type, metadata, created_at')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'table_missing' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const dayMap: Record<string, {
    date: string
    pushes: number
    skus_pushed: number
    qty_pushed: number
    resets: Array<{ total_qty: number; picked_qty: number; remaining_qty: number; is_complete: boolean; time: string }>
    session_pings: number
  }> = {}

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toLocaleDateString('en-CA')
  })

  for (const day of last7) {
    dayMap[day] = { date: day, pushes: 0, skus_pushed: 0, qty_pushed: 0, resets: [], session_pings: 0 }
  }

  for (const ev of events ?? []) {
    const day = new Date(ev.created_at).toLocaleDateString('en-CA')
    if (!dayMap[day]) continue
    const m = ev.metadata as Record<string, number | boolean | string> ?? {}

    if (ev.event_type === 'picklist_push') {
      dayMap[day].pushes += 1
      dayMap[day].skus_pushed += Number(m.sku_count ?? 0)
      dayMap[day].qty_pushed += Number(m.total_qty ?? 0)
    } else if (ev.event_type === 'picklist_reset') {
      dayMap[day].resets.push({
        total_qty: Number(m.total_qty ?? 0),
        picked_qty: Number(m.picked_qty ?? 0),
        remaining_qty: Number(m.remaining_qty ?? 0),
        is_complete: Boolean(m.is_complete),
        time: ev.created_at,
      })
    } else if (ev.event_type === 'session_ping') {
      dayMap[day].session_pings += 1
    }
  }

  const days = last7.map((d) => dayMap[d])

  return NextResponse.json({ days })
}
