import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser }              from '@/lib/auth/is-admin'
import { createAdminClient }         from '@/lib/supabase/admin'
import type { AdminRole, AccountStatus } from '@/types/admin'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search            = searchParams.get('search')?.trim()        ?? ''
  const filterOnboarding  = searchParams.get('onboarding')            // 'true' | 'false' | null
  const filterBioProfile  = searchParams.get('bio_profile')
  const filterSafety      = searchParams.get('safety')
  const filterUserProfile = searchParams.get('user_profile')
  const filterHasLabs     = searchParams.get('has_labs')              // 'true' | 'false' | null
  const filterIsAdmin     = searchParams.get('is_admin')              // 'true' | 'false' | null
  const filterRole        = searchParams.get('role') as AdminRole | null
  const filterStatus      = searchParams.get('account_status') as AccountStatus | null
  const sortBy            = searchParams.get('sort')  ?? 'created_at'
  const sortDir           = searchParams.get('dir')   ?? 'desc'
  const page              = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize          = 25

  const db = createAdminClient()

  // ── Resolve admin-filter IDs ─────────────────────────────────
  // Fetch all admin_users up front (table is small — typically < 20 rows)
  const { data: allAdmins } = await db.from('admin_users').select('user_id, role')
  const adminRoleMap: Record<string, AdminRole> = {}
  for (const a of allAdmins ?? []) adminRoleMap[a.user_id] = a.role as AdminRole
  const adminIdSet = new Set(Object.keys(adminRoleMap))

  // Determine which user IDs satisfy the admin/role filter
  let adminFilterIds: string[] | null = null
  if (filterIsAdmin === 'true' || filterRole) {
    adminFilterIds = (allAdmins ?? [])
      .filter(a => !filterRole || a.role === filterRole)
      .map(a => a.user_id)
  } else if (filterIsAdmin === 'false') {
    adminFilterIds = [] // sentinel — will use NOT IN logic below
  }

  // ── Build profile query ───────────────────────────────────────
  let q = db.from('profiles').select(
    'id, display_name, full_name, biological_profile, user_profile, safety_status, onboarding_completed, account_status, created_at, updated_at',
    { count: 'exact' }
  )

  if (filterOnboarding !== null) q = q.eq('onboarding_completed', filterOnboarding === 'true')
  if (filterBioProfile)          q = q.eq('biological_profile',   filterBioProfile as 'male' | 'female')
  if (filterSafety)              q = q.eq('safety_status',        filterSafety as 'active' | 'medical_alert')
  if (filterUserProfile)         q = q.eq('user_profile',         filterUserProfile as 'bienestar' | 'optimizacion' | 'rendimiento' | 'condicion' | 'primer_paso')
  if (filterStatus)              q = q.eq('account_status',       filterStatus as string)

  // Apply admin membership filter
  if (filterIsAdmin === 'true' || filterRole) {
    if (adminFilterIds!.length === 0) {
      return NextResponse.json({ users: [], total: 0, page, pageSize })
    }
    q = q.in('id', adminFilterIds!)
  }
  // Note: NOT IN for filterIsAdmin === 'false' is handled post-fetch (see below)

  const validSortCols = new Set(['created_at', 'updated_at', 'full_name'])
  const col = validSortCols.has(sortBy) ? sortBy : 'created_at'
  q = q.order(col, { ascending: sortDir === 'asc' })
  q = q.range((page - 1) * pageSize, page * pageSize - 1)

  const { data: profiles, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (profiles ?? []).map(p => p.id)

  // ── Auth emails ───────────────────────────────────────────────
  const emailMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: authList } = await db.auth.admin.listUsers({ perPage: 1000 })
    for (const u of authList?.users ?? []) {
      if (userIds.includes(u.id)) emailMap[u.id] = u.email ?? ''
    }
  }

  // ── Labs count ────────────────────────────────────────────────
  const labsMap: Record<string, number> = {}
  if (userIds.length > 0) {
    const { data: labData } = await db
      .from('biomarkers_static')
      .select('user_id, collected_at')
      .in('user_id', userIds)
    const sessionSet = new Set((labData ?? []).map(b => `${b.user_id}__${b.collected_at.slice(0, 10)}`))
    for (const entry of sessionSet) {
      const uid = entry.split('__')[0]
      labsMap[uid] = (labsMap[uid] ?? 0) + 1
    }
  }

  // ── Assemble rows ─────────────────────────────────────────────
  let rows = (profiles ?? []).map(p => ({
    id:                   p.id,
    email:                emailMap[p.id]       ?? null,
    display_name:         p.display_name       ?? null,
    full_name:            p.full_name          ?? null,
    biological_profile:   p.biological_profile ?? null,
    user_profile:         p.user_profile       ?? null,
    safety_status:        p.safety_status      ?? 'active',
    onboarding_completed: p.onboarding_completed,
    account_status:       (p.account_status    ?? 'active') as AccountStatus,
    labs_count:           labsMap[p.id]        ?? 0,
    created_at:           p.created_at,
    updated_at:           p.updated_at         ?? null,
    admin_role:           adminRoleMap[p.id]   ?? null,
    is_admin:             adminIdSet.has(p.id),
  }))

  // Post-fetch: text search + has_labs + non-admin filter
  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(r =>
      r.email?.toLowerCase().includes(q) ||
      r.display_name?.toLowerCase().includes(q) ||
      r.full_name?.toLowerCase().includes(q)
    )
  }
  if (filterHasLabs !== null) {
    const wantLabs = filterHasLabs === 'true'
    rows = rows.filter(r => wantLabs ? r.labs_count > 0 : r.labs_count === 0)
  }
  if (filterIsAdmin === 'false') {
    rows = rows.filter(r => !r.is_admin)
  }

  return NextResponse.json({ users: rows, total: count ?? 0, page, pageSize })
}
