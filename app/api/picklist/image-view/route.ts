import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { short_user_id, master_sku } = await req.json()

    if (!short_user_id || !master_sku) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: plan } = await admin
      .from('users_plan')
      .select('user_id')
      .eq('short_user_id', short_user_id)
      .single()

    if (!plan?.user_id) {
      return NextResponse.json({ ok: false }, { status: 404 })
    }

    await admin.from('user_activity_log').insert({
      user_id: plan.user_id,
      event_type: 'image_view',
      metadata: { master_sku, short_user_id },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[image-view]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
