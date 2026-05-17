import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, logAdminAction } from '@/lib/auth/is-admin'
import { createAdminClient }            from '@/lib/supabase/admin'

type ModerateAction = 'suspend' | 'ban' | 'disable' | 'soft_delete' | 'restore'
const VALID_ACTIONS: ModerateAction[] = ['suspend', 'ban', 'disable', 'soft_delete', 'restore']

type ProfileUpdate = {
  account_status:    string
  suspended_at?:     string | null
  banned_at?:        string | null
  disabled_at?:      string | null
  deleted_at?:       string | null
  moderation_reason?: string | null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // ── Auth: must be super_admin ──────────────────────────────────
  const acting = await getAdminUser()
  if (!acting)                       return NextResponse.json({ error: 'Unauthorized' },                  { status: 401 })
  if (acting.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 })

  const targetId = params.id

  // ── Prevent self-moderation ────────────────────────────────────
  if (targetId === acting.userId) {
    return NextResponse.json({ error: 'Cannot moderate your own account' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const action: ModerateAction = body.action  ?? ''
  const reason: string         = body.reason  ?? ''

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const db = createAdminClient()

  // ── Verify target user exists and fetch current state ──────────
  const { data: current } = await db
    .from('profiles')
    .select('id, account_status')
    .eq('id', targetId)
    .maybeSingle()

  if (!current) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const prevStatus = current.account_status ?? 'active'

  // ── Prevent moderating super_admins (except restore) ──────────
  if (action !== 'restore') {
    const { data: targetAdmin } = await db
      .from('admin_users')
      .select('role')
      .eq('user_id', targetId)
      .maybeSingle()

    if (targetAdmin?.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot moderate a super_admin account' }, { status: 403 })
    }
  }

  // ── Build typed update payload ─────────────────────────────────
  const now = new Date().toISOString()
  let update: ProfileUpdate
  let newStatus: string

  switch (action) {
    case 'suspend':
      newStatus = 'suspended'
      update    = { account_status: 'suspended', suspended_at: now, moderation_reason: reason || null }
      break

    case 'ban':
      newStatus = 'banned'
      update    = { account_status: 'banned', banned_at: now, moderation_reason: reason || null }
      break

    case 'disable':
      newStatus = 'disabled'
      update    = { account_status: 'disabled', disabled_at: now, moderation_reason: reason || null }
      break

    case 'soft_delete':
      newStatus = 'disabled'
      update    = { account_status: 'disabled', deleted_at: now, moderation_reason: reason || null }
      break

    case 'restore':
      newStatus = 'active'
      update    = {
        account_status:    'active',
        suspended_at:      null,
        banned_at:         null,
        disabled_at:       null,
        deleted_at:        null,
        moderation_reason: null,
      }
      break

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { error } = await db.from('profiles').update(update).eq('id', targetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    adminUserId:  acting.userId,
    action:       `user_${action}`,
    resourceType: 'user',
    resourceId:   targetId,
    metadata:     { previousStatus: prevStatus, newStatus, reason: reason || null },
  })

  return NextResponse.json({ ok: true, account_status: newStatus })
}
