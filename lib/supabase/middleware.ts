import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Vercel's hard limit is ~16KB for total request headers.
// We only measure sb- cookies (Supabase session JWTs) since those grow large.
// We leave 2KB headroom for other headers.
const MAX_AUTH_COOKIE_SIZE = 14000

function getAuthCookieSize(request: NextRequest): number {
  return request.cookies.getAll().reduce((total, { name, value }) => {
    if (!name.startsWith('sb-')) return total
    return total + name.length + value.length + 2
  }, 0)
}

function clearAuthCookies(response: NextResponse, request: NextRequest) {
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-')) {
      response.cookies.set(name, '', { maxAge: 0, path: '/' })
    }
  })
}

/**
 * Filter out any sb- cookies whose values are truncated / invalid.
 * The Supabase library calls JSON.parse internally on cookie values — if a
 * cookie is corrupted it throws a SyntaxError that can bypass our try/catch
 * and crash the page with a 500. Stripping them here means Supabase never
 * sees bad data in the first place.
 * Handles both raw JSON cookies ({...}) and base64-encoded chunk cookies.
 */
function getSanitisedCookies(request: NextRequest) {
  return request.cookies.getAll().filter(({ name, value }) => {
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

    // Any other format — allow through (don't block legitimate non-JSON values)
    return true
  })
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  try {
    // Guard against bloated cookies causing HTTP 431 (REQUEST_HEADER_TOO_LARGE).
    // Only check on non-auth pages — if we also clear on /auth/login, the user
    // gets trapped in an infinite loop (login → cookies cleared → login → ...)
    // which eventually triggers Supabase's email rate limiter.
    const isAuthPage = pathname.startsWith('/auth')
    if (!isAuthPage) {
      const cookieSize = getAuthCookieSize(request)
      if (cookieSize > MAX_AUTH_COOKIE_SIZE) {
        const clearResponse = NextResponse.redirect(new URL('/auth/login', request.url))
        clearAuthCookies(clearResponse, request)
        return clearResponse
      }
    }

    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            // Use sanitised cookies so the Supabase library never receives
            // truncated JSON — prevents SyntaxError 500s on the login page.
            return getSanitisedCookies(request)
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, {
                ...options,
                // SameSite=None + Secure needed for cross-site iframe (Replit workspace)
                sameSite: 'none',
                secure: true,
              }),
            )
          },
        },
      },
    )

    // Read the session directly from cookies — no network call needed.
    let session = null
    try {
      const { data } = await supabase.auth.getSession()
      session = data.session
    } catch {
      // Remaining corrupted cookie that slipped through — clear and redirect.
      const clearResponse = NextResponse.redirect(new URL('/auth/login', request.url))
      clearAuthCookies(clearResponse, request)
      return clearResponse
    }

    // Redirect unauthenticated users away from protected routes
    if (!session && pathname.startsWith('/dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch {
    // Safety net — never let a middleware crash bubble up as a 500.
    const fallback = NextResponse.next({ request })
    clearAuthCookies(fallback, request)
    return fallback
  }
}
