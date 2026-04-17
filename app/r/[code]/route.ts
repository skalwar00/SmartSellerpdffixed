import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const origin = request.nextUrl.origin

  const response = NextResponse.redirect(`${origin}/auth/sign-up`)
  response.cookies.set('ssp_ref', code.toUpperCase(), {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
    sameSite: 'lax',
  })
  return response
}
