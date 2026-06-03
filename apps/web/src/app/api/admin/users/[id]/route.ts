import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser }     from '@/lib/auth/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminRole, AccountStatus } from '@/types/admin'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  const db = createAdminClient() as any

  const [profileRes, bioRes, authRes, adminRes] = await Promise.all([
    db.from('profiles').select('*').eq('id', id).single(),
    db.from('biomarkers_static')
      .select('id, marker_name, value, unit, state, collected_at')
      .eq('user_id', id)
      .order('collected_at', { ascending: false })
      .limit(20),
    db.auth.admin.getUserById(id),
    db.from('admin_users').select('role').eq('user_id', id).maybeSingle(),
  ])

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const p = profileRes.data

  return NextResponse.json({
    id:                   p.id,
    email:                authRes.data?.user?.email                 ?? null,
    display_name:         p.display_name,
    full_name:            p.full_name,
    biological_profile:   p.biological_profile,
    user_profile:         p.user_profile,
    safety_status:        p.safety_status                          ?? 'active',
    onboarding_completed: p.onboarding_completed,
    account_status:       (p.account_status                        ?? 'active') as AccountStatus,
    suspended_at:         p.suspended_at                           ?? null,
    banned_at:            p.banned_at                              ?? null,
    disabled_at:          p.disabled_at                            ?? null,
    deleted_at:           p.deleted_at                             ?? null,
    moderation_reason:    p.moderation_reason                      ?? null,
    admin_role:           (adminRes.data?.role                     ?? null) as AdminRole | null,
    is_admin:             !!adminRes.data,
    birth_date:           p.birth_date,
    height_cm:            p.height_cm,
    weight_kg:            p.weight_kg,
    activity_level:       p.activity_level,
    hormonal_profile:     p.hormonal_profile,
    diet_pattern:         p.diet_pattern,
    body_goal_phase:      p.body_goal_phase,
    created_at:           p.created_at,
    updated_at:           p.updated_at,
    labs_count:           0,
    recentBiomarkers:     bioRes.data ?? [],
    recentActivity:       [],
  })
}
