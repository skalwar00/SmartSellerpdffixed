import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function generateShortId(email: string): string {
  const prefix = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 7)
  const suffix = Math.random().toString(36).slice(2, 5)
  return `${prefix}${suffix}`
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const short_user_id = generateShortId(user.email || user.id)

  const { error } = await supabase
    .from('users_plan')
    .update({ short_user_id })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ short_user_id })
}
