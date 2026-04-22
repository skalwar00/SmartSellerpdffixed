import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@supabase/supabase-js'

/**
 * Returns true if the given auth user is an admin.
 *
 * Checks (in order):
 *   1. JWT user_metadata.role === 'admin'   (fast path — no network call)
 *   2. JWT app_metadata.role === 'admin'    (fast path)
 *   3. Authoritative lookup via service-role client against auth.users
 *      (covers the case where the role was set in the DB *after* the user's
 *      current session was issued, so the JWT cookie does not yet contain it).
 *
 * Using the admin client as a fallback means an admin who was promoted in the
 * database can immediately access /admin without having to sign out and back in.
 */
export async function isUserAdmin(user: Pick<User, 'id' | 'user_metadata' | 'app_metadata'> | null | undefined): Promise<boolean> {
  if (!user) return false

  if (user.user_metadata?.role === 'admin') return true
  if ((user.app_metadata as Record<string, unknown> | undefined)?.role === 'admin') return true

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.getUserById(user.id)
    if (error || !data?.user) return false
    const u = data.user
    if (u.user_metadata?.role === 'admin') return true
    if ((u.app_metadata as Record<string, unknown> | undefined)?.role === 'admin') return true
  } catch {
    // service role not configured / network error — deny
  }

  return false
}
