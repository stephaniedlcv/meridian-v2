import { createAdminClient }    from '@/lib/supabase/admin'
import type { TargetSegment, SegmentFilters } from '@/types/admin'

type AdminDB = ReturnType<typeof createAdminClient>

/**
 * Counts recipients for a given target segment + optional filters.
 * Used by both the notification-creation route and the live audience-count endpoint.
 * All counting is server-side; clients never drive recipient selection.
 */
export async function countSegment(
  db:       AdminDB,
  segment:  TargetSegment,
  filters?: SegmentFilters | Record<string, unknown> | null,
): Promise<number> {
  const f = (filters ?? {}) as SegmentFilters

  try {
    // ── Atomic segments ──────────────────────────────────────────────
    if (segment === 'all') {
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
      return count ?? 0
    }

    if (segment === 'female_only') {
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('biological_profile', 'female')
      return count ?? 0
    }

    if (segment === 'male_only') {
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('biological_profile', 'male')
      return count ?? 0
    }

    if (segment === 'admins_only') {
      const { count } = await db
        .from('admin_users')
        .select('id', { count: 'exact', head: true })
      return count ?? 0
    }

    if (segment === 'non_admins') {
      const { data: allProfiles }  = await db.from('profiles').select('id')
      const { data: adminRecords } = await db.from('admin_users').select('user_id')
      const adminSet = new Set((adminRecords ?? []).map(a => a.user_id))
      return (allProfiles ?? []).filter(p => !adminSet.has(p.id)).length
    }

    if (segment === 'specific_users') {
      return (f.specific_user_ids ?? []).length
    }

    if (segment === 'onboarding_incomplete') {
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('onboarding_completed', false)
      return count ?? 0
    }

    if (segment === 'safety_alert') {
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('safety_status', 'medical_alert')
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
      const { data } = await db
        .from('biomarkers_static')
        .select('user_id')
        .gte('created_at', cutoff)
      return new Set((data ?? []).map(b => b.user_id)).size
    }

    if (segment === 'wearable_connected') {
      // Future: query wearable connections table
      return 0
    }

    // ── Custom combinations ──────────────────────────────────────────
    if (segment === 'custom') {
      // Start from all profiles, then apply each active filter
      // For has_labs=false we need set-subtraction so handle that separately
      if (f.has_labs === false) {
        let { data: base } = await db.from('profiles').select('id')
        if (f.biological_profile) {
          const { data: bp } = await db
            .from('profiles')
            .select('id')
            .eq('biological_profile', f.biological_profile)
          const bpSet = new Set((bp ?? []).map(p => p.id))
          base = (base ?? []).filter(p => bpSet.has(p.id))
        }
        const { data: labIds } = await db.from('biomarkers_static').select('user_id')
        const withLabs = new Set((labIds ?? []).map(b => b.user_id))
        let result = (base ?? []).filter(p => !withLabs.has(p.id))
        if (f.onboarding_incomplete) {
          const { data: inc } = await db.from('profiles').select('id').eq('onboarding_completed', false)
          const incSet = new Set((inc ?? []).map(p => p.id))
          result = result.filter(p => incSet.has(p.id))
        }
        if (f.active_7d) {
          const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
          const { data: act } = await db.from('biomarkers_static').select('user_id').gte('created_at', cutoff)
          const actSet = new Set((act ?? []).map(b => b.user_id))
          result = result.filter(p => actSet.has(p.id))
        }
        return result.length
      }

      // Base query with direct Supabase filters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db.from('profiles').select('id', { count: 'exact', head: true })
      if (f.biological_profile)   q = q.eq('biological_profile', f.biological_profile)
      if (f.onboarding_incomplete) q = q.eq('onboarding_completed', false)

      if (f.has_labs === true) {
        const { data: labIds } = await db.from('biomarkers_static').select('user_id')
        const ids = [...new Set((labIds ?? []).map(b => b.user_id))]
        if (ids.length === 0) return 0
        q = q.in('id', ids)
      }

      if (f.active_7d) {
        const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
        const { data: act } = await db.from('biomarkers_static').select('user_id').gte('created_at', cutoff)
        const actSet = [...new Set((act ?? []).map(b => b.user_id))]
        if (actSet.length === 0) return 0
        q = q.in('id', actSet)
      }

      const { count } = await q
      return count ?? 0
    }

    return 0
  } catch {
    return 0
  }
}
