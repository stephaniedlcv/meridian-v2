import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser }              from '@/lib/auth/is-admin'
import { createAdminClient }         from '@/lib/supabase/admin'
import { countSegment }              from '@/lib/admin/count-segment'
import type { TargetSegment, SegmentFilters } from '@/types/admin'

/**
 * POST /api/admin/notifications/audience-count
 * Body: { segment: TargetSegment; filters?: SegmentFilters }
 * Returns: { count: number }
 *
 * Used by the notification composer for live recipient-count preview.
 * Server-side only — clients never receive raw user IDs.
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { segment?: TargetSegment; filters?: SegmentFilters }
  try { body = await req.json() } catch { body = {} }

  const { segment = 'all', filters } = body

  const db    = createAdminClient() as any
  const count = await countSegment(db, segment, filters)

  return NextResponse.json({ count })
}
