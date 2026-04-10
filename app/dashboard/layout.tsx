import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardNavbar } from '@/components/dashboard/navbar'
import { TrialBanner } from '@/components/dashboard/trial-banner'
import { Toaster } from '@/components/ui/sonner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: planData } = await supabase
    .from('users_plan')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const isTrialExpired = planData
    ? new Date(planData.expiry_date) < new Date()
    : true

  if (isTrialExpired && !planData) {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 14)
    await supabase.from('users_plan').insert({
      user_id: user.id,
      plan_type: 'trial',
      expiry_date: expiryDate.toISOString(),
    })
  } else if (isTrialExpired && planData?.plan_type !== 'pro') {
    redirect('/trial-expired')
  }

  const daysLeft = planData
    ? Math.max(
        0,
        Math.ceil(
          (new Date(planData.expiry_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0

  return (
    <div className="flex min-h-screen flex-col bg-[#F9FAFB]">
      <DashboardNavbar user={user} planData={planData} />
      <TrialBanner daysLeft={daysLeft} />
      <main className="flex-1">
        {children}
      </main>
      <Toaster />
    </div>
  )
}
