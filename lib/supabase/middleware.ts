import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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

  let session = null
  try {
    const { data } = await supabase.auth.getSession()
    session = data.session
  } catch {
    // Cookies are corrupted / too large — clear all Supabase auth cookies and
    // send the user to login so a fresh session can be established.
    const clearResponse = NextResponse.redirect(new URL('/auth/login', request.url))
    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith('sb-')) {
        clearResponse.cookies.set(name, '', { maxAge: 0, path: '/' })
      }
    })
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
