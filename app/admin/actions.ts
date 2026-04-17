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

  // Fetch payment amount + user's referral info in parallel
  const [paymentRes, userPlanRes] = await Promise.all([
    supabase.from('payment_requests').select('amount, email').eq('id', paymentId).maybeSingle(),
    supabase.from('users_plan').select('referred_by').eq('user_id', userId).maybeSingle(),
  ])

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

  // ── Auto-create partner commission if user was referred ──────────────────
  const referralCode = userPlanRes.data?.referred_by
  const paymentAmount = paymentRes.data?.amount ?? 0
  const userEmail = paymentRes.data?.email ?? null

  if (referralCode && paymentAmount > 0) {
    try {
      const { data: partner } = await supabase
        .from('partners')
        .select('id, status')
        .eq('referral_code', referralCode)
        .maybeSingle()

      if (partner && partner.status === 'active') {
        // Count previous approved payments for this user to determine commission type
        const { count: prevApproved } = await supabase
          .from('payment_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'approved')

        const isFirst = (prevApproved ?? 0) <= 1 // current one just got approved so count is 1
        const commissionPercent = isFirst ? 50 : 15
        const commissionAmount = Math.round(paymentAmount * commissionPercent / 100)

        await supabase.from('partner_commissions').insert({
          partner_id: partner.id,
          payment_request_id: paymentId,
          referred_user_id: userId,
          referred_user_email: userEmail,
          commission_type: isFirst ? 'first' : 'recurring',
          payment_amount: paymentAmount,
          commission_percent: commissionPercent,
          commission_amount: commissionAmount,
          status: 'pending',
        })
      }
    } catch {
      // Commission creation failure should not block payment approval
    }
  }

  revalidatePath('/admin/payments')
  revalidatePath('/admin/partners')
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

export async function markDemoDone(id: string) {
  const supabase = createAdminClient()
  await supabase
    .from('demo_requests')
    .update({ status: 'done' })
    .eq('id', id)
  revalidatePath('/admin/demo-requests')
}

export async function markDemoPending(id: string) {
  const supabase = createAdminClient()
  await supabase
    .from('demo_requests')
    .update({ status: 'pending' })
    .eq('id', id)
  revalidatePath('/admin/demo-requests')
}

export async function deleteDemoRequest(id: string) {
  const supabase = createAdminClient()
  await supabase
    .from('demo_requests')
    .delete()
    .eq('id', id)
  revalidatePath('/admin/demo-requests')
}
