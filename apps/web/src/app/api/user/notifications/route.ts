import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ notifications: [] })

    const admin = createAdminClient() as any

    const { data: recipients, error } = await admin
      .from('notification_recipients')
      .select('id, notification_id, opened, opened_at, delivered, delivered_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !recipients || recipients.length === 0) {
      return NextResponse.json({ notifications: [] })
    }

    const notifIds = [...new Set(recipients.map(r => r.notification_id))]

    const { data: notifRows } = await admin
      .from('notifications')
      .select('id, title, body, type, created_at')
      .in('id', notifIds)

    const notifMap: Record<string, { id: string; title: string; body: string; type: string; created_at: string }> = {}
    for (const n of (notifRows ?? [])) {
      notifMap[n.id] = n
    }

    const notifications = recipients
      .filter(r => notifMap[r.notification_id])
      .map(r => {
        const n = notifMap[r.notification_id]
        return {
          id:         r.id,
          title:      n.title,
          body:       n.body,
          type:       n.type,
          read:       r.opened,
          opened_at:  r.opened_at,
          created_at: n.created_at,
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ notifications })
  } catch {
    return NextResponse.json({ notifications: [] })
  }
}
