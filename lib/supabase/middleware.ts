import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// If Supabase auth cookie size exceeds this, clear auth cookies to prevent Vercel 494 errors.
// Vercel's hard limit is ~16KB for total request headers. We only measure sb- cookies
// because those are the ones that grow large (JWT tokens) and cause 494s.
const MAX_AUTH_COOKIE_SIZE = 12000

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
  // Guard against bloated cookies causing Vercel 494 (REQUEST_HEADER_TOO_LARGE).
  // If cookies are already oversized, clear auth cookies and redirect to login so
  // the user can establish a fresh, correctly-sized session.
  const cookieSize = getAuthCookieSize(request)
  if (cookieSize > MAX_AUTH_COOKIE_SIZE) {
    const clearResponse = NextResponse.redirect(new URL('/auth/login', request.url))
    clearAuthCookies(clearResponse, request)
    return clearResponse
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

  // Use getSession() to read the session directly from cookies — no network call,
  // so auth checks are fast and reliable even if Supabase is momentarily unreachable.
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
    request.nextUrl.pathname.startsWith('/dashboard')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
