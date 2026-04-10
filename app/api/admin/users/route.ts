import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const [{ data: plans }, { data: payments }] = await Promise.all([
    admin.from('users_plan').select('*').order('expiry_date', { ascending: false }),
    admin.from('payment_requests').select('user_id, email'),
  ])

  const emailMap: Record<string, string> = {}
  payments?.forEach((p) => {
    if (p.user_id && p.email && !emailMap[p.user_id]) emailMap[p.user_id] = p.email
  })

  const result = (plans ?? []).map((p) => ({ ...p, email: emailMap[p.user_id] ?? null }))

  return NextResponse.json(result)
}
