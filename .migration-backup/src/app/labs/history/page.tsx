'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar from '@/components/NavBar'

const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  optimal: 'rgba(45,212,191,0.15)',
  optimalBorder: 'rgba(45,212,191,0.5)',
  watch: 'rgba(250,204,21,0.15)',
  watchBorder: 'rgba(250,204,21,0.5)',
  attention: 'rgba(251,146,60,0.15)',
  attentionBorder: 'rgba(251,146,60,0.5)',
  critical: 'rgba(248,113,113,0.15)',
  criticalBorder: 'rgba(248,113,113,0.5)',
  error: '#EF4444',
}

const fonts = {
  heading: '"Fraunces", serif',
  ui: '"Plus Jakarta Sans", sans-serif',
}

interface BiomarkerRow {
  id: string
  marker_name: string
  value: number
  unit: string
  state: string | null
  reference_range_min: number | null
  reference_range_max: number | null
  collected_at: string
  created_at: string
  flag_error: boolean
}

function getStateStyle(state: string | null) {
  switch (state) {
    case 'Optimal':   return { bg: colors.optimal,   border: colors.optimalBorder,   dot: '#2DD4BF', label: 'Optimal' }
    case 'Watch':     return { bg: colors.watch,     border: colors.watchBorder,     dot: '#FACC15', label: 'Watch' }
    case 'Attention': return { bg: colors.attention, border: colors.attentionBorder, dot: '#FB923C', label: 'Attention' }
    case 'Critical':  return { bg: colors.critical,  border: colors.criticalBorder,  dot: '#F87171', label: 'Critical' }
    default:          return { bg: colors.cardBg,    border: colors.cardBorder,      dot: colors.textMuted, label: '—' }
  }
}

function formatCollectedDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function formatMarkerName(slug: string): string {
  return slug
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function groupByDate(rows: BiomarkerRow[]): { date: string; label: string; items: BiomarkerRow[] }[] {
  const map = new Map<string, BiomarkerRow[]>()
  for (const row of rows) {
    const dateKey = row.collected_at.split('T')[0]
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(row)
  }
  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    label: formatCollectedDate(items[0].collected_at),
    items,
  }))
}

export default function LabsHistoryPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [biomarkers, setBiomarkers] = useState<BiomarkerRow[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/onboarding/welcome')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('biomarkers_static')
        .select('id, marker_name, value, unit, state, reference_range_min, reference_range_max, collected_at, created_at, flag_error')
        .eq('user_id', user.id)
        .order('collected_at', { ascending: false })
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('[Meridian] Lab history fetch error:', fetchError)
        setError('Could not load your lab history. Please try again.')
      } else {
        setBiomarkers(data || [])
      }

      setLoading(false)
    }
    load()
  }, [router, supabase])

  const groups = groupByDate(biomarkers)

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        fontFamily: fonts.ui,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '36px', height: '36px',
          border: `3px solid rgba(103,232,249,0.2)`,
          borderTopColor: colors.teal,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        fontFamily: fonts.ui,
        position: 'relative',
        overflow: 'hidden',
        padding: '24px 24px 100px',
      }}
    >
      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}18 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}18 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <h1 style={{
          fontFamily: fonts.heading,
          fontSize: 'clamp(24px, 5vw, 30px)',
          fontWeight: 700,
          color: colors.text,
          marginBottom: '6px',
          lineHeight: 1.2,
        }}>
          Lab History
        </h1>
        <p style={{
          fontSize: '15px',
          color: colors.textSoft,
          marginBottom: '32px',
          lineHeight: 1.6,
        }}>
          All confirmed biomarkers, grouped by collection date.
        </p>

        {/* Error state */}
        {error && (
          <div style={{
            padding: '20px 24px',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '14px',
            marginBottom: '24px',
          }}>
            <p style={{ fontSize: '14px', color: colors.error, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!error && groups.length === 0 && (
          <div style={{
            padding: '56px 24px',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '16px',
            textAlign: 'center',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🧬</div>
            <p style={{ fontSize: '16px', color: colors.textSoft, marginBottom: '6px', fontWeight: 600 }}>
              No saved labs yet.
            </p>
            <p style={{ fontSize: '13px', color: colors.textMuted }}>
              Upload a lab PDF to see your biomarkers here.
            </p>
          </div>
        )}

        {/* Groups */}
        {groups.map((group) => (
          <div key={group.date} style={{ marginBottom: '32px' }}>

            {/* Date header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}>
              <div style={{
                width: '8px', height: '8px',
                borderRadius: '50%',
                backgroundColor: colors.teal,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                color: colors.teal,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {group.label}
              </span>
              <span style={{
                fontSize: '12px',
                color: colors.textMuted,
                fontWeight: 400,
              }}>
                — {group.items.length} {group.items.length === 1 ? 'biomarker' : 'biomarkers'}
              </span>
            </div>

            {/* Biomarker cards */}
            <div style={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: '16px',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              overflow: 'hidden',
            }}>
              {group.items.map((b, idx) => {
                const s = getStateStyle(b.state)
                const isLast = idx === group.items.length - 1
                const hasRef = b.reference_range_min !== null && b.reference_range_max !== null

                return (
                  <div
                    key={b.id}
                    style={{
                      padding: '14px 20px',
                      borderBottom: isLast ? 'none' : `1px solid ${colors.cardBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      backgroundColor: b.flag_error ? 'rgba(248,113,113,0.07)' : 'transparent',
                    }}
                  >
                    {/* Left — name + ref range */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '7px', height: '7px',
                          borderRadius: '50%',
                          backgroundColor: b.flag_error ? colors.error : s.dot,
                          flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: colors.text,
                        }}>
                          {formatMarkerName(b.marker_name)}
                        </span>
                      </div>
                      {hasRef && (
                        <span style={{
                          fontSize: '12px',
                          color: colors.textMuted,
                          paddingLeft: '15px',
                          display: 'block',
                          marginTop: '2px',
                        }}>
                          Ref {b.reference_range_min}–{b.reference_range_max} {b.unit}
                        </span>
                      )}
                    </div>

                    {/* Right — value + state badge */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: colors.text,
                      }}>
                        {b.value}
                      </span>
                      {b.unit && (
                        <span style={{
                          fontSize: '12px',
                          color: colors.textMuted,
                          marginLeft: '4px',
                        }}>
                          {b.unit}
                        </span>
                      )}
                      {b.state && !b.flag_error && (
                        <div style={{
                          display: 'inline-block',
                          marginLeft: '10px',
                          padding: '2px 8px',
                          backgroundColor: s.bg,
                          border: `1px solid ${s.border}`,
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: s.dot,
                          letterSpacing: '0.04em',
                          verticalAlign: 'middle',
                        }}>
                          {s.label}
                        </div>
                      )}
                      {b.flag_error && (
                        <div style={{
                          display: 'inline-block',
                          marginLeft: '10px',
                          padding: '2px 8px',
                          backgroundColor: colors.critical,
                          border: `1px solid ${colors.criticalBorder}`,
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#F87171',
                          verticalAlign: 'middle',
                        }}>
                          Flagged
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Summary footer when data exists */}
        {groups.length > 0 && (
          <p style={{
            fontSize: '12px',
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: '8px',
          }}>
            {biomarkers.length} total biomarkers across {groups.length} {groups.length === 1 ? 'upload' : 'uploads'}
          </p>
        )}

      </div>
      <NavBar />
    </div>
  )
}
