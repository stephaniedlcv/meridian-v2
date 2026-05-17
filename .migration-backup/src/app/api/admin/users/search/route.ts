import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser }              from '@/lib/auth/is-admin'
import { createAdminClient }         from '@/lib/supabase/admin'

export interface UserSearchResult {
  id:           string
  email:        string | null
  display_name: string | null
}

/**
 * GET /api/admin/users/search?q=<query>
 * Returns up to 15 user records matching name or email (case-insensitive).
 * Minimum 2 characters required to avoid broad scans.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) return NextResponse.json({ users: [] })

  const db = createAdminClient()

  // ── 1. Name search via profiles ──────────────────────────────────
  const { data: byName } = await db
    .from('profiles')
    .select('id, full_name, display_name')
    .ilike('full_name', `%${q}%`)
    .limit(15)

  // ── 2. Email search via auth.admin ──────────────────────────────
  // listUsers doesn't support server-side email search, so we fetch a
  // reasonable batch and filter client-side.
  // TODO: replace with an indexed email column in profiles once schema
  // supports it, to scale beyond ~1 000 users.
  const { data: authData } = await db.auth.admin.listUsers({ page: 1, perPage: 500 })
  const qLower = q.toLowerCase()
  const emailMatches = (authData?.users ?? [])
    .filter(u => u.email?.toLowerCase().includes(qLower))

  // Build a map from auth data for email lookup
  const emailById: Record<string, string> = {}
  for (const u of authData?.users ?? []) {
    if (u.email) emailById[u.id] = u.email
  }

  // ── 3. Merge, deduplicate, return ────────────────────────────────
  const seen    = new Set<string>()
  const results: UserSearchResult[] = []

  for (const p of byName ?? []) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    results.push({
      id:           p.id,
      email:        emailById[p.id] ?? null,
      display_name: p.full_name ?? p.display_name ?? null,
    })
  }

  for (const u of emailMatches) {
    if (seen.has(u.id)) continue
    seen.add(u.id)
    results.push({
      id:           u.id,
      email:        u.email ?? null,
      display_name: null,
    })
  }

  return NextResponse.json({ users: results.slice(0, 15) })
}
