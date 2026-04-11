import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existing } = await supabase
          .from('users_plan')
          .select('user_id, has_seen_onboarding')
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
          return NextResponse.redirect(`${origin}/onboarding`)
        } else if (!existing?.has_seen_onboarding) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
