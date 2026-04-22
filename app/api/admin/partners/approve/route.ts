import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/supabase/is-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await isUserAdmin(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { partnerId, action } = await req.json()
    const admin = createAdminClient()

    const newStatus = action === 'approve' ? 'active'
      : action === 'suspend' ? 'suspended'
      : 'pending'

    const { error } = await admin
      .from('partners')
      .update({ status: newStatus })
      .eq('id', partnerId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
