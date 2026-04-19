import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Filter out any Supabase cookies whose values are invalid JSON
          // (truncated cookies from oversized-header situations cause
          //  "Unexpected end of JSON input" crashes in Server Components).
          return cookieStore.getAll().filter(({ name, value }) => {
            if (!name.startsWith('sb-')) return true
            // Only validate cookies that look like they hold JSON
            const trimmed = value.trimStart()
            if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return true
            try {
              JSON.parse(value)
              return true
            } catch {
              return false
            }
          })
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                // SameSite=None + Secure is required so cookies are sent
                // when the app is embedded inside the Replit workspace iframe
                // (cross-site context). Works on HTTPS in both dev and prod.
                sameSite: 'none',
                secure: true,
              }),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )
}
