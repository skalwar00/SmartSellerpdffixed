import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ short_user_id: string }> }
) {
  const { short_user_id } = await params
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const db = hasServiceRole ? createAdminClient() : await createClient()

  let userId: string | undefined
  if (!hasServiceRole) {
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Packer links require server database access' }, { status: 401 })
    }
    userId = user.id
  }

  let planQuery = db
    .from('users_plan')
    .select('user_id, security_pin')
    .eq('short_user_id', short_user_id)

  if (userId) {
    planQuery = planQuery.eq('user_id', userId)
  }

  const { data: planRow, error: planErr } = await planQuery.single()

  if (planErr || !planRow) {
    return NextResponse.json({ error: 'Invalid packer link' }, { status: 404 })
  }

  const { data: items, error: itemsErr } = await db
    .from('picklist_items')
    .select('master_sku, total_qty, picked_qty, status, updated_at')
    .eq('user_id', planRow.user_id)
    .order('master_sku')

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  return NextResponse.json({
    security_pin: planRow.security_pin,
    items: items || [],
  })
}
