import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface PushItem {
  master_sku: string
  total_qty: number
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { items } = (await req.json()) as { items: PushItem[] }
  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Auto-cleanup: delete items older than 12 hours
  await admin
    .from('picklist_items')
    .delete()
    .eq('user_id', user.id)
    .lt('updated_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())

  // Fetch existing items for this user
  const { data: existing } = await admin
    .from('picklist_items')
    .select('master_sku, total_qty, picked_qty, status')
    .eq('user_id', user.id)

  const existingMap = new Map(
    (existing || []).map(e => [e.master_sku.toUpperCase(), e])
  )

  const toUpsert = items.map(item => {
    const key = item.master_sku.toUpperCase()
    const prev = existingMap.get(key)

    if (prev) {
      const newTotal = prev.total_qty + item.total_qty
      const wasPicked = prev.status === 'picked'
      const qtyIncreased = item.total_qty > 0
      return {
        user_id: user.id,
        master_sku: item.master_sku,
        total_qty: newTotal,
        picked_qty: prev.picked_qty,
        status: wasPicked && qtyIncreased ? 'updated' : prev.status,
      }
    }

    return {
      user_id: user.id,
      master_sku: item.master_sku,
      total_qty: item.total_qty,
      picked_qty: 0,
      status: 'pending',
    }
  })

  const { error } = await admin
    .from('picklist_items')
    .upsert(toUpsert, { onConflict: 'user_id,master_sku' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, pushed: toUpsert.length })
}
