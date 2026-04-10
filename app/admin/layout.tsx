import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNavbar } from "@/components/admin/navbar";
import { Toaster } from "@/components/ui/sonner";
import { Shield, AlertTriangle } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in
  if (!user) redirect("/auth/login");

  // ✅ FIXED: role-based admin check (instead of email)
  const isAdmin = user.user_metadata?.role === "admin";

  // Not admin → redirect
  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AdminNavbar adminEmail={user.email ?? ""} />
      <main className="flex-1">{children}</main>
      <Toaster />
    </div>
  );
}
