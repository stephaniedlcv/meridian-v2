import { NextResponse }    from 'next/server'
import { createClient }   from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ count: 0 })

    // Use service role to bypass RLS on notification_recipients
    const admin = createAdminClient() as any
    const { count } = await admin
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('opened', false)

    return NextResponse.json({ count: count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
