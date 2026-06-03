import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, logAdminAction, hasPermission } from '@/lib/auth/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { countSegment }      from '@/lib/admin/count-segment'
import { getSegmentUserIds } from '@/lib/admin/get-segment-user-ids'
import type { TargetSegment, SegmentFilters } from '@/types/admin'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() as any
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let q = db.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const notifications = data ?? []
  if (notifications.length === 0) return NextResponse.json({ notifications: [] })

  // Fetch delivery stats from notification_recipients
  const notifIds = notifications.map(n => n.id)
  const { data: recipRows } = await db
    .from('notification_recipients')
    .select('notification_id, delivered, opened')
    .in('notification_id', notifIds)

  const stats: Record<string, { delivered_count: number; opened_count: number }> = {}
  for (const row of (recipRows ?? [])) {
    if (!stats[row.notification_id]) {
      stats[row.notification_id] = { delivered_count: 0, opened_count: 0 }
    }
    if (row.delivered) stats[row.notification_id].delivered_count++
    if (row.opened)    stats[row.notification_id].opened_count++
  }

  const enriched = notifications.map(n => ({
    ...n,
    delivered_count: stats[n.id]?.delivered_count ?? 0,
    opened_count:    stats[n.id]?.opened_count    ?? 0,
  }))

  return NextResponse.json({ notifications: enriched })
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

  const db = createAdminClient() as any
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

  const validStatuses = new Set(['draft', 'scheduled', 'sent', 'archived'])
  if (!validStatuses.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const db = createAdminClient() as any

  // ── Send action: resolve recipients and generate delivery rows ──────
  if (status === 'sent') {
    const { data: existing, error: fetchError } = await db
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    if (existing.status === 'sent') {
      return NextResponse.json({ error: 'Notification already sent' }, { status: 409 })
    }

    const userIds = await getSegmentUserIds(
      db,
      existing.target_segment as TargetSegment,
      existing.segment_filters as SegmentFilters | null,
    )

    const now = new Date().toISOString()

    if (userIds.length > 0) {
      const BATCH_SIZE = 500
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const chunk = userIds.slice(i, i + BATCH_SIZE)
        const rows  = chunk.map(userId => ({
          notification_id: id,
          user_id:         userId,
          delivered:       true,
          delivered_at:    now,
          opened:          false,
          clicked:         false,
        }))
        await db.from('notification_recipients').insert(rows)
      }
    }

    const { data, error } = await db
      .from('notifications')
      .update({
        status:          'sent',
        sent_at:         now,
        recipient_count: userIds.length,
        updated_at:      now,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAdminAction({
      adminUserId:  admin.userId,
      action:       'notification.sent',
      resourceType: 'notification',
      resourceId:   id,
      metadata:     { recipient_count: userIds.length },
    })

    return NextResponse.json({ notification: data })
  }

  // ── Standard status transition ─────────────────────────────────────
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
