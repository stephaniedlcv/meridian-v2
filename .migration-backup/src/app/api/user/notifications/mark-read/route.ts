import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { id?: string; all?: boolean }
    const { id, all } = body

    const admin = createAdminClient()
    const now   = new Date().toISOString()

    if (all) {
      await admin
        .from('notification_recipients')
        .update({ opened: true, opened_at: now })
        .eq('user_id', user.id)
        .eq('opened', false)
    } else if (id) {
      await admin
        .from('notification_recipients')
        .update({ opened: true, opened_at: now })
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('opened', false)
    } else {
      return NextResponse.json({ error: 'Provide id or all:true' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
