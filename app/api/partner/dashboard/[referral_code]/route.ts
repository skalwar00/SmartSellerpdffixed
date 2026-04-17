import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ referral_code: string }> }
) {
  try {
    const { referral_code } = await params
    const supabase = createAdminClient()

    const { data: partner, error: pErr } = await supabase
      .from('partners')
      .select('*')
      .eq('referral_code', referral_code.toUpperCase())
      .maybeSingle()

    if (pErr || !partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const { data: commissions } = await supabase
      .from('partner_commissions')
      .select('*')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    const rows = commissions ?? []
    const totalEarned = rows.reduce((s, r) => s + r.commission_amount, 0)
    const pendingAmt  = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.commission_amount, 0)
    const paidAmt     = rows.filter(r => r.status === 'paid').reduce((s, r) => s + r.commission_amount, 0)
    const clientCount = new Set(rows.map(r => r.referred_user_id)).size

    const { count: totalReferred } = await supabase
      .from('users_plan')
      .select('user_id', { count: 'exact', head: true })
      .eq('referred_by', referral_code.toUpperCase())

    return NextResponse.json({
      partner,
      stats: {
        totalReferred: totalReferred ?? 0,
        clientsWithPayment: clientCount,
        totalEarned,
        pendingAmt,
        paidAmt,
      },
      commissions: rows,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
