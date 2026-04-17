import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('picklist_items')
    .select('master_sku, total_qty, picked_qty, status, updated_at')
    .eq('user_id', user.id)
    .order('master_sku')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch shortage flags and remaining_stock (non-critical — silently skip if column missing)
  let shortageMap: Record<string, boolean> = {}
  let remainingStockMap: Record<string, number> = {}
  try {
    const { data: shortageData, error: shortageErr } = await supabase
      .from('picklist_items')
      .select('master_sku, shortage, remaining_stock')
      .eq('user_id', user.id)
    if (!shortageErr && shortageData) {
      shortageData.forEach((row: { master_sku: string; shortage?: boolean; remaining_stock?: number }) => {
        if (row.shortage) shortageMap[row.master_sku] = true
        if (row.remaining_stock && row.remaining_stock > 0) {
          remainingStockMap[row.master_sku] = row.remaining_stock
        }
      })
    }
  } catch { /* shortage/remaining_stock column may not exist yet — run migrations */ }

  const items = (data || []).map(item => ({
    ...item,
    shortage: shortageMap[item.master_sku] ?? false,
    remaining_stock: remainingStockMap[item.master_sku] ?? 0,
  }))

  return NextResponse.json({ items })
}
