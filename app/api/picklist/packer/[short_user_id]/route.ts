import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ short_user_id: string }> }
) {
  const { short_user_id } = await params
  const admin = createAdminClient()

  const { data: planRow, error: planErr } = await admin
    .from('users_plan')
    .select('user_id, security_pin')
    .eq('short_user_id', short_user_id)
    .single()

  if (planErr || !planRow) {
    return NextResponse.json({ error: 'Invalid packer link' }, { status: 404 })
  }

  const { data: items, error: itemsErr } = await admin
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
