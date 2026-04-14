import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabase = await createClient()

  // ✅ 1. Email verification flow
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: existing } = await supabase
          .from('users_plan')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!existing) {
          const expiryDate = new Date()
          expiryDate.setDate(expiryDate.getDate() + 14)

          await supabase.from('users_plan').insert({
            user_id: user.id,
            plan_type: 'trial',
            expiry_date: expiryDate.toISOString(),
            has_seen_onboarding: false,
            is_combo_enabled: false,
          })
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // ✅ 2. OAuth / PKCE flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // ❌ fallback
  return NextResponse.redirect(`${origin}/auth/error`)
}
