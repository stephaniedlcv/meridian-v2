import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, logAdminAction } from '@/lib/auth/is-admin'
import { createAdminClient }            from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search              = searchParams.get('search')?.trim() ?? ''
  const filterOnboarding    = searchParams.get('onboarding')    // 'true' | 'false' | null
  const filterBioProfile    = searchParams.get('bio_profile')   // 'male' | 'female' | null
  const filterSafety        = searchParams.get('safety')        // 'active' | 'medical_alert' | null
  const filterUserProfile   = searchParams.get('user_profile')  // any UserProfile value
  const filterHasLabs       = searchParams.get('has_labs')      // 'true' | 'false' | null
  const sortBy              = searchParams.get('sort')   ?? 'created_at'
  const sortDir             = searchParams.get('dir')    ?? 'desc'
  const page                = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize            = 25

  const db = createAdminClient()

  // Build base profile query
  let q = db.from('profiles').select(
    'id, display_name, full_name, biological_profile, user_profile, safety_status, onboarding_completed, created_at, updated_at',
    { count: 'exact' }
  )

  if (filterOnboarding !== null) q = q.eq('onboarding_completed', filterOnboarding === 'true')
  if (filterBioProfile)          q = q.eq('biological_profile', filterBioProfile as 'male' | 'female')
  if (filterSafety)              q = q.eq('safety_status', filterSafety as 'active' | 'medical_alert')
  if (filterUserProfile)         q = q.eq('user_profile', filterUserProfile as 'bienestar' | 'optimizacion' | 'rendimiento' | 'condicion' | 'primer_paso')

  const validSortCols = new Set(['created_at', 'updated_at', 'full_name'])
  const col = validSortCols.has(sortBy) ? sortBy : 'created_at'
  q = q.order(col, { ascending: sortDir === 'asc' })
  q = q.range((page - 1) * pageSize, page * pageSize - 1)

  const { data: profiles, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (profiles ?? []).map(p => p.id)

  // Get auth emails for this page
  const emailMap: Record<string, string> = {}
  if (userIds.length > 0) {
    // auth.admin.listUsers doesn't support filtering by id set; fetch all then filter
    const { data: authList } = await db.auth.admin.listUsers({ perPage: 1000 })
    for (const u of authList?.users ?? []) {
      if (userIds.includes(u.id)) emailMap[u.id] = u.email ?? ''
    }
  }

  // Get labs count per user
  const labsMap: Record<string, number> = {}
  if (userIds.length > 0) {
    const { data: labData } = await db
      .from('biomarkers_static')
      .select('user_id, collected_at')
      .in('user_id', userIds)
    for (const row of labData ?? []) {
      const key = `${row.user_id}__${row.collected_at.slice(0, 10)}`
      if (!labsMap[row.user_id]) labsMap[row.user_id] = 0
      labsMap[`${row.user_id}__sessions`] = labsMap[`${row.user_id}__sessions`] ?? 0
    }
    const sessionSet = new Set((labData ?? []).map(b => `${b.user_id}__${b.collected_at.slice(0, 10)}`))
    for (const entry of sessionSet) {
      const uid = entry.split('__')[0]
      labsMap[uid] = (labsMap[uid] ?? 0) + 1
    }
  }

  // Text search (client-side on page, since profile names are in DB not auth)
  let rows = (profiles ?? []).map(p => ({
    id:                   p.id,
    email:                emailMap[p.id]          ?? null,
    display_name:         p.display_name          ?? null,
    full_name:            p.full_name             ?? null,
    biological_profile:   p.biological_profile    ?? null,
    user_profile:         p.user_profile          ?? null,
    safety_status:        p.safety_status,
    onboarding_completed: p.onboarding_completed,
    labs_count:           labsMap[p.id]           ?? 0,
    created_at:           p.created_at,
    updated_at:           p.updated_at            ?? null,
  }))

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

  return NextResponse.json({ users: rows, total: count ?? 0, page, pageSize })
}
