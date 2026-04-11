'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Package,
  DollarSign,
  ShoppingBag,
  Shirt,
  CreditCard,
  LogOut,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface PlanData {
  id: string
  user_id: string
  plan_type: string
  expiry_date: string
  created_at: string
}

interface NavbarProps {
  user: SupabaseUser
  planData: PlanData | null
}

const navItems = [
  { title: 'Picklist', url: '/dashboard', icon: Package },
  { title: 'Costing Manager', url: '/dashboard/costing', icon: DollarSign },
  { title: 'Flipkart Profit', url: '/dashboard/flipkart', icon: ShoppingBag },
  { title: 'Myntra Profit', url: '/dashboard/myntra', icon: Shirt },
  { title: 'Subscription', url: '/dashboard/subscription', icon: CreditCard },
]

export function DashboardNavbar({ user, planData }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [daysLeft, setDaysLeft] = useState(0)

  useEffect(() => {
    setMounted(true)
    if (planData) {
      const diff = new Date(planData.expiry_date).getTime() - Date.now()
      setDaysLeft(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))))
    }
  }, [planData])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const isPro = planData?.plan_type === 'pro'
  const isExpiringSoon = mounted && daysLeft <= 5 && !isPro
  const userInitials = user.email?.slice(0, 2).toUpperCase() || 'U'

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-4 sm:px-6">

        {/* Left: Logo */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 shadow-sm">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <span className="hidden text-sm font-bold text-gray-900 sm:block">
            SmartSellerPick
          </span>
        </Link>

        {/* Center: Nav links (desktop) */}
        <div className="hidden items-center gap-0.5 md:flex">
          {navItems.map((item) => {
            const isActive =
              item.url === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.url)
            return (
              <Link
                key={item.url}
                href={item.url}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#E0E7FF] text-[#3B82F6]'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
                {item.title === 'Subscription' && isExpiringSoon && (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                )}
              </Link>
            )
          })}
        </div>

        {/* Right: Plan badge + User menu */}
        <div className="flex items-center gap-2">
          {mounted && (
            isPro ? (
              <Badge className="hidden bg-blue-500 text-white hover:bg-blue-500 sm:flex">
                Pro
              </Badge>
            ) : (
              <Badge
                variant={daysLeft <= 2 ? 'destructive' : 'secondary'}
                className="hidden sm:flex"
              >
                {daysLeft}d left
              </Badge>
            )
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 outline-none transition-all duration-200 hover:bg-gray-100">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-blue-500 text-white text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[160px] truncate text-xs font-medium sm:block">
                  {user.email}
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-gray-400 sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="border-b px-3 py-2.5">
                <p className="truncate text-xs font-semibold text-gray-900">{user.email}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {isPro
                    ? 'Pro Plan · Active'
                    : `Trial · ${mounted ? daysLeft : '…'}d left`}
                </p>
              </div>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/subscription">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Subscription
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:bg-red-50 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile nav — horizontal scroll */}
      <div className="flex overflow-x-auto border-t border-[#E5E7EB] px-3 py-1.5 gap-0.5 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const isActive =
            item.url === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.url)
          return (
            <Link
              key={item.url}
              href={item.url}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[#E0E7FF] text-[#3B82F6]'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.title}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
