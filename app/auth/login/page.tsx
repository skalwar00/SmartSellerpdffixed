'use client'

import { loginAction, forgotPasswordAction } from './actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useActionState } from 'react'
import { useEffect, useState } from 'react'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login')

  const [loginState, loginFormAction, isLoginPending] = useActionState(loginAction, { error: null })
  const [forgotState, forgotFormAction, isForgotPending] = useActionState(forgotPasswordAction, { error: null, sent: false })

  useEffect(() => {
    setMode('login')
  }, [])

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2">
            <img
              src="/logo.png"
              alt="SSP Logo"
              className="h-11 w-11 object-contain"
            />
            <span className="text-xl font-bold">SmartSellerPick</span>
          </div>

          <Card>
            {mode === 'login' ? (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Welcome back</CardTitle>
                  <CardDescription>Sign in to your account to continue</CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={loginFormAction}>
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          required
                          autoComplete="email"
                        />
                      </div>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <button
                            type="button"
                            onClick={() => setMode('forgot')}
                            className="text-xs text-muted-foreground hover:text-primary underline underline-offset-4 transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          required
                          autoComplete="current-password"
                        />
                      </div>
                      {loginState?.error && (
                        <p className="text-sm text-destructive">{loginState.error}</p>
                      )}
                      <Button type="submit" className="w-full" disabled={isLoginPending}>
                        {isLoginPending ? 'Signing in…' : 'Sign in'}
                      </Button>
                    </div>
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                      Don&apos;t have an account?{' '}
                      <Link
                        href="/auth/sign-up"
                        className="text-primary underline underline-offset-4 hover:text-primary/80"
                      >
                        Sign up
                      </Link>
                    </div>
                  </form>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Reset password</CardTitle>
                  <CardDescription>
                    {forgotState?.sent
                      ? 'Check your inbox for the reset link'
                      : "Enter your email and we'll send a reset link"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {forgotState?.sent ? (
                    <div className="flex flex-col gap-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Reset link sent. Click the link in the email to set a new password.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setMode('login')}
                      >
                        Back to sign in
                      </Button>
                    </div>
                  ) : (
                    <form action={forgotFormAction}>
                      <div className="flex flex-col gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="reset-email">Email</Label>
                          <Input
                            id="reset-email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                          />
                        </div>
                        {forgotState?.error && (
                          <p className="text-sm text-destructive">{forgotState.error}</p>
                        )}
                        <Button type="submit" className="w-full" disabled={isForgotPending}>
                          {isForgotPending ? 'Sending…' : 'Send reset link'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setMode('login')}
                          className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4 transition-colors"
                        >
                          Back to sign in
                        </button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </>
            )}
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
