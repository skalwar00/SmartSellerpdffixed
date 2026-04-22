import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/supabase/is-admin";
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

  // Role check — looks at JWT first, then falls back to authoritative DB
  // lookup so newly-promoted admins don't have to re-login.
  const isAdmin = await isUserAdmin(user);

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
