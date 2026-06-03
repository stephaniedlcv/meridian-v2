import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser }     from '@/lib/auth/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const db = createAdminClient() as any
  const { data, error } = await db
    .from('admin_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with admin user emails
  const activityRows = (data ?? []) as Array<Record<string, unknown> & { admin_user_id: string | null }>
  const adminIds = [...new Set(activityRows.map(l => l.admin_user_id).filter(Boolean))] as string[]
  const emailMap: Record<string, string> = {}
  if (adminIds.length > 0) {
    const { data: authList } = await db.auth.admin.listUsers({ perPage: 500 })
    for (const u of authList?.users ?? []) {
      if (adminIds.includes(u.id)) emailMap[u.id] = u.email ?? u.id.slice(0, 8)
    }
  }

  const enriched = activityRows.map(log => {
    const adminUserId = log.admin_user_id ?? ''

    return {
      ...log,
      admin_email: adminUserId ? emailMap[adminUserId] ?? adminUserId.slice(0, 8) : 'Unknown admin',
    }
  })

  return NextResponse.json({ logs: enriched })
}
