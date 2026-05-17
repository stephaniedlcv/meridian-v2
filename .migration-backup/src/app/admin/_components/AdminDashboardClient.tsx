'use client'

import type { PlatformStats } from '@/types/admin'

const colors = {
  background: '#061316',
  teal:       '#2DD4BF',
  cyan:       '#67E8F9',
  text:       '#EAFBF7',
  textSoft:   '#9ACBC1',
  textMuted:  '#5F8E85',
  cardBg:     'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
}
const fonts = { heading: '"Fraunces", serif', ui: '"Plus Jakarta Sans", sans-serif' }

const STATE_COLOR: Record<string, string> = {
  Normal: '#2DD4BF', Optimal: '#2DD4BF',
  Low: '#FB923C', High: '#FB923C', Attention: '#FB923C',
  Critical: '#F87171',
  Watch: '#FCD34D',
}

function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <div style={{ height: '48px' }} />
  const max  = Math.max(...data.map(d => d.count), 1)
  const w    = 200
  const h    = 48
  const step = w / Math.max(data.length - 1, 1)
  const points = data.map((d, i) => `${i * step},${h - (d.count / max) * (h - 4)}`)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.teal} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors.teal} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={[...points, `${(data.length - 1) * step},${h}`, `0,${h}`].join(' ')}
        fill="url(#sg)" stroke="none"
      />
      <polyline points={points.join(' ')} fill="none" stroke={colors.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      backgroundColor: colors.cardBg,
      border:          `1px solid ${colors.cardBorder}`,
      borderRadius:    '14px',
      padding:         '20px 22px',
      boxShadow:       'inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '10px' }}>{label}</div>
      <div style={{ fontFamily: fonts.heading, fontSize: '32px', fontWeight: 700, color: accent ?? colors.text, lineHeight: 1, marginBottom: sub ? '6px' : 0 }}>{value}</div>
      {sub && <div style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted }}>{sub}</div>}
    </div>
  )
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      <div style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textSoft, width: '140px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', backgroundColor: color, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted, width: '36px', textAlign: 'right' }}>{value}</div>
    </div>
  )
}

interface Props { stats: PlatformStats }

export default function AdminDashboardClient({ stats }: Props) {
  const topCount = stats.topBiomarkers[0]?.count ?? 1

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, margin: 0, marginBottom: '6px' }}>Dashboard</h1>
        <p style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, margin: 0 }}>Platform overview — live data</p>
      </div>

      {/* Primary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <MetricCard label="Total Users"        value={stats.totalUsers} />
        <MetricCard label="Active 7d"          value={stats.activeUsers7d}  sub={`${stats.totalUsers > 0 ? Math.round(stats.activeUsers7d / stats.totalUsers * 100) : 0}% of users`} accent={colors.teal} />
        <MetricCard label="Active 30d"         value={stats.activeUsers30d} sub={`${stats.totalUsers > 0 ? Math.round(stats.activeUsers30d / stats.totalUsers * 100) : 0}% of users`} />
        <MetricCard label="Labs Uploaded"      value={stats.labsUploaded}   sub={`avg ${stats.avgLabsPerUser} per user`} />
        <MetricCard label="Onboarding"         value={`${stats.onboardingCompletionPct}%`} sub="completed" accent={stats.onboardingCompletionPct > 70 ? colors.teal : '#FB923C'} />
        <MetricCard label="Safety Alerts"      value={stats.safetyAlertCount} accent={stats.safetyAlertCount > 0 ? '#F87171' : colors.text} />
        <MetricCard label="Pending Biomarkers" value={stats.pendingBiomarkers} sub="unclassified" accent={stats.pendingBiomarkers > 0 ? '#FB923C' : colors.textMuted} />
        <MetricCard label="Flagged Results"    value={stats.flaggedBiomarkers} accent={stats.flaggedBiomarkers > 0 ? '#F87171' : colors.textMuted} />
      </div>

      {/* Two-column charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>

        {/* Signups sparkline */}
        <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '22px 24px' }}>
          <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '16px' }}>User Growth — Last 30 Days</div>
          {stats.signupsByDay.length > 0 ? (
            <>
              <Sparkline data={stats.signupsByDay} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>{stats.signupsByDay[0]?.date}</span>
                <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>{stats.signupsByDay[stats.signupsByDay.length - 1]?.date}</span>
              </div>
            </>
          ) : (
            <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, paddingTop: '8px' }}>No signups in this window</div>
          )}
        </div>

        {/* Biomarker state distribution */}
        <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '22px 24px' }}>
          <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '16px' }}>Result State Distribution</div>
          {stats.stateDistribution.length > 0 ? (
            stats.stateDistribution.map(s => (
              <BarRow key={s.state} label={s.state} value={s.count} max={stats.stateDistribution[0].count} color={STATE_COLOR[s.state] ?? colors.textMuted} />
            ))
          ) : (
            <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>No biomarker data yet</div>
          )}
        </div>
      </div>

      {/* Three-column lower row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px' }}>

        {/* Top biomarkers */}
        <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '22px 24px' }}>
          <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '16px' }}>Most Uploaded Biomarkers</div>
          {stats.topBiomarkers.length > 0 ? (
            stats.topBiomarkers.map(b => (
              <BarRow key={b.name} label={b.name} value={b.count} max={topCount} color={colors.teal} />
            ))
          ) : (
            <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>No data yet</div>
          )}
        </div>

        {/* Biological profile */}
        <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '22px 24px' }}>
          <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '16px' }}>Biological Profile</div>
          {stats.biologicalProfileSplit.map((bp, i) => (
            <div key={bp.profile} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textSoft, textTransform: 'capitalize' }}>{bp.profile}</span>
              <span style={{ fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, color: i === 0 ? colors.teal : colors.textSoft }}>{bp.count}</span>
            </div>
          ))}
        </div>

        {/* User profile */}
        <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '22px 24px' }}>
          <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '16px' }}>User Profile</div>
          {stats.userProfileSplit.map(up => (
            <div key={up.profile} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textSoft, textTransform: 'capitalize' }}>{up.profile.replace(/_/g, ' ')}</span>
              <span style={{ fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, color: colors.textSoft }}>{up.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
