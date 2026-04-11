import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { short_user_id, master_sku, picked_qty } = await req.json()

  if (!short_user_id || !master_sku || picked_qty === undefined) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Resolve user_id from short_user_id
  const { data: planRow, error: planErr } = await admin
    .from('users_plan')
    .select('user_id')
    .eq('short_user_id', short_user_id)
    .single()

  if (planErr || !planRow) {
    return NextResponse.json({ error: 'Invalid packer link' }, { status: 404 })
  }

  // Get current item
  const { data: item, error: itemErr } = await admin
    .from('picklist_items')
    .select('total_qty, picked_qty')
    .eq('user_id', planRow.user_id)
    .eq('master_sku', master_sku)
    .single()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const clamped = Math.max(0, Math.min(picked_qty, item.total_qty))
  const newStatus = clamped >= item.total_qty ? 'picked' : 'pending'

  const { error: updateErr } = await admin
    .from('picklist_items')
    .update({ picked_qty: clamped, status: newStatus })
    .eq('user_id', planRow.user_id)
    .eq('master_sku', master_sku)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, picked_qty: clamped, status: newStatus })
}
