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

  const { data, error } = await admin
    .from('payment_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error?.code === '42P01') {
    return NextResponse.json({ error: 'table_not_found' }, { status: 404 })
  }

  return NextResponse.json(data ?? [])
}
