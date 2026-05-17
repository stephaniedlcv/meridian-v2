import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, logAdminAction, hasPermission } from '@/lib/auth/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { countSegment }      from '@/lib/admin/count-segment'
import type { TargetSegment, SegmentFilters } from '@/types/admin'

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
  const {
    title,
    body: msgBody,
    type,
    target_segment,
    segment_filters,
    scheduled_for,
  } = body as {
    title:           string
    body:            string
    type:            string
    target_segment:  TargetSegment
    segment_filters: SegmentFilters | null
    scheduled_for:   string | null
  }

  if (!title?.trim() || !msgBody?.trim() || !type || !target_segment) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createAdminClient()
  const recipientCount = await countSegment(db, target_segment, segment_filters)

  const { data, error } = await db.from('notifications').insert({
    title:           title.trim(),
    body:            msgBody.trim(),
    type,
    status:          scheduled_for ? 'scheduled' : 'draft',
    target_segment,
    segment_filters: (segment_filters as Record<string, unknown>) ?? null,
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
