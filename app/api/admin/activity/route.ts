import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    const since = new Date()
    since.setDate(since.getDate() - 6)
    since.setHours(0, 0, 0, 0)

    const [logsResult, authUsersResult] = await Promise.all([
      admin
        .from('user_activity_log')
        .select('user_id, event_type, metadata, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true }),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ])

    const emailMap: Record<string, string> = {}
    if (authUsersResult.data?.users) {
      for (const u of authUsersResult.data.users) {
        if (u.email) emailMap[u.id] = u.email
      }
    }

    const logs = logsResult.data ?? []

    type DaySummary = {
      pushCount: number
      pushSkuCount: number
      pushTotalQty: number
      resetCount: number
      resetCompletions: number
      resetRemainingQty: number
      pingCount: number
      imageViewCount: number
    }

    const userDayMap: Record<string, Record<string, DaySummary>> = {}

    for (const log of logs) {
      const userId = log.user_id
      const day = new Date(log.created_at).toISOString().slice(0, 10)

      if (!userDayMap[userId]) userDayMap[userId] = {}
      if (!userDayMap[userId][day]) {
        userDayMap[userId][day] = {
          pushCount: 0, pushSkuCount: 0, pushTotalQty: 0,
          resetCount: 0, resetCompletions: 0, resetRemainingQty: 0,
          pingCount: 0, imageViewCount: 0,
        }
      }

      const s = userDayMap[userId][day]
      const meta = (log.metadata as Record<string, number | boolean>) ?? {}

      if (log.event_type === 'picklist_push') {
        s.pushCount++
        s.pushSkuCount += Number(meta.sku_count ?? 0)
        s.pushTotalQty += Number(meta.total_qty ?? 0)
      } else if (log.event_type === 'picklist_reset') {
        s.resetCount++
        if (meta.is_complete) s.resetCompletions++
        s.resetRemainingQty += Number(meta.remaining_qty ?? 0)
      } else if (log.event_type === 'session_ping') {
        s.pingCount++
      } else if (log.event_type === 'image_view') {
        s.imageViewCount++
      }
    }

    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }

    const userIds = Array.from(new Set(logs.map(l => l.user_id)))

    const result = userIds.map(userId => ({
      user_id: userId,
      email: emailMap[userId] ?? userId.slice(0, 12) + '…',
      days: days.map(day => {
        const s = userDayMap[userId]?.[day]
        return {
          date: day,
          pushCount: s?.pushCount ?? 0,
          pushSkuCount: s?.pushSkuCount ?? 0,
          pushTotalQty: s?.pushTotalQty ?? 0,
          resetCount: s?.resetCount ?? 0,
          resetCompletions: s?.resetCompletions ?? 0,
          resetRemainingQty: s?.resetRemainingQty ?? 0,
          sessionMinutes: Math.round((s?.pingCount ?? 0) * 5),
          imageViewCount: s?.imageViewCount ?? 0,
        }
      }),
    }))

    return NextResponse.json({ days, users: result })
  } catch (err) {
    console.error('[admin/activity] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
