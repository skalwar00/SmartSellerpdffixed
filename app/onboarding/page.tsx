'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BarChart3, Package, ShoppingBag } from 'lucide-react'

export default function OnboardingPage() {
  const [isLoading, setIsLoading] = useState<'single' | 'combo' | null>(null)
  const router = useRouter()

  const handleSelection = async (isComboEnabled: boolean) => {
    const type = isComboEnabled ? 'combo' : 'single'
    setIsLoading(type)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Save to user metadata (works without DB migration)
    await supabase.auth.updateUser({
      data: {
        has_seen_onboarding: true,
        is_combo_enabled: isComboEnabled,
      },
    })

    // Also try saving to DB columns if migration has been run
    await supabase
      .from('users_plan')
      .update({
        has_seen_onboarding: true,
        is_combo_enabled: isComboEnabled,
      })
      .eq('user_id', user.id)

    router.push('/dashboard')
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">SmartSeller Suite</span>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome! One quick question.
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Do you sell Combo / Bundle products?
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => handleSelection(false)}
              disabled={isLoading !== null}
              className="group relative flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-background p-8 text-center transition-all hover:border-blue-500 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 transition-colors group-hover:bg-blue-100">
                <ShoppingBag className="h-8 w-8 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {isLoading === 'single' ? 'Setting up...' : 'No, Only Single Items'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  I sell individual products only
                </p>
              </div>
            </button>

            <button
              onClick={() => handleSelection(true)}
              disabled={isLoading !== null}
              className="group relative flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-background p-8 text-center transition-all hover:border-blue-500 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-50 transition-colors group-hover:bg-purple-100">
                <Package className="h-8 w-8 text-purple-500" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {isLoading === 'combo' ? 'Setting up...' : 'Yes, I sell Combos'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  I bundle multiple items together
                </p>
              </div>
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            You can change this later in your settings.
          </p>
        </div>
      </div>
    </div>
  )
}
