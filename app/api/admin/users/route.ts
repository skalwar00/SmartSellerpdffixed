import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/supabase/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !(await isUserAdmin(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const [
    { data: plans },
    { data: skuMappings },
    { data: picklistItems },
    authUsersResult,
  ] = await Promise.all([
    admin.from('users_plan').select('*').order('expiry_date', { ascending: false }),
    admin.from('sku_mapping').select('user_id'),
    admin.from('picklist_items').select('user_id'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const authEmailMap: Record<string, string> = {}
  const authCreatedMap: Record<string, string> = {}
  const authLastSignInMap: Record<string, string> = {}
  if (authUsersResult.data?.users) {
    for (const u of authUsersResult.data.users) {
      if (u.email) authEmailMap[u.id] = u.email
      authCreatedMap[u.id] = u.created_at
      if (u.last_sign_in_at) authLastSignInMap[u.id] = u.last_sign_in_at
    }
  }

  const skuCountMap: Record<string, number> = {}
  skuMappings?.forEach((r) => {
    skuCountMap[r.user_id] = (skuCountMap[r.user_id] ?? 0) + 1
  })

  const picklistCountMap: Record<string, number> = {}
  picklistItems?.forEach((r) => {
    picklistCountMap[r.user_id] = (picklistCountMap[r.user_id] ?? 0) + 1
  })

  const result = (plans ?? []).map((p) => ({
    ...p,
    email: authEmailMap[p.user_id] ?? null,
    created_at: authCreatedMap[p.user_id] ?? null,
    last_sign_in_at: authLastSignInMap[p.user_id] ?? null,
    sku_count: skuCountMap[p.user_id] ?? 0,
    picklist_count: picklistCountMap[p.user_id] ?? 0,
  }))

  return NextResponse.json(result)
}
