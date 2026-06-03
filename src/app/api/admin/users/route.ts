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

  const db = createAdminClient() as any

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

  // Early-exit: admin/role filter that resolves to no candidates
  if ((filterIsAdmin === 'true' || filterRole) && adminFilterIds!.length === 0) {
    return NextResponse.json({ users: [], total: 0, page, pageSize })
  }

  const validSortCols = new Set(['created_at', 'updated_at', 'full_name'])
  const col = validSortCols.has(sortBy) ? sortBy : 'created_at'

  // ── Build profile query ───────────────────────────────────────
  // account_status was added in migration 003_admin_moderation.sql.
  // If that migration has not yet been applied to this Supabase instance,
  // PostgREST returns error code 42703 (column does not exist).
  // We detect that and automatically retry without the moderation column so
  // that the users list continues to function while the migration is pending.
  function buildProfilesQuery(withAccountStatus: boolean) {
    const selectCols = withAccountStatus
      ? 'id, display_name, full_name, biological_profile, user_profile, safety_status, onboarding_completed, account_status, created_at, updated_at'
      : 'id, display_name, full_name, biological_profile, user_profile, safety_status, onboarding_completed, created_at, updated_at'

    let q = db.from('profiles').select(selectCols, { count: 'exact' })

    if (filterOnboarding !== null) q = q.eq('onboarding_completed', filterOnboarding === 'true')
    if (filterBioProfile)          q = q.eq('biological_profile',   filterBioProfile as 'male' | 'female')
    if (filterSafety)              q = q.eq('safety_status',        filterSafety as 'active' | 'medical_alert')
    if (filterUserProfile)         q = q.eq('user_profile',         filterUserProfile as 'bienestar' | 'optimizacion' | 'rendimiento' | 'condicion' | 'primer_paso')
    if (withAccountStatus && filterStatus) q = q.eq('account_status', filterStatus as string)

    if (filterIsAdmin === 'true' || filterRole) q = q.in('id', adminFilterIds!)

    q = q.order(col, { ascending: sortDir === 'asc' })
    q = q.range((page - 1) * pageSize, page * pageSize - 1)
    return q
  }

  let result = await buildProfilesQuery(true)

  // Fallback: moderation column not yet in DB — retry without account_status
  if (result.error && (result.error.code === '42703' || result.error.message?.includes('account_status'))) {
    console.warn('[admin/users] account_status column not found — migration 003 pending. Retrying without moderation columns.')
    result = await buildProfilesQuery(false)
  }

  if (result.error) {
    console.error('[admin/users] profiles query error:', result.error)
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  // Supabase infers column types from static select strings only.
  // buildProfilesQuery uses a runtime-conditional string, so TypeScript
  // produces a ParserError union. We escape via unknown then assert to the
  // known shared shape (account_status is optional — absent when the
  // moderation migration hasn't been applied yet).
  type ProfileRow = {
    id: string
    display_name:         string | null
    full_name:            string | null
    biological_profile:   string | null
    user_profile:         string | null
    safety_status:        string | null
    onboarding_completed: boolean | null
    account_status?:      string | null
    created_at:           string
    updated_at:           string | null
  }
  const profiles = (result.data as unknown as ProfileRow[]) ?? []
  const count = result.count

  const userIds = profiles.map(p => p.id)

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
    const labRows = (labData ?? []) as Array<{ user_id: string; collected_at: string }>
    const sessionSet = new Set<string>(labRows.map(b => `${b.user_id}__${b.collected_at.slice(0, 10)}`))
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
