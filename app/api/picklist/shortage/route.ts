import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { short_user_id, master_sku, shortage, available_qty } = await req.json()

  if (!short_user_id || !master_sku || shortage === undefined) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const db = hasServiceRole ? createAdminClient() : await createClient()

  let userId: string | undefined
  if (!hasServiceRole) {
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Server database access required' }, { status: 401 })
    }
    userId = user.id
  }

  let planQuery = db
    .from('users_plan')
    .select('user_id')
    .eq('short_user_id', short_user_id)

  if (userId) planQuery = planQuery.eq('user_id', userId)

  const { data: planRow, error: planErr } = await planQuery.single()
  if (planErr || !planRow) {
    return NextResponse.json({ error: 'Invalid packer link' }, { status: 404 })
  }

  if (!shortage) {
    // Clearing shortage — reset flags and remaining_stock
    const updatePayload: Record<string, unknown> = { shortage: false, remaining_stock: 0 }

    const { error: updateErr } = await db
      .from('picklist_items')
      .update(updatePayload)
      .eq('user_id', planRow.user_id)
      .eq('master_sku', master_sku)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, master_sku, shortage: false, remaining_stock: 0 })
  }

  // Reporting stock — check if available_qty > total_qty (excess) or < total_qty (shortage)
  const { data: item, error: itemErr } = await db
    .from('picklist_items')
    .select('total_qty')
    .eq('user_id', planRow.user_id)
    .eq('master_sku', master_sku)
    .single()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const avail = typeof available_qty === 'number' ? available_qty : 0
  const totalQty: number = item.total_qty

  let updatePayload: Record<string, unknown>
  let remainingStock = 0
  let isShortage = true

  if (avail >= totalQty) {
    // Packer has enough (or more) stock — fulfill the order and track excess
    remainingStock = avail - totalQty
    isShortage = false
    updatePayload = {
      shortage: false,
      picked_qty: totalQty,
      status: 'picked',
      remaining_stock: remainingStock,
    }
  } else {
    // Packer has less stock than needed — genuine shortage
    remainingStock = 0
    isShortage = true
    updatePayload = {
      shortage: true,
      picked_qty: avail,
      status: 'pending',
      remaining_stock: 0,
    }
  }

  try {
    const { error: updateErr } = await db
      .from('picklist_items')
      .update(updatePayload)
      .eq('user_id', planRow.user_id)
      .eq('master_sku', master_sku)

    if (updateErr) {
      // Try without remaining_stock if column doesn't exist yet
      const { remaining_stock: _rs, ...fallbackPayload } = updatePayload
      const { error: fallbackErr } = await db
        .from('picklist_items')
        .update(fallbackPayload)
        .eq('user_id', planRow.user_id)
        .eq('master_sku', master_sku)
      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 })
      }
    }
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    master_sku,
    shortage: isShortage,
    remaining_stock: remainingStock,
    picked_qty: isShortage ? avail : totalQty,
    status: isShortage ? 'pending' : 'picked',
  })
}
