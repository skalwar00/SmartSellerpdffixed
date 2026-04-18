'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(prevState: { error: string | null }, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

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
