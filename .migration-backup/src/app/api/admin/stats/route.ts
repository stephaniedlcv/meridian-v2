import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser }     from '@/lib/auth/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlatformStats } from '@/types/admin'

export async function GET(_req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  // Run all queries in parallel
  const [
    profilesRes,
    biomarkersRes,
    pendingRes,
    flaggedRes,
    topMarkersRes,
    signupsRes,
    stateDistRes,
    bioProfileRes,
    userProfileRes,
  ] = await Promise.all([
    // All profiles
    db.from('profiles').select('id, onboarding_completed, safety_status, created_at'),
    // All biomarkers (for labs uploaded count + avg per user)
    db.from('biomarkers_static').select('user_id, collected_at, created_at').order('created_at', { ascending: false }),
    // Pending biomarkers
    db.from('pending_biomarkers').select('id', { count: 'exact', head: true }).eq('status', 'pending_classification'),
    // Flagged biomarkers
    db.from('biomarkers_static').select('id', { count: 'exact', head: true }).eq('flag_error', true),
    // Top biomarkers by frequency
    db.from('biomarkers_static').select('marker_name'),
    // Profile signups by day (last 60 days)
    db.from('profiles').select('created_at').gte('created_at', new Date(Date.now() - 60 * 86400 * 1000).toISOString()),
    // Biomarker state distribution
    db.from('biomarkers_static').select('state'),
    // Biological profile split
    db.from('profiles').select('biological_profile'),
    // User profile split
    db.from('profiles').select('user_profile'),
  ])

  const profiles = profilesRes.data ?? []
  const biomarkers = biomarkersRes.data ?? []

  // ── Derived metrics ───────────────────────────────────────────
  const totalUsers = profiles.length
  const onboardingCompleted = profiles.filter(p => p.onboarding_completed).length
  const onboardingCompletionPct = totalUsers > 0
    ? Math.round((onboardingCompleted / totalUsers) * 100) : 0
  const safetyAlertCount = profiles.filter(p => p.safety_status === 'medical_alert').length

  // Active users: users who have biomarker data in the window
  const now7d  = new Date(Date.now() - 7  * 86400 * 1000).toISOString()
  const now30d = new Date(Date.now() - 30 * 86400 * 1000).toISOString()
  const activeSet7d  = new Set(biomarkers.filter(b => b.created_at >= now7d).map(b => b.user_id))
  const activeSet30d = new Set(biomarkers.filter(b => b.created_at >= now30d).map(b => b.user_id))
  const activeUsers7d  = activeSet7d.size
  const activeUsers30d = activeSet30d.size

  // Labs uploaded: distinct (user_id + collected_at date) pairs
  const sessionSet = new Set(biomarkers.map(b => `${b.user_id}__${b.collected_at.slice(0,10)}`))
  const labsUploaded = sessionSet.size
  const avgLabsPerUser = totalUsers > 0 ? Math.round((labsUploaded / totalUsers) * 10) / 10 : 0

  // Top biomarkers
  const markerCounts: Record<string, number> = {}
  for (const b of (topMarkersRes.data ?? [])) {
    markerCounts[b.marker_name] = (markerCounts[b.marker_name] ?? 0) + 1
  }
  const topBiomarkers = Object.entries(markerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  // Signups by day (last 30 days bucketed)
  const dayCounts: Record<string, number> = {}
  const cutoff30 = new Date(Date.now() - 30 * 86400 * 1000)
  for (const p of (signupsRes.data ?? [])) {
    const day = p.created_at.slice(0, 10)
    if (new Date(day) >= cutoff30) {
      dayCounts[day] = (dayCounts[day] ?? 0) + 1
    }
  }
  const signupsByDay = Object.entries(dayCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  // State distribution
  const stateCounts: Record<string, number> = {}
  for (const b of (stateDistRes.data ?? [])) {
    stateCounts[b.state] = (stateCounts[b.state] ?? 0) + 1
  }
  const stateDistribution = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([state, count]) => ({ state, count }))

  // Biological profile split
  const bpCounts: Record<string, number> = {}
  for (const p of (bioProfileRes.data ?? [])) {
    const bp = p.biological_profile ?? 'unknown'
    bpCounts[bp] = (bpCounts[bp] ?? 0) + 1
  }
  const biologicalProfileSplit = Object.entries(bpCounts).map(([profile, count]) => ({ profile, count }))

  // User profile split
  const upCounts: Record<string, number> = {}
  for (const p of (userProfileRes.data ?? [])) {
    const up = p.user_profile ?? 'unknown'
    upCounts[up] = (upCounts[up] ?? 0) + 1
  }
  const userProfileSplit = Object.entries(upCounts).map(([profile, count]) => ({ profile, count }))

  const stats: PlatformStats = {
    totalUsers,
    activeUsers7d,
    activeUsers30d,
    labsUploaded,
    onboardingCompletionPct,
    safetyAlertCount,
    avgLabsPerUser,
    pendingBiomarkers: pendingRes.count ?? 0,
    flaggedBiomarkers: flaggedRes.count ?? 0,
    topBiomarkers,
    signupsByDay,
    stateDistribution,
    biologicalProfileSplit,
    userProfileSplit,
  }

  return NextResponse.json(stats)
}
