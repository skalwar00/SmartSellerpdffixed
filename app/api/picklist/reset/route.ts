import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: items } = await supabase
    .from('picklist_items')
    .select('total_qty, picked_qty, status')
    .eq('user_id', user.id)

  const { error } = await supabase
    .from('picklist_items')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (items && items.length > 0) {
    const totalQty = items.reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const pickedQty = items.reduce((s, i) => s + (Number(i.picked_qty) || 0), 0)
    const remainingQty = totalQty - pickedQty
    const isComplete = remainingQty === 0

    supabase.from('user_activity_log').insert({
      user_id: user.id,
      event_type: 'picklist_reset',
      metadata: {
        total_items: items.length,
        total_qty: totalQty,
        picked_qty: pickedQty,
        remaining_qty: remainingQty,
        is_complete: isComplete,
      },
    }).then(() => {})
  }

  return NextResponse.json({ success: true })
}
