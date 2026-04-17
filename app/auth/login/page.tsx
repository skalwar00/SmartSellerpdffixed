"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (data.user) {
        router.refresh();
        window.location.href = "/dashboard";
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "An error occurred";
      if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many")) {
        setError("Too many login attempts. Please wait a few minutes and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setResetSent(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "An error occurred";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

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
            {mode === "login" ? (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Welcome back</CardTitle>
                  <CardDescription>Sign in to your account to continue</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin}>
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <button
                            type="button"
                            onClick={() => { setMode("forgot"); setError(null); }}
                            className="text-xs text-muted-foreground hover:text-primary underline underline-offset-4 transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <Input
                          id="password"
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Signing in..." : "Sign in"}
                      </Button>
                    </div>
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                      Don&apos;t have an account?{" "}
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
                    {resetSent
                      ? "Check your inbox for the reset link"
                      : "Enter your email and we'll send a reset link"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {resetSent ? (
                    <div className="flex flex-col gap-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Reset link sent to <span className="font-medium text-foreground">{email}</span>.
                        Click the link in the email to set a new password.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => { setMode("login"); setResetSent(false); }}
                      >
                        Back to sign in
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword}>
                      <div className="flex flex-col gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="reset-email">Email</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="you@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <Button type="submit" className="w-full" disabled={isLoading}>
                          {isLoading ? "Sending..." : "Send reset link"}
                        </Button>
                        <button
                          type="button"
                          onClick={() => { setMode("login"); setError(null); }}
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
  );
}
