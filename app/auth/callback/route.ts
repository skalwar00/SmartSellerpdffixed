import { createClient } from '@/lib/supabase/server'
import { migrateUserMetadata } from '@/lib/supabase/migrate-user-metadata'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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
      // Password reset flow — send user to set-new-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Provision trial plan for brand-new users
        const { data: existing } = await supabase
          .from('users_plan')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!existing) {
          const expiryDate = new Date()
          expiryDate.setDate(expiryDate.getDate() + 14)

          const cookieStore = await cookies()
          const refCode = cookieStore.get('ssp_ref')?.value ?? null

          await supabase.from('users_plan').insert({
            user_id: user.id,
            plan_type: 'trial',
            expiry_date: expiryDate.toISOString(),
            has_seen_onboarding: false,
            is_combo_enabled: false,
            referred_by: refCode,
          })
        }

        // Strip any large legacy fields from the JWT right away so the
        // session cookie never grows large enough to trigger HTTP 431.
        await migrateUserMetadata(supabase, user.id, user.user_metadata ?? {})
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // ✅ 2. OAuth / PKCE flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await migrateUserMetadata(supabase, user.id, user.user_metadata ?? {})
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // ❌ fallback
  return NextResponse.redirect(`${origin}/auth/error`)
}
