import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('master_inventory')
    .select('id, master_sku, image_url, created_at')
    .eq('user_id', user.id)
    .order('master_sku', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { records } = body as { records: { master_sku: string; image_url?: string }[] }

  const toInsert = records.map(r => ({
    user_id: user.id,
    master_sku: r.master_sku.toUpperCase().trim(),
    image_url: r.image_url?.trim() || null,
  }))

  const { data, error } = await supabase
    .from('master_inventory')
    .upsert(toInsert, { onConflict: 'user_id, master_sku' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, inserted: toInsert.length })
}
