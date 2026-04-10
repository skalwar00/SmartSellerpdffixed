'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface TrialBannerProps {
  daysLeft: number
}

export function TrialBanner({ daysLeft }: TrialBannerProps) {
  if (daysLeft > 5) return null

  const isUrgent = daysLeft <= 2

  return (
    <div
      className={`flex items-center gap-3 border-b px-4 py-2.5 text-sm ${
        isUrgent
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-amber-50 border-amber-200 text-amber-800'
      }`}
    >
      <AlertTriangle className={`h-4 w-4 shrink-0 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`} />
      <span>
        {daysLeft === 0
          ? 'Your trial has expired.'
          : (
            <>
              Your trial expires in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>.
            </>
          )}{' '}
        <Link
          href="/dashboard/subscription"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          Upgrade to Pro
        </Link>{' '}
        to keep access to all features.
      </span>
    </div>
  )
}
