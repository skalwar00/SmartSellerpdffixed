'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  ArrowRight,
  Crown,
  Zap,
  Upload,
  Loader2,
  Copy,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'

const proFeatures = [
  'Unlimited orders',
  'All platforms (Flipkart, Myntra, Meesho)',
  'Smart fuzzy SKU matching',
  'PDF picklist generation',
  'Design-level costing',
  'Profit analysis & breakdown',
  'CSV & PDF export',
  'Priority email support',
]

const plans = [
  {
    id: '1month',
    label: '1 Month',
    price: 3000,
    per: 'month',
    badge: null,
    saving: null,
  },
  {
    id: '3month',
    label: '3 Months',
    price: 7000,
    per: '3 months',
    badge: 'Save ₹2,000',
    saving: '₹2,000 saved vs monthly',
  },
  {
    id: 'yearly',
    label: 'Yearly',
    price: 18000,
    per: 'year',
    badge: 'Best Value',
    saving: '₹18,000 saved vs monthly',
  },
]

type Step = 'plans' | 'payment' | 'success'

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`))
}

export default function SubscriptionPage() {
  const [step, setStep] = useState<Step>('plans')
  const [selectedPlan, setSelectedPlan] = useState(plans[0])
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(true)

  useEffect(() => {
    async function fetchPlan() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('users_plan')
          .select('plan_type')
          .eq('user_id', user.id)
          .single()
        setIsPro(data?.plan_type === 'pro')
      } catch {
        // ignore
      } finally {
        setLoadingPlan(false)
      }
    }
    fetchPlan()
  }, [])

  const handleSubmit = async () => {
    if (!screenshot) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('You must be signed in'); return }

      const ext = screenshot.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      let screenshotUrl: string | null = null

      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(path, screenshot, { upsert: true })

      if (uploadError) {
        console.warn('Screenshot upload failed:', uploadError.message)
      } else {
        screenshotUrl = path
      }

      const { error: insertError } = await supabase.from('payment_requests').insert({
        user_id: user.id,
        email: user.email,
        amount: selectedPlan.price,
        screenshot_url: screenshotUrl,
        status: 'pending',
      })

      if (insertError) {
        console.warn('Payment request save failed:', insertError.message)
        toast.warning('Payment submitted, but tracking could not save it. Please WhatsApp us the screenshot too.')
      } else {
        toast.success('Payment submitted! We will verify within 24 hours.')
      }

      setStep('success')
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <DashboardHeader title="Subscription" description="Manage your plan and billing" />

      <div className="flex flex-1 flex-col gap-8 p-6">

        {/* ── PLANS STEP ── */}
        {step === 'plans' && (
          <>
            <div className="text-center">
              <h2 className="text-2xl font-bold">Choose Your Plan</h2>
              <p className="mt-1 text-muted-foreground">
                Simple, transparent pricing for Indian e-commerce sellers
              </p>
            </div>

            {loadingPlan ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isPro ? (
              /* ── Already Pro ── */
              <div className="mx-auto w-full max-w-sm">
                <Card className="border-2 border-primary shadow-md">
                  <CardContent className="p-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <Crown className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">You're on Pro!</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Enjoy unlimited access to all SmartSeller Suite features.
                    </p>
                    <ul className="mt-6 space-y-2 text-left">
                      {proFeatures.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button className="mt-6 w-full" disabled variant="outline">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                      Current Plan (Pro)
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* ── Not Pro — show plan selector ── */
              <div className="mx-auto w-full max-w-4xl space-y-6">
                {/* Free trial note */}
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 shrink-0" />
                  You are currently on the <span className="font-medium text-foreground">14-day Free Trial</span>. Upgrade below to keep full access.
                </div>

                {/* Pro plan cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {plans.map((plan) => {
                    const isSelected = selectedPlan.id === plan.id
                    return (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-md'
                            : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                        }`}
                      >
                        {plan.badge && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge className={`px-3 py-0.5 text-xs ${plan.badge === 'Best Value' ? 'bg-amber-500 hover:bg-amber-500' : ''}`}>
                              {plan.badge === 'Best Value' && <Star className="mr-1 h-3 w-3" />}
                              {plan.badge}
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-3">
                          <Crown className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className="font-semibold">{plan.label}</span>
                        </div>
                        <div className="mb-1">
                          <span className="text-2xl font-bold">₹{plan.price.toLocaleString('en-IN')}</span>
                          <span className="text-sm text-muted-foreground"> / {plan.per}</span>
                        </div>
                        {plan.saving && (
                          <p className="text-xs text-green-600 font-medium mt-1">{plan.saving}</p>
                        )}
                        {!plan.saving && (
                          <p className="text-xs text-muted-foreground mt-1">Standard rate</p>
                        )}
                        {isSelected && (
                          <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Selected
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Features included */}
                <Card className="border">
                  <CardContent className="p-5">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      All Pro plans include
                    </p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {proFeatures.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setStep('payment')}
                >
                  Continue with {selectedPlan.label} — ₹{selectedPlan.price.toLocaleString('en-IN')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── PAYMENT STEP ── */}
        {step === 'payment' && (
          <div className="mx-auto w-full max-w-lg space-y-6">
            <div>
              <button
                onClick={() => setStep('plans')}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
              >
                ← Back to Plans
              </button>
              <h2 className="text-xl font-bold">Complete Your Payment</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pay via UPI or bank transfer, then upload your payment screenshot below.
              </p>
            </div>

            <Card className="border-2 border-primary/30">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Pro Plan — {selectedPlan.label} — ₹{selectedPlan.price.toLocaleString('en-IN')}
                </p>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'UPI ID', value: 'aavoni@upi' },
                    { label: 'Bank Name', value: 'HDFC Bank' },
                    { label: 'Account No.', value: 'XXXXXXXXXXXX' },
                    { label: 'IFSC Code', value: 'HDFC0000000' },
                    { label: 'Account Name', value: 'Aavoni Technologies' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <span className="text-muted-foreground">{label}</span>
                      <button
                        className="flex items-center gap-1.5 font-mono font-semibold hover:text-primary transition-colors group"
                        onClick={() => copyToClipboard(value, label)}
                        title="Click to copy"
                      >
                        {value}
                        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div>
              <p className="text-sm font-medium mb-2">Upload Payment Screenshot</p>
              <div
                onClick={() => document.getElementById('pay-screenshot')?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  screenshot
                    ? 'border-green-400 bg-green-50'
                    : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20'
                }`}
              >
                <input
                  id="pay-screenshot"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                />
                {screenshot ? (
                  <>
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                    <p className="text-sm font-semibold text-green-700">{screenshot.name}</p>
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Click to upload screenshot</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 10 MB</p>
                  </>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!screenshot || uploading}
              onClick={handleSubmit}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit for Verification
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Your plan will be activated within 24 hours after our admin verifies your payment.
            </p>
          </div>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === 'success' && (
          <div className="mx-auto w-full max-w-md text-center">
            <Card className="shadow-sm">
              <CardContent className="p-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-9 w-9 text-green-600" />
                </div>
                <h2 className="text-xl font-bold">Payment Submitted!</h2>
                <p className="mt-2 text-muted-foreground">
                  Thank you! Our admin will verify your payment and activate your
                  Pro plan within 24 hours. You&apos;ll receive a confirmation on your
                  registered email.
                </p>
                <Button
                  className="mt-6 w-full"
                  variant="outline"
                  onClick={() => setStep('plans')}
                >
                  Back to Plans
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </>
  )
}
