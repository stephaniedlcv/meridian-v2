import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser }              from '@/lib/auth/is-admin'
import { createAdminClient }         from '@/lib/supabase/admin'
import { getSegmentUserIds }         from '@/lib/admin/get-segment-user-ids'
import type { TargetSegment, SegmentFilters } from '@/types/admin'

/**
 * POST /api/admin/notifications/audience-breakdown
 * Body: { segment: TargetSegment; filters?: SegmentFilters }
 * Returns: { total: number; female: number; male: number }
 *
 * Used by the notification composer to show a pre-send recipient preview.
 * Server-side only — clients never receive raw user IDs.
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { segment?: TargetSegment; filters?: SegmentFilters }
  try { body = await req.json() } catch { body = {} }

  const { segment = 'all', filters } = body

  const db      = createAdminClient() as any
  const userIds = await getSegmentUserIds(db, segment, filters)

  if (userIds.length === 0) {
    return NextResponse.json({ total: 0, female: 0, male: 0 })
  }

  const CHUNK = 500
  let female = 0
  let male   = 0

  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK)
    const { data: profiles } = await db
      .from('profiles')
      .select('biological_profile')
      .in('id', chunk)

    for (const p of (profiles ?? [])) {
      if (p.biological_profile === 'female') female++
      else if (p.biological_profile === 'male') male++
    }
  }

  return NextResponse.json({ total: userIds.length, female, male })
}
