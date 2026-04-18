import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { mappings } = body as { mappings: { portal_sku: string; master_sku: string; combo_skus?: string[] }[] }

  if (!Array.isArray(mappings) || mappings.length === 0) {
    return NextResponse.json({ error: 'No mappings provided' }, { status: 400 })
  }

  const records = mappings.map(m => ({
    user_id: user.id,
    portal_sku: m.portal_sku.trim(),
    master_sku: m.master_sku.toUpperCase().trim(),
    combo_skus: m.combo_skus || [],
  }))

  const { error } = await supabase
    .from('sku_mapping')
    .upsert(records, { onConflict: 'user_id, portal_sku' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: records.length })
}
