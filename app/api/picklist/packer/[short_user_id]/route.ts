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

  // Fetch shortage flags (non-critical — silently skip if column missing)
  let shortageMap: Record<string, boolean> = {}
  try {
    const { data: shortageData, error: shortageErr } = await db
      .from('picklist_items')
      .select('master_sku, shortage')
      .eq('user_id', planRow.user_id)
    if (!shortageErr && shortageData) {
      shortageData.forEach((row: { master_sku: string; shortage?: boolean }) => {
        if (row.shortage) shortageMap[row.master_sku] = true
      })
    }
  } catch { /* shortage column may not exist yet — run migration 008 */ }

  // Fetch image URLs from master_inventory (non-critical — silently skip if column missing)
  let imageMap: Record<string, string> = {}
  try {
    const skus = (items || []).map(i => i.master_sku)
    if (skus.length > 0) {
      const { data: inventory } = await db
        .from('master_inventory')
        .select('master_sku, image_url')
        .eq('user_id', planRow.user_id)
        .in('master_sku', skus)
      inventory?.forEach(row => {
        if (row.image_url) imageMap[row.master_sku] = row.image_url
      })
    }
  } catch { /* image_url column may not exist yet */ }

  const enrichedItems = (items || []).map(item => ({
    ...item,
    shortage: shortageMap[item.master_sku] ?? false,
    image_url: imageMap[item.master_sku] ?? null,
  }))

  // Fetch last "picklist_push" event time so the packer can see when the
  // manager last pushed orders (separate from the packer's own sync time).
  let lastPushedAt: string | null = null
  try {
    const { data: lastPush } = await db
      .from('user_activity_log')
      .select('created_at')
      .eq('user_id', planRow.user_id)
      .eq('event_type', 'picklist_push')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    lastPushedAt = lastPush?.created_at ?? null
  } catch { /* user_activity_log may not exist — non-critical */ }

  return NextResponse.json({
    security_pin: planRow.security_pin,
    items: enrichedItems,
    last_pushed_at: lastPushedAt,
  })
}
