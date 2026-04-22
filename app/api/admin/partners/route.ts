import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/supabase/is-admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await isUserAdmin(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: partners } = await admin
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: commissions } = await admin
      .from('partner_commissions')
      .select('*')
      .order('created_at', { ascending: false })

    return NextResponse.json({ partners: partners ?? [], commissions: commissions ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
