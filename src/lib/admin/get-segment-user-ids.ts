import { createAdminClient }    from '@/lib/supabase/admin'
import type { TargetSegment, SegmentFilters } from '@/types/admin'

type AdminDB = ReturnType<typeof createAdminClient>

/**
 * Returns user IDs matching a target segment + optional filters.
 * Mirrors countSegment but returns the actual IDs instead of a count.
 * Used to generate notification_recipients rows when sending a notification.
 */
export async function getSegmentUserIds(
  db:       AdminDB,
  segment:  TargetSegment,
  filters?: SegmentFilters | Record<string, unknown> | null,
): Promise<string[]> {
  const f = (filters ?? {}) as SegmentFilters

  try {
    if (segment === 'all') {
      const { data } = await db.from('profiles').select('id')
      return (data ?? []).map(p => p.id)
    }

    if (segment === 'female_only') {
      const { data } = await db.from('profiles').select('id').eq('biological_profile', 'female')
      return (data ?? []).map(p => p.id)
    }

    if (segment === 'male_only') {
      const { data } = await db.from('profiles').select('id').eq('biological_profile', 'male')
      return (data ?? []).map(p => p.id)
    }

    if (segment === 'admins_only') {
      const { data } = await db.from('admin_users').select('user_id')
      return (data ?? []).map(a => a.user_id)
    }

    if (segment === 'non_admins') {
      const { data: allProfiles }  = await db.from('profiles').select('id')
      const { data: adminRecords } = await db.from('admin_users').select('user_id')
      const adminSet = new Set((adminRecords ?? []).map(a => a.user_id))
      return (allProfiles ?? []).filter(p => !adminSet.has(p.id)).map(p => p.id)
    }

    if (segment === 'specific_users') {
      return f.specific_user_ids ?? []
    }

    if (segment === 'onboarding_incomplete') {
      const { data } = await db.from('profiles').select('id').eq('onboarding_completed', false)
      return (data ?? []).map(p => p.id)
    }

    if (segment === 'safety_alert') {
      const { data } = await db.from('profiles').select('id').eq('safety_status', 'medical_alert')
      return (data ?? []).map(p => p.id)
    }

    if (segment === 'no_labs') {
      const { data: allIds } = await db.from('profiles').select('id')
      const { data: labIds } = await db.from('biomarkers_static').select('user_id')
      const withLabs = new Set((labIds ?? []).map(b => b.user_id))
      return (allIds ?? []).filter(p => !withLabs.has(p.id)).map(p => p.id)
    }

    if (segment === 'active_7d') {
      const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
      const { data } = await db.from('biomarkers_static').select('user_id').gte('created_at', cutoff)
      return [...new Set((data ?? []).map(b => b.user_id))]
    }

    if (segment === 'wearable_connected') {
      return []
    }

    if (segment === 'custom') {
      let ids: string[] | null = null

      const intersect = (current: string[] | null, next: string[]): string[] => {
        if (current === null) return next
        const s = new Set(next)
        return current.filter(id => s.has(id))
      }

      if (f.biological_profile) {
        const { data } = await db.from('profiles').select('id').eq('biological_profile', f.biological_profile)
        ids = intersect(ids, (data ?? []).map(p => p.id))
      }

      if (f.onboarding_incomplete) {
        const { data } = await db.from('profiles').select('id').eq('onboarding_completed', false)
        ids = intersect(ids, (data ?? []).map(p => p.id))
      }

      if (f.has_labs === true) {
        const { data } = await db.from('biomarkers_static').select('user_id')
        ids = intersect(ids, [...new Set((data ?? []).map(b => b.user_id))])
      }

      if (f.has_labs === false) {
        const { data: allProfiles } = await db.from('profiles').select('id')
        const { data: labIds }      = await db.from('biomarkers_static').select('user_id')
        const withLabs = new Set((labIds ?? []).map(b => b.user_id))
        const noLabs   = (allProfiles ?? []).filter(p => !withLabs.has(p.id)).map(p => p.id)
        ids = intersect(ids, noLabs)
      }

      if (f.active_7d) {
        const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
        const { data } = await db.from('biomarkers_static').select('user_id').gte('created_at', cutoff)
        ids = intersect(ids, [...new Set((data ?? []).map(b => b.user_id))])
      }

      if (ids === null) {
        const { data } = await db.from('profiles').select('id')
        ids = (data ?? []).map(p => p.id)
      }

      return ids
    }

    return []
  } catch {
    return []
  }
}
