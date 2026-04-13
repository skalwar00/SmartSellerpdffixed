'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, ShoppingBag } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function ComboSetupDialog() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState<'single' | 'combo' | null>(null)

  useEffect(() => {
    async function checkOnboarding() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: plan } = await supabase
        .from('users_plan')
        .select('has_seen_onboarding')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!plan || !plan.has_seen_onboarding) {
        setOpen(true)
      }
    }
    checkOnboarding()
  }, [])

  const handleSelection = async (isComboEnabled: boolean) => {
    const type = isComboEnabled ? 'combo' : 'single'
    setIsLoading(type)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await Promise.all([
          supabase.auth.updateUser({
            data: { has_seen_onboarding: true, is_combo_enabled: isComboEnabled },
          }),
          supabase
            .from('users_plan')
            .update({ has_seen_onboarding: true, is_combo_enabled: isComboEnabled })
            .eq('user_id', user.id),
        ])
      }
    } catch {
      // non-critical
    } finally {
      setIsLoading(null)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            One quick question
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Do you sell Combo / Bundle products?
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid grid-cols-2 gap-4">
          <button
            onClick={() => handleSelection(false)}
            disabled={isLoading !== null}
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-background p-6 text-center transition-all hover:border-blue-500 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 transition-colors group-hover:bg-blue-100">
              <ShoppingBag className="h-7 w-7 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {isLoading === 'single' ? 'Setting up...' : 'Only Single Items'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                I sell individual products
              </p>
            </div>
          </button>

          <button
            onClick={() => handleSelection(true)}
            disabled={isLoading !== null}
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-background p-6 text-center transition-all hover:border-purple-500 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 transition-colors group-hover:bg-purple-100">
              <Package className="h-7 w-7 text-purple-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {isLoading === 'combo' ? 'Setting up...' : 'Yes, Sell Combos'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                I bundle multiple items
              </p>
            </div>
          </button>
        </div>

        <p className="mt-1 text-center text-xs text-muted-foreground">
          You can change this anytime in Settings
        </p>
      </DialogContent>
    </Dialog>
  )
}
