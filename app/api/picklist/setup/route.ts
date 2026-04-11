import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function generateShortId(email: string): string {
  const prefix = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 7)
  const suffix = Math.random().toString(36).slice(2, 5)
  return `${prefix}${suffix}`
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('users_plan')
    .select('short_user_id, security_pin')
    .eq('user_id', user.id)
    .single()

  if (existing?.short_user_id && existing?.security_pin) {
    return NextResponse.json({
      short_user_id: existing.short_user_id,
      security_pin: existing.security_pin,
    })
  }

  const short_user_id = generateShortId(user.email || user.id)
  const security_pin = generatePin()

  const { error } = await admin
    .from('users_plan')
    .update({ short_user_id, security_pin })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ short_user_id, security_pin })
}
