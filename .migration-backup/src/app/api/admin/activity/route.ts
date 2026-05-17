import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser }     from '@/lib/auth/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const db = createAdminClient()
  const { data, error } = await db
    .from('admin_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with admin user emails
  const adminIds = [...new Set((data ?? []).map(l => l.admin_user_id))]
  const emailMap: Record<string, string> = {}
  if (adminIds.length > 0) {
    const { data: authList } = await db.auth.admin.listUsers({ perPage: 500 })
    for (const u of authList?.users ?? []) {
      if (adminIds.includes(u.id)) emailMap[u.id] = u.email ?? u.id.slice(0, 8)
    }
  }

  const enriched = (data ?? []).map(log => ({
    ...log,
    admin_email: emailMap[log.admin_user_id] ?? log.admin_user_id.slice(0, 8),
  }))

  return NextResponse.json({ logs: enriched })
}
