import { createAdminClient } from '@/lib/supabase/admin'
import type { TargetSegment, SegmentFilters } from '@/types/admin'

type AdminDB = ReturnType<typeof createAdminClient>

type ProfileIdRow = {
  id: string | null
}

type UserIdRow = {
  user_id: string | null
}

function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : []
}

function compactStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  return values.filter((value): value is string => {
    return typeof value === 'string' && value.length > 0
  })
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function profileIds(data: unknown): string[] {
  return asRows<ProfileIdRow>(data)
    .map(row => row.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function userIds(data: unknown): string[] {
  return asRows<UserIdRow>(data)
    .map(row => row.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

/**
 * Resolves user IDs for a given target segment + optional filters.
 * Used by admin notification delivery.
 * All selection is server-side; clients never drive recipient selection.
 */
export async function getSegmentUserIds(
  db: AdminDB,
  segment: TargetSegment,
  filters?: SegmentFilters | Record<string, unknown> | null,
): Promise<string[]> {
  const f = (filters ?? {}) as SegmentFilters

  try {
    // Supabase generated types can lag behind admin-only tables in this app.
    // Keep this helper resilient while table coverage is being normalized.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = db as any

    // ── Atomic segments ──────────────────────────────────────────────
    if (segment === 'all') {
      const { data } = await adminDb.from('profiles').select('id')
      return profileIds(data)
    }

    if (segment === 'female_only') {
      const { data } = await adminDb
        .from('profiles')
        .select('id')
        .eq('biological_profile', 'female')

      return profileIds(data)
    }

    if (segment === 'male_only') {
      const { data } = await adminDb
        .from('profiles')
        .select('id')
        .eq('biological_profile', 'male')

      return profileIds(data)
    }

    if (segment === 'admins_only') {
      const { data } = await adminDb.from('admin_users').select('user_id')
      return userIds(data)
    }

    if (segment === 'non_admins') {
      const { data: allProfiles } = await adminDb.from('profiles').select('id')
      const { data: adminRecords } = await adminDb.from('admin_users').select('user_id')

      const adminSet = new Set(userIds(adminRecords))
      return profileIds(allProfiles).filter(id => !adminSet.has(id))
    }

    if (segment === 'specific_users') {
      return unique(compactStrings(f.specific_user_ids ?? []))
    }

    if (segment === 'onboarding_incomplete') {
      const { data } = await adminDb
        .from('profiles')
        .select('id')
        .eq('onboarding_completed', false)

      return profileIds(data)
    }

    if (segment === 'safety_alert') {
      const { data } = await adminDb
        .from('profiles')
        .select('id')
        .eq('safety_status', 'medical_alert')

      return profileIds(data)
    }

    if (segment === 'no_labs') {
      const { data: allProfiles } = await adminDb.from('profiles').select('id')
      const { data: labRecords } = await adminDb.from('biomarkers_static').select('user_id')

      const withLabs = new Set(userIds(labRecords))
      return profileIds(allProfiles).filter(id => !withLabs.has(id))
    }

    if (segment === 'active_7d') {
      const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString()

      const { data } = await adminDb
        .from('biomarkers_static')
        .select('user_id')
        .gte('created_at', cutoff)

      return unique(userIds(data))
    }

    if (segment === 'wearable_connected') {
      // Future: query wearable connections table.
      return []
    }

    // ── Custom combinations ──────────────────────────────────────────
    if (segment === 'custom') {
      // Start from all profiles, then apply each active filter.
      // For has_labs=false we need set-subtraction, so handle that separately.
      if (f.has_labs === false) {
        const { data: baseProfiles } = await adminDb.from('profiles').select('id')
        let resultIds = profileIds(baseProfiles)

        if (f.biological_profile) {
          const { data: biologicalProfileRows } = await adminDb
            .from('profiles')
            .select('id')
            .eq('biological_profile', f.biological_profile)

          const biologicalProfileSet = new Set(profileIds(biologicalProfileRows))
          resultIds = resultIds.filter(id => biologicalProfileSet.has(id))
        }

        const { data: labRecords } = await adminDb.from('biomarkers_static').select('user_id')
        const withLabs = new Set(userIds(labRecords))
        resultIds = resultIds.filter(id => !withLabs.has(id))

        if (f.onboarding_incomplete) {
          const { data: incompleteRows } = await adminDb
            .from('profiles')
            .select('id')
            .eq('onboarding_completed', false)

          const incompleteSet = new Set(profileIds(incompleteRows))
          resultIds = resultIds.filter(id => incompleteSet.has(id))
        }

        if (f.active_7d) {
          const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString()

          const { data: activeRows } = await adminDb
            .from('biomarkers_static')
            .select('user_id')
            .gte('created_at', cutoff)

          const activeSet = new Set(userIds(activeRows))
          resultIds = resultIds.filter(id => activeSet.has(id))
        }

        return unique(resultIds)
      }

      // Base query with direct Supabase filters.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = adminDb.from('profiles').select('id')

      if (f.biological_profile) {
        query = query.eq('biological_profile', f.biological_profile)
      }

      if (f.onboarding_incomplete) {
        query = query.eq('onboarding_completed', false)
      }

      if (f.has_labs === true) {
        const { data: labRecords } = await adminDb.from('biomarkers_static').select('user_id')
        const ids = unique(userIds(labRecords))

        if (ids.length === 0) return []

        query = query.in('id', ids)
      }

      if (f.active_7d) {
        const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString()

        const { data: activeRows } = await adminDb
          .from('biomarkers_static')
          .select('user_id')
          .gte('created_at', cutoff)

        const ids = unique(userIds(activeRows))

        if (ids.length === 0) return []

        query = query.in('id', ids)
      }

      const { data } = await query
      return profileIds(data)
    }

    return []
  } catch (error) {
    console.error('[getSegmentUserIds] Failed to resolve segment', {
      segment,
      error,
    })

    return []
  }
}
