import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, logAdminAction } from '@/lib/auth/is-admin'
import { createAdminClient }            from '@/lib/supabase/admin'
import type { AdminRole }               from '@/types/admin'

const VALID_ROLES: AdminRole[] = ['super_admin', 'admin', 'analyst', 'support', 'clinician_readonly']

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // ── Auth: must be super_admin ──────────────────────────────────
  const acting = await getAdminUser()
  if (!acting)                        return NextResponse.json({ error: 'Unauthorized' },          { status: 401 })
  if (acting.role !== 'super_admin')  return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 })

  const targetId = params.id

  // ── Prevent self-modification ──────────────────────────────────
  if (targetId === acting.userId) {
    return NextResponse.json({ error: 'Cannot modify your own admin access' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const action: string      = body.action ?? ''
  const newRole: AdminRole  = body.role   ?? ''
  const reason: string      = body.reason ?? ''

  const db = createAdminClient()

  // ── Fetch target's current admin record ────────────────────────
  const { data: existingAdmin } = await db
    .from('admin_users')
    .select('id, role')
    .eq('user_id', targetId)
    .maybeSingle()

  // ── Verify target user exists ──────────────────────────────────
  const { data: targetProfile } = await db
    .from('profiles')
    .select('id')
    .eq('id', targetId)
    .maybeSingle()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // ──────────────────────────────────────────────────────────────
  if (action === 'grant') {
    if (!VALID_ROLES.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (existingAdmin) {
      return NextResponse.json({ error: 'User already has admin access — use change_role' }, { status: 400 })
    }

    const { error } = await db.from('admin_users').insert({
      user_id:    targetId,
      role:       newRole,
      created_by: acting.userId,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAdminAction({
      adminUserId:  acting.userId,
      action:       'grant_admin_access',
      resourceType: 'user',
      resourceId:   targetId,
      metadata:     { role: newRole, reason },
    })

    return NextResponse.json({ ok: true, role: newRole })
  }

  // ──────────────────────────────────────────────────────────────
  if (action === 'revoke') {
    if (!existingAdmin) {
      return NextResponse.json({ error: 'User does not have admin access' }, { status: 400 })
    }

    // Protect the last super_admin
    if (existingAdmin.role === 'super_admin') {
      const { count } = await db
        .from('admin_users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin')
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'Cannot revoke the last super_admin' }, { status: 400 })
      }
    }

    const { error } = await db.from('admin_users').delete().eq('user_id', targetId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAdminAction({
      adminUserId:  acting.userId,
      action:       'revoke_admin_access',
      resourceType: 'user',
      resourceId:   targetId,
      metadata:     { previousRole: existingAdmin.role, reason },
    })

    return NextResponse.json({ ok: true })
  }

  // ──────────────────────────────────────────────────────────────
  if (action === 'change_role') {
    if (!VALID_ROLES.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (!existingAdmin) {
      return NextResponse.json({ error: 'User does not have admin access — use grant' }, { status: 400 })
    }
    if (existingAdmin.role === newRole) {
      return NextResponse.json({ ok: true, role: newRole }) // no-op
    }

    // Protect the last super_admin from being demoted
    if (existingAdmin.role === 'super_admin' && newRole !== 'super_admin') {
      const { count } = await db
        .from('admin_users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin')
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'Cannot demote the last super_admin' }, { status: 400 })
      }
    }

    const { error } = await db
      .from('admin_users')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('user_id', targetId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAdminAction({
      adminUserId:  acting.userId,
      action:       'change_admin_role',
      resourceType: 'user',
      resourceId:   targetId,
      metadata:     { previousRole: existingAdmin.role, newRole, reason },
    })

    return NextResponse.json({ ok: true, role: newRole })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
