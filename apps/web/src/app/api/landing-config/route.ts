import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FALLBACK_CONFIG }   from '@/types/experience'

/**
 * GET /api/landing-config
 *
 * Public endpoint — no auth required.
 * Returns the single active landing_experience configuration.
 * Falls back to FALLBACK_CONFIG if the table is missing or empty.
 *
 * Cached at the edge for 60 s, stale-while-revalidate for 5 min,
 * so a bad deploy or DB blip never breaks the landing page.
 */
export const revalidate = 60

export async function GET() {
  try {
    const db = createAdminClient() as any
    const { data, error } = await db
      .from('landing_experience')
      .select('*')
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return NextResponse.json(FALLBACK_CONFIG, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      })
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch {
    return NextResponse.json(FALLBACK_CONFIG)
  }
}
