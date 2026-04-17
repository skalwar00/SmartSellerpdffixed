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

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Guard against bloated cookies causing Vercel 494 (REQUEST_HEADER_TOO_LARGE).
  // Only check on non-auth pages — if we also clear on /auth/login, the user
  // gets trapped in an infinite loop (login → cookies cleared → login → ...) which
  // eventually triggers Supabase's email rate limiter and locks them out entirely.
  const isAuthPage = pathname.startsWith('/auth')
  if (!isAuthPage) {
    const cookieSize = getAuthCookieSize(request)
    if (cookieSize > MAX_AUTH_COOKIE_SIZE) {
      const clearResponse = NextResponse.redirect(new URL('/auth/login', request.url))
      clearAuthCookies(clearResponse, request)
      return clearResponse
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
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
    // Session cookie is corrupted — clear and redirect to login
    const clearResponse = NextResponse.redirect(new URL('/auth/login', request.url))
    clearAuthCookies(clearResponse, request)
    return clearResponse
  }

  // Redirect unauthenticated users away from protected routes
  if (
    !session &&
    pathname.startsWith('/dashboard')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
