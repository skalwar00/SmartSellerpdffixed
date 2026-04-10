'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Users, CreditCard, LayoutDashboard, ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users, exact: false },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard, exact: false },
]

export function AdminNavbar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-gray-950 text-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-wide">Admin Panel</span>
          <Badge variant="secondary" className="text-xs bg-blue-900/60 text-blue-200 border-blue-700 hidden sm:flex">
            SmartSeller Suite
          </Badge>
        </div>

        <nav className="flex items-center gap-1 flex-1">
          {navLinks.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden text-xs text-gray-400 sm:block truncate max-w-[160px]">{adminEmail}</span>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to App
          </Link>
        </div>
      </div>
    </header>
  )
}
