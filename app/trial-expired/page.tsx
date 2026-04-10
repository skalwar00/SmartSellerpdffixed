'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, Lock, ArrowRight, CheckCircle2 } from 'lucide-react'

const features = [
  'Unlimited order processing & picklists',
  'Flipkart & Myntra P&L analysis',
  'Design-level costing manager',
  'Smart SKU fuzzy matching',
  'CSV & PDF export',
  'Priority email support',
]

export default function TrialExpiredPage() {
  const [showUpgrade, setShowUpgrade] = useState(false)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 shadow-lg">
            <BarChart3 className="h-7 w-7 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">SmartSeller Suite</span>
        </div>

        {!showUpgrade ? (
          <Card className="shadow-md border-0 ring-1 ring-slate-200">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <Lock className="h-8 w-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold">Your Trial Has Expired</h1>
              <p className="mt-2 text-muted-foreground">
                Your 14-day free trial has ended. Upgrade to Pro to continue
                managing your e-commerce operations.
              </p>

              <div className="mt-6 rounded-xl bg-slate-50 border p-5 text-left">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Pro Plan Includes
                </p>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setShowUpgrade(true)}
                >
                  Upgrade to Pro
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button asChild variant="ghost" className="w-full text-muted-foreground">
                  <Link href="/">Back to Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <UpgradeForm onBack={() => setShowUpgrade(false)} />
        )}
      </div>
    </div>
  )
}

function UpgradeForm({ onBack }: { onBack: () => void }) {
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <Card className="shadow-md border-0 ring-1 ring-slate-200">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold">Payment Submitted!</h2>
          <p className="mt-2 text-muted-foreground">
            We have received your payment screenshot. Our admin will verify and
            activate your plan within 24 hours. You will be notified via email.
          </p>
          <Button asChild className="mt-6 w-full" variant="outline">
            <Link href="/auth/login">Back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-md border-0 ring-1 ring-slate-200">
      <CardContent className="p-8">
        <button
          onClick={onBack}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          ← Back
        </button>
        <h2 className="text-xl font-bold">Upgrade to Pro</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete payment and upload screenshot for verification.
        </p>

        <div className="mt-5 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-5">
          <p className="text-sm font-semibold text-primary mb-3">Payment Details</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">Pro Plan — ₹999/month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">UPI ID</span>
              <span className="font-mono font-medium select-all">aavoni@upi</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank</span>
              <span className="font-medium">HDFC Bank</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account No.</span>
              <span className="font-mono font-medium select-all">XXXXXXXXXXXX</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IFSC</span>
              <span className="font-mono font-medium">HDFC0000000</span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium mb-2">
            Upload Payment Screenshot
          </label>
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              screenshot
                ? 'border-green-400 bg-green-50'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20'
            }`}
            onClick={() => document.getElementById('ss-upload')?.click()}
          >
            <input
              id="ss-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            />
            {screenshot ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium text-green-700">{screenshot.name}</p>
                <p className="text-xs text-muted-foreground">Click to change</p>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <ArrowRight className="h-5 w-5 rotate-[-90deg] text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Click to upload screenshot</p>
                <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
              </>
            )}
          </div>
        </div>

        <Button
          className="mt-5 w-full"
          size="lg"
          disabled={!screenshot}
          onClick={() => setSubmitted(true)}
        >
          Submit for Verification
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Your plan will be activated within 24 hours after admin verification.
        </p>
      </CardContent>
    </Card>
  )
}
