import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canonicalizeSku } from '@/lib/sku-normalize'

interface PushItem {
  master_sku: string
  total_qty: number
}

interface PortalItem {
  portal_sku: string
  qty: number
}

function normalizeSku(value: string) {
  return canonicalizeSku(value.trim().toUpperCase())
}

function aggregateItems(items: PushItem[], forceUppercase = false) {
  const agg = new Map<string, PushItem>()

  for (const item of items) {
    const masterSku = forceUppercase ? normalizeSku(item.master_sku) : item.master_sku.trim()
    const qty = Number(item.total_qty) || 0
    if (!masterSku || qty <= 0) continue
    const key = normalizeSku(masterSku)
    const current = agg.get(key)
    if (current) current.total_qty += qty
    else agg.set(key, { master_sku: masterSku, total_qty: qty })
  }

  return Array.from(agg.values())
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { items, portalItems } = (await req.json()) as { items?: PushItem[]; portalItems?: PortalItem[] }
  let pushItems = items ? aggregateItems(items) : []
  const unmappedSkuSet = new Set<string>()
  const unmappedSkus: string[] = []

  if (pushItems.length === 0 && portalItems && portalItems.length > 0) {
    const { data: mappings } = await supabase
      .from('sku_mapping')
      .select('portal_sku, master_sku, combo_skus')
      .eq('user_id', user.id)

    const mappingDict: Record<string, string> = {}
    const comboSkusDict: Record<string, string[]> = {}
    mappings?.forEach((item) => {
      const key = normalizeSku(item.portal_sku)
      mappingDict[key] = normalizeSku(item.master_sku)
      if (item.combo_skus && item.combo_skus.length > 0) {
        comboSkusDict[key] = item.combo_skus
      }
    })

    const mappedItems = portalItems.flatMap((item) => {
      const portalSku = normalizeSku(item.portal_sku)
      const qty = Number(item.qty) || 0
      if (!portalSku || qty <= 0) return []

      const comboSkus = comboSkusDict[portalSku]

      if (comboSkus && comboSkus.length > 0) {
        return comboSkus
          .map((masterSku) => normalizeSku(masterSku))
          .filter(Boolean)
          .map((master_sku) => ({ master_sku, total_qty: qty }))
      }

      if (!mappingDict[portalSku]) {
        unmappedSkuSet.add(portalSku)
      }

      return [{ master_sku: mappingDict[portalSku] ?? portalSku, total_qty: qty }]
    })

    pushItems = aggregateItems(mappedItems, true)

    // Deduplicated list of unmapped SKUs (Set ensures each SKU appears once)
    unmappedSkus.push(...unmappedSkuSet)

    if (unmappedSkus.length > 0) {
      const { data: planRow } = await supabase
        .from('users_plan')
        .select('pending_unmapped_skus')
        .eq('user_id', user.id)
        .single()
      const existingUnmapped = (planRow?.pending_unmapped_skus as string[]) || []
      const merged = Array.from(new Set([...existingUnmapped, ...unmappedSkus]))
      await supabase
        .from('users_plan')
        .update({ pending_unmapped_skus: merged })
        .eq('user_id', user.id)
    }
  }

  if (pushItems.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 })
  }

  // Auto-cleanup: delete items older than 12 hours
  await supabase
    .from('picklist_items')
    .delete()
    .eq('user_id', user.id)
    .lt('updated_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())

  // Fetch existing items for this user
  const { data: existing } = await supabase
    .from('picklist_items')
    .select('master_sku, total_qty, picked_qty, status')
    .eq('user_id', user.id)

  const existingMap = new Map(
    (existing || []).map(e => [e.master_sku.toUpperCase(), e])
  )

  const toUpsert = pushItems.map(item => {
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

  const { error } = await supabase
    .from('picklist_items')
    .upsert(toUpsert, { onConflict: 'user_id,master_sku' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const totalQtyPushed = toUpsert.reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
  supabase.from('user_activity_log').insert({
    user_id: user.id,
    event_type: 'picklist_push',
    metadata: {
      sku_count: toUpsert.length,
      total_qty: totalQtyPushed,
      unmapped_count: unmappedSkus.length,
    },
  }).then(() => {})

  return NextResponse.json({ success: true, pushed: toUpsert.length, unmappedSkus })
}
