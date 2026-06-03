'use client'

import { useState, useEffect, useCallback } from 'react'

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
  Critical: '#F87171', Watch: '#FCD34D',
}

interface StatsData {
  totalUsers:              number
  activeUsers7d:           number
  activeUsers30d:          number
  labsUploaded:            number
  onboardingCompletionPct: number
  safetyAlertCount:        number
  avgLabsPerUser:          number
  pendingBiomarkers:       number
  flaggedBiomarkers:       number
  topBiomarkers:           { name: string; count: number }[]
  signupsByDay:            { date: string; count: number }[]
  stateDistribution:       { state: string; count: number }[]
  biologicalProfileSplit:  { profile: string; count: number }[]
  userProfileSplit:        { profile: string; count: number }[]
}

function SvgBarChart({ data, colorFn }: { data: { label: string; value: number }[]; colorFn?: (label: string) => string }) {
  if (!data.length) return (
    <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>No data</div>
  )
  const max  = Math.max(...data.map(d => d.value), 1)
  const barW = Math.max(Math.floor(260 / data.length) - 6, 10)
  const h    = 90

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as 'touch' }}>
      <svg width={Math.max(data.length * (barW + 6), 260)} height={h + 40} style={{ display: 'block', minWidth: '100%' }}>
        {data.map((d, i) => {
          const barH = Math.max((d.value / max) * h, 2)
          const x    = i * (barW + 6)
          const color = colorFn ? colorFn(d.label) : colors.teal
          return (
            <g key={d.label}>
              <rect x={x} y={h - barH} width={barW} height={barH} rx="3" fill={color} opacity="0.75" />
              <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize="9" fill={colors.textMuted} fontFamily={fonts.ui}>
                {d.label.slice(0, 9)}
              </text>
              <text x={x + barW / 2} y={h - barH - 4} textAnchor="middle" fontSize="10" fill={colors.textSoft} fontFamily={fonts.ui}>{d.value}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      <div style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textSoft, width: '120px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: '5px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', backgroundColor: color }} />
      </div>
      <div style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted, width: '36px', textAlign: 'right', flexShrink: 0 }}>{value}</div>
    </div>
  )
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click(); URL.revokeObjectURL(url)
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const csv  = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click(); URL.revokeObjectURL(url)
}

export default function AdminAnalyticsPage() {
  const [stats,   setStats]   = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
      const d   = await res.json()
      setStats(d)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const topCount = stats?.topBiomarkers[0]?.count ?? 1

  return (
    <div className="admin-page-pad" style={{ padding: '32px 36px', maxWidth: '1200px' }}>
      {/* Header */}
      <div className="admin-analytics-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, margin: 0, marginBottom: '6px' }}>Analytics</h1>
          <p style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, margin: 0 }}>Platform-wide engagement and health intelligence</p>
        </div>
        {stats && (
          <div className="admin-export-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => downloadCSV(stats.topBiomarkers.map(b => ({ marker: b.name, count: b.count })), 'biomarkers.csv')}
              style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.teal, backgroundColor: 'rgba(45,212,191,0.08)', border: `1px solid rgba(45,212,191,0.25)`, borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', touchAction: 'manipulation', minHeight: '40px' }}
            >Export CSV</button>
            <button
              onClick={() => downloadJSON(stats, 'meridian-analytics.json')}
              style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textSoft, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', touchAction: 'manipulation', minHeight: '40px' }}
            >Export JSON</button>
          </div>
        )}
      </div>

      {loading || !stats ? (
        <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>Loading analytics…</div>
      ) : (
        <>
          {/* KPI row */}
          <div
            className="admin-grid-metrics"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}
          >
            {[
              { label: 'Total Users',         value: stats.totalUsers,              accent: undefined },
              { label: 'Active 7d',           value: stats.activeUsers7d,           accent: colors.teal },
              { label: 'Active 30d',          value: stats.activeUsers30d,          accent: undefined },
              { label: 'Labs Uploaded',       value: stats.labsUploaded,            accent: undefined },
              { label: 'Onboarding %',        value: `${stats.onboardingCompletionPct}%`, accent: stats.onboardingCompletionPct > 70 ? colors.teal : '#FB923C' },
              { label: 'Safety Alerts',       value: stats.safetyAlertCount,        accent: stats.safetyAlertCount > 0 ? '#F87171' : undefined },
              { label: 'Avg Labs / User',     value: stats.avgLabsPerUser,          accent: undefined },
              { label: 'Pending Biomarkers',  value: stats.pendingBiomarkers,       accent: stats.pendingBiomarkers > 0 ? '#FB923C' : undefined },
            ].map(k => (
              <div key={k.label} style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ fontFamily: fonts.ui, fontSize: '10px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>{k.label}</div>
                <div style={{ fontFamily: fonts.heading, fontSize: '26px', fontWeight: 700, color: k.accent ?? colors.text, lineHeight: 1 }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Growth + State */}
          <div
            className="admin-grid-2col"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}
          >
            <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '20px 22px' }}>
              <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '14px' }}>Daily Signups — Last 30 Days</div>
              <SvgBarChart data={stats.signupsByDay.map(d => ({ label: d.date.slice(5), value: d.count }))} />
            </div>
            <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '20px 22px' }}>
              <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '14px' }}>Biomarker State Distribution</div>
              {stats.stateDistribution.map(s => (
                <BarRow key={s.state} label={s.state} value={s.count} max={stats.stateDistribution[0]?.count ?? 1} color={STATE_COLOR[s.state] ?? colors.textMuted} />
              ))}
            </div>
          </div>

          {/* Biomarker distribution */}
          <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '20px 22px', marginBottom: '24px' }}>
            <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '14px' }}>Biomarker Upload Distribution</div>
            {stats.topBiomarkers.map(b => (
              <BarRow key={b.name} label={b.name} value={b.count} max={topCount} color={colors.teal} />
            ))}
          </div>

          {/* Profiles breakdown */}
          <div
            className="admin-grid-2col"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}
          >
            <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '20px 22px' }}>
              <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '14px' }}>Biological Profile Split</div>
              <SvgBarChart data={stats.biologicalProfileSplit.map(b => ({ label: b.profile, value: b.count }))} />
            </div>
            <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '20px 22px' }}>
              <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '14px' }}>User Profile Split</div>
              <SvgBarChart data={stats.userProfileSplit.map(u => ({ label: u.profile.replace(/_/g, ' '), value: u.count }))} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
