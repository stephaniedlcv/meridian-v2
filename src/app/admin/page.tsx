import { requireAdmin }    from '@/lib/auth/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect }          from 'next/navigation'
import AdminDashboardClient  from './_components/AdminDashboardClient'
import type { PlatformStats } from '@/types/admin'

export const dynamic = 'force-dynamic'

async function fetchStats(): Promise<PlatformStats> {
  const db = createAdminClient()

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
    db.from('profiles').select('id, onboarding_completed, safety_status, created_at'),
    db.from('biomarkers_static').select('user_id, collected_at, created_at').order('created_at', { ascending: false }),
    db.from('pending_biomarkers').select('id', { count: 'exact', head: true }).eq('status', 'pending_classification'),
    db.from('biomarkers_static').select('id', { count: 'exact', head: true }).eq('flag_error', true),
    db.from('biomarkers_static').select('marker_name'),
    db.from('profiles').select('created_at').gte('created_at', new Date(Date.now() - 60 * 86400 * 1000).toISOString()),
    db.from('biomarkers_static').select('state'),
    db.from('profiles').select('biological_profile'),
    db.from('profiles').select('user_profile'),
  ])

  const profiles   = profilesRes.data   ?? []
  const biomarkers = biomarkersRes.data ?? []
  const totalUsers = profiles.length

  const onboardingCompletionPct = totalUsers > 0
    ? Math.round((profiles.filter(p => p.onboarding_completed).length / totalUsers) * 100) : 0
  const safetyAlertCount = profiles.filter(p => p.safety_status === 'medical_alert').length

  const now7d  = new Date(Date.now() - 7  * 86400 * 1000).toISOString()
  const now30d = new Date(Date.now() - 30 * 86400 * 1000).toISOString()
  const activeUsers7d  = new Set(biomarkers.filter(b => b.created_at >= now7d).map(b => b.user_id)).size
  const activeUsers30d = new Set(biomarkers.filter(b => b.created_at >= now30d).map(b => b.user_id)).size

  const sessionSet   = new Set(biomarkers.map(b => `${b.user_id}__${b.collected_at.slice(0, 10)}`))
  const labsUploaded = sessionSet.size
  const avgLabsPerUser = totalUsers > 0 ? Math.round((labsUploaded / totalUsers) * 10) / 10 : 0

  const markerCounts: Record<string, number> = {}
  for (const b of (topMarkersRes.data ?? [])) {
    markerCounts[b.marker_name] = (markerCounts[b.marker_name] ?? 0) + 1
  }
  const topBiomarkers = Object.entries(markerCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  const dayCounts: Record<string, number> = {}
  const cutoff30 = new Date(Date.now() - 30 * 86400 * 1000)
  for (const p of (signupsRes.data ?? [])) {
    const day = p.created_at.slice(0, 10)
    if (new Date(day) >= cutoff30) dayCounts[day] = (dayCounts[day] ?? 0) + 1
  }
  const signupsByDay = Object.entries(dayCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  const stateCounts: Record<string, number> = {}
  for (const b of (stateDistRes.data ?? [])) stateCounts[b.state] = (stateCounts[b.state] ?? 0) + 1
  const stateDistribution = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).map(([state, count]) => ({ state, count }))

  const bpCounts: Record<string, number> = {}
  for (const p of (bioProfileRes.data ?? [])) { const bp = p.biological_profile ?? 'unknown'; bpCounts[bp] = (bpCounts[bp] ?? 0) + 1 }
  const biologicalProfileSplit = Object.entries(bpCounts).map(([profile, count]) => ({ profile, count }))

  const upCounts: Record<string, number> = {}
  for (const p of (userProfileRes.data ?? [])) { const up = p.user_profile ?? 'unknown'; upCounts[up] = (upCounts[up] ?? 0) + 1 }
  const userProfileSplit = Object.entries(upCounts).map(([profile, count]) => ({ profile, count }))

  return {
    totalUsers, activeUsers7d, activeUsers30d, labsUploaded,
    onboardingCompletionPct, safetyAlertCount, avgLabsPerUser,
    pendingBiomarkers: pendingRes.count ?? 0,
    flaggedBiomarkers: flaggedRes.count ?? 0,
    topBiomarkers, signupsByDay, stateDistribution,
    biologicalProfileSplit, userProfileSplit,
  }
}

export default async function AdminDashboardPage() {
  try { await requireAdmin() } catch { redirect('/dashboard') }

  const stats = await fetchStats()
  return <AdminDashboardClient stats={stats} />
}
