'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function upgradeToPro(userId: string) {
  const supabase = createAdminClient()
  const expiryDate = new Date()
  expiryDate.setFullYear(expiryDate.getFullYear() + 10)
  await supabase
    .from('users_plan')
    .update({ plan_type: 'pro', expiry_date: expiryDate.toISOString() })
    .eq('user_id', userId)
  revalidatePath('/admin/users')
  revalidatePath('/admin')
}

export async function downgradeToTrial(userId: string) {
  const supabase = createAdminClient()
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + 14)
  await supabase
    .from('users_plan')
    .update({ plan_type: 'trial', expiry_date: expiryDate.toISOString() })
    .eq('user_id', userId)
  revalidatePath('/admin/users')
  revalidatePath('/admin')
}

export async function extendTrial(userId: string, days: number) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users_plan')
    .select('expiry_date')
    .eq('user_id', userId)
    .single()

  const base = data?.expiry_date
    ? new Date(data.expiry_date) > new Date()
      ? new Date(data.expiry_date)
      : new Date()
    : new Date()

  base.setDate(base.getDate() + days)
  await supabase
    .from('users_plan')
    .update({ expiry_date: base.toISOString() })
    .eq('user_id', userId)
  revalidatePath('/admin/users')
}

export async function revokeAccess(userId: string) {
  const supabase = createAdminClient()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  await supabase
    .from('users_plan')
    .update({ expiry_date: yesterday.toISOString() })
    .eq('user_id', userId)
  revalidatePath('/admin/users')
}

export async function approvePayment(paymentId: string, userId: string) {
  const supabase = createAdminClient()
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + 30)

  await Promise.all([
    supabase
      .from('payment_requests')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', paymentId),
    supabase
      .from('users_plan')
      .update({ plan_type: 'pro', expiry_date: expiryDate.toISOString() })
      .eq('user_id', userId),
  ])
  revalidatePath('/admin/payments')
  revalidatePath('/admin')
}

export async function rejectPayment(paymentId: string, notes: string) {
  const supabase = createAdminClient()
  await supabase
    .from('payment_requests')
    .update({
      status: 'rejected',
      admin_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
  revalidatePath('/admin/payments')
  revalidatePath('/admin')
}
