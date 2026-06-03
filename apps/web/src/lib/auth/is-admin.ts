import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminRole }    from '@/types/admin'

// ── Role permission matrix ────────────────────────────────────────
const PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin:        ['*'],
  admin:              ['users.read','users.write','analytics.read','notifications.read','notifications.write','activity.read','experience.read','experience.write'],
  analyst:            ['users.read','analytics.read','activity.read'],
  support:            ['users.read','notifications.read'],
  clinician_readonly: ['users.read'],
}

export function hasPermission(role: AdminRole, action: string): boolean {
  const perms = PERMISSIONS[role] ?? []
  return perms.includes('*') || perms.includes(action)
}

// ── Core helpers ──────────────────────────────────────────────────

export async function getAdminUser(): Promise<{ userId: string; role: AdminRole } | null> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const admin = createAdminClient() as any
  const { data } = await admin
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!data) return null
  const adminRow = data as { role: AdminRole }
  return { userId: user.id, role: adminRow.role }
}

// Throws a Response (for use in Server Components / layouts)
export async function requireAdmin(): Promise<{ userId: string; role: AdminRole }> {
  const admin = await getAdminUser()
  if (!admin) throw new Error('ADMIN_UNAUTHORIZED')
  return admin
}

// ── Activity logging ──────────────────────────────────────────────
export async function logAdminAction(params: {
  adminUserId: string
  action: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  try {
    const admin = createAdminClient() as any
    await admin.from('admin_activity_logs').insert({
      admin_user_id: params.adminUserId,
      action:        params.action,
      resource_type: params.resourceType ?? null,
      resource_id:   params.resourceId  ?? null,
      metadata:      params.metadata    ?? null,
      ip_address:    params.ipAddress   ?? null,
    })
  } catch {
    // Non-fatal — don't let logging failures break operations
  }
}
