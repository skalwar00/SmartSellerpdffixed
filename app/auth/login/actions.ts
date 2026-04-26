'use server'

import { createClient } from '@/lib/supabase/server'
import { migrateUserMetadata } from '@/lib/supabase/migrate-user-metadata'
import { redirect } from 'next/navigation'

export async function loginAction(prevState: { error: string | null }, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const msg = error.message
    if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
      return { error: 'Too many login attempts. Please wait a few minutes and try again.' }
    }
    if (msg.toLowerCase().includes('email not confirmed')) {
      return { error: 'Please confirm your email address first. Check your inbox for a verification link.' }
    }
    if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
      return { error: 'Incorrect email or password.' }
    }
    return { error: msg }
  }

  // Strip large legacy fields from the JWT immediately on login so the
  // session cookie never grows beyond ~14KB and trips the middleware's
  // size-guard (which would otherwise bounce the user back to /auth/login
  // in an infinite loop). Safe no-op for users that have already migrated.
  if (data?.user) {
    try {
      await migrateUserMetadata(supabase, data.user.id, data.user.user_metadata ?? {})
    } catch {
      // best-effort — never block login
    }

    // Always refresh the session after login (and after any metadata migration)
    // so the Set-Cookie header contains a fresh JWT that reflects the current
    // (stripped) metadata. Without this the login-time JWT — which still
    // carries the old large fields — is sent to the browser and the
    // middleware's cookie-size guard clears it, bouncing the user straight
    // back to /auth/login with no error message.
    try {
      await supabase.auth.refreshSession()
    } catch {
      // best-effort — if refresh fails we still proceed; middleware will
      // attempt a refresh on the next request.
    }
  }

  redirect('/dashboard')
}

export async function forgotPasswordAction(prevState: { error: string | null; sent: boolean }, formData: FormData) {
  const email = formData.get('email') as string
  if (!email) return { error: 'Email is required', sent: false }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:5000'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  })

  if (error) return { error: error.message, sent: false }
  return { error: null, sent: true }
}
