import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, logAdminAction, hasPermission } from '@/lib/auth/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TargetSegment } from '@/types/admin'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let q = db.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ notifications: data ?? [] })
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(admin.role, 'notifications.write')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const { title, body: msgBody, type, target_segment, segment_filters, scheduled_for } = body

  if (!title?.trim() || !msgBody?.trim() || !type || !target_segment) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createAdminClient()

  // Count recipients for segment
  const recipientCount = await countSegment(db, target_segment as TargetSegment, segment_filters)

  const { data, error } = await db.from('notifications').insert({
    title:           title.trim(),
    body:            msgBody.trim(),
    type,
    status:          scheduled_for ? 'scheduled' : 'draft',
    target_segment,
    segment_filters: segment_filters ?? null,
    recipient_count: recipientCount,
    created_by:      admin.userId,
    scheduled_for:   scheduled_for ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    adminUserId:  admin.userId,
    action:       'notification.created',
    resourceType: 'notification',
    resourceId:   data.id,
    metadata:     { title, type, target_segment, recipient_count: recipientCount },
  })

  return NextResponse.json({ notification: data })
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(admin.role, 'notifications.write')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const { id, status } = body
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })

  const validStatuses = new Set(['draft', 'scheduled', 'archived'])
  if (!validStatuses.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('notifications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({ adminUserId: admin.userId, action: `notification.${status}`, resourceType: 'notification', resourceId: id })
  return NextResponse.json({ notification: data })
}

// ── Segment counting helper ───────────────────────────────────────
async function countSegment(
  db: ReturnType<typeof createAdminClient>,
  segment: TargetSegment,
  _filters?: Record<string, unknown>,
): Promise<number> {
  try {
    if (segment === 'all') {
      const { count } = await db.from('profiles').select('id', { count: 'exact', head: true })
      return count ?? 0
    }
    if (segment === 'onboarding_incomplete') {
      const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', false)
      return count ?? 0
    }
    if (segment === 'safety_alert') {
      const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('safety_status', 'medical_alert')
      return count ?? 0
    }
    if (segment === 'no_labs') {
      const { data: allIds } = await db.from('profiles').select('id')
      const { data: labIds } = await db.from('biomarkers_static').select('user_id')
      const withLabs = new Set((labIds ?? []).map(b => b.user_id))
      return (allIds ?? []).filter(p => !withLabs.has(p.id)).length
    }
    if (segment === 'active_7d') {
      const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
      const { data } = await db.from('biomarkers_static').select('user_id').gte('created_at', cutoff)
      return new Set((data ?? []).map(b => b.user_id)).size
    }
    return 0
  } catch { return 0 }
}
