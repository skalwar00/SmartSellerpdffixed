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
            if (!value) return false
            const trimmed = value.trimStart()

            // Raw JSON cookie — validate directly
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              try {
                JSON.parse(value)
                return true
              } catch {
                return false
              }
            }

            // Base64-encoded chunk cookie (e.g. "base64-xxxxxx") — decode and validate
            if (trimmed.startsWith('base64-')) {
              try {
                const b64 = trimmed.slice('base64-'.length)
                const decoded = Buffer.from(b64, 'base64').toString('utf-8')
                JSON.parse(decoded)
                return true
              } catch {
                return false
              }
            }

            return true
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
