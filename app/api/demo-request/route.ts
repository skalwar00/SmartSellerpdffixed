import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  company_name: z.string().min(1).max(200),
  mobile: z.string().min(10).max(15),
  email: z.string().email(),
  city: z.string().min(1).max(100),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('demo_requests').insert(parsed.data)

    if (error) {
      console.error('demo_requests insert error:', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('demo-request route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
