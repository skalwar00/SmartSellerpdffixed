import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

function generateCode(name: string): string {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `${base}${rand}`
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone } = await req.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from('partners')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Email already registered as partner' }, { status: 409 })
    }

    const referral_code = generateCode(name)

    const { data, error } = await supabase
      .from('partners')
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        referral_code,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, referral_code: data.referral_code })
  } catch (err: unknown) {
    console.error('[partner/register] error:', err)
    const msg =
      err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
