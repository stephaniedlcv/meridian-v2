'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar from '@/components/NavBar'
import { getSafetyStatusForBiomarker } from '@/lib/safety-engine'
import { getNextOnboardingStep } from '@/lib/onboarding'

const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  recovery: 'rgba(45,212,191,0.07)',
  recoveryBorder: 'rgba(45,212,191,0.3)',
  alert: 'rgba(248,113,113,0.07)',
  alertBorder: 'rgba(248,113,113,0.3)',
  optimal: 'rgba(74,222,128,0.07)',
  optimalBorder: 'rgba(74,222,128,0.3)',
}

const fonts = {
  heading: '"Fraunces", serif',
  ui: '"Plus Jakarta Sans", sans-serif',
}

interface GoldenInsight {
  headline: string
  status: string
  cause: string
  action_steps: string[]
  trust_line: string
  block_color: 'recovery' | 'alert' | 'optimal'
  logic_trace: string
}

function getBlockColors(blockColor: string) {
  switch (blockColor) {
    case 'alert': return { bg: colors.alert, border: colors.alertBorder, accent: '#F87171' }
    case 'optimal': return { bg: colors.optimal, border: colors.optimalBorder, accent: '#4ADE80' }
    default: return { bg: colors.recovery, border: colors.recoveryBorder, accent: colors.teal }
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [state, setState] = useState<string>('loading')
  const [insight, setInsight] = useState<GoldenInsight | null>(null)
  const [dominantMarker, setDominantMarker] = useState<string | null>(null)
  const [safetyAlert, setSafetyAlert] = useState(false)
  // Safety Engine V1: set when any recent biomarker meets a critical threshold.
  // Gates LabsSavedBlock copy and reinforces safetyAlert in SolvedBlock.
  const [hasCriticalMarker, setHasCriticalMarker] = useState(false)

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/onboarding/welcome')
        return
      }

      // Get profile (biological_profile needed for hemoglobin Safety Engine threshold)
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, birth_date, onboarding_completed, biological_profile, user_profile')
        .eq('id', user.id)
        .single()

      const nextStep = getNextOnboardingStep(profile)
      if (nextStep) { router.push(nextStep); return }

      setUserName(profile?.full_name || 'there')

      // Lightweight biomarker count — runs before insight so any insight failure
      // can still show the correct state rather than false no_data.
      const { count: biomarkerCount } = await supabase
        .from('biomarkers_static')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      const hasBiomarkers = typeof biomarkerCount === 'number' && biomarkerCount > 0
      console.log('[Meridian] user.id:', user.id, '| biomarker count:', biomarkerCount, '| hasBiomarkers:', hasBiomarkers)

      // ── Safety Engine V1 local check ────────────────────────────────────────
      // Independently evaluates recent biomarkers against critical thresholds.
      // Non-diagnostic, output suppression only. Does not write to DB.
      // Gates dashboard copy; also ensures safetyAlert is set when the insight
      // API is unavailable (labs_saved state).
      //
      // localCritical is hoisted to function scope so the insight success branch
      // can use it directly — React state setters are async and hasCriticalMarker
      // would not reflect the current value at that point.
      let localCritical = false

      if (hasBiomarkers) {
        const { data: recentForSafety } = await supabase
          .from('biomarkers_static')
          .select('marker_name, value, unit')
          .eq('user_id', user.id)
          .order('collected_at', { ascending: false })
          .limit(60)

        if (recentForSafety && recentForSafety.length > 0) {
          const bioprofile = profile?.biological_profile ?? 'female'
          localCritical = recentForSafety.some(b =>
            getSafetyStatusForBiomarker(b.marker_name, b.value, b.unit ?? '', bioprofile).status === 'critical'
          )
          if (localCritical) {
            setHasCriticalMarker(true)
            setSafetyAlert(true)  // also ensures SolvedBlock shows the safety badge
            console.log('[Meridian] Safety Engine V1: critical marker detected in local check')
          }
        }
      }

      // Fetch insight
      try {
        const response = await fetch(`/api/insight?user_id=${user.id}`)
        const data = await response.json()
        console.log('[Meridian] insight state:', data?.state, '| success:', data?.success)

        if (data.success && data.state !== 'no_data' && data.state !== 'insight_unavailable') {
          // Insight produced a real result — trust it.
          // Safety precedence: local Safety Engine critical detection must
          // always win. The insight API uses broader decision-engine thresholds
          // and may return safety_alert:false even when the local engine has
          // already confirmed a critical marker. OR ensures the badge never drops.
          setState(data.state)
          setInsight(data.insight)
          setDominantMarker(data.dominant_marker)
          setSafetyAlert(localCritical || Boolean(data.safety_alert))
        } else {
          // Covers: no_data, insight_unavailable, success:false, unexpected shape.
          // Use the biomarker count to decide the truthful fallback state.
          const finalState = hasBiomarkers ? 'labs_saved' : 'no_data'
          console.log('[Meridian] insight unavailable — final state:', finalState)
          setState(finalState)
        }
      } catch (err) {
        console.error('[Meridian] Insight fetch/parse error:', err)
        const finalState = hasBiomarkers ? 'labs_saved' : 'no_data'
        console.log('[Meridian] insight error — final state:', finalState)
        setState(finalState)
      }

      setLoading(false)
    }

    loadDashboard()
  }, [router, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/onboarding/welcome')
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}18 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}14 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: '-16px', borderRadius: '50%',
            boxShadow: `0 0 0 1px rgba(103,232,249,0.12), 0 0 32px rgba(45,212,191,0.18)`,
          }} />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '48px', height: '48px',
              border: `2px solid ${colors.cardBorder}`,
              borderTopColor: colors.teal,
              borderRadius: '50%',
              boxShadow: `0 0 16px rgba(45,212,191,0.2)`,
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      fontFamily: fonts.ui,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient orbs — three layers for depth */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '55%', height: '55%', background: `radial-gradient(circle, ${colors.teal}1E 0%, transparent 70%)`, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '55%', height: '55%', background: `radial-gradient(circle, ${colors.cyan}18 0%, transparent 70%)`, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '35%', background: `radial-gradient(circle, ${colors.cyan}0A 0%, transparent 70%)`, filter: 'blur(120px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 24px 100px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px',
          }}
        >
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 18px', borderRadius: '999px',
              border: '1px solid rgba(45,212,191,0.38)',
              background: 'rgba(20,184,166,0.08)',
              color: '#2DD4BF',
              fontSize: '12px', fontWeight: 800, letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: '28px',
            }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                background: colors.teal,
                boxShadow: '0 0 8px rgba(45,212,191,0.7)',
              }} />
              Active Signal
            </div>
            <div style={{
              fontFamily: 'var(--font-fraunces), serif',
              fontSize: '32px',
              fontWeight: 700,
              color: '#EAFBF7',
              letterSpacing: '-0.05em',
              marginBottom: '14px',
            }}>
              Meridian
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '2px' }}>
              Your body is speaking.
            </div>
            <div style={{ fontSize: '14px', color: colors.textSoft }}>
              Let&apos;s see what changed today.
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: '10px',
              color: colors.textMuted,
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: fonts.ui,
              backdropFilter: 'blur(16px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            Log out
          </button>
        </motion.div>

        {/* Intelligence Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {state === 'no_data' && (
            <NoDataBlock onUpload={() => router.push('/labs/upload')} />
          )}
          {state === 'labs_saved' && (
            <LabsSavedBlock
              onHistory={() => router.push('/labs/upload?view=history')}
              onUpload={() => router.push('/labs/upload')}
              hasCritical={hasCriticalMarker}
            />
          )}
          {state === 'calibrating' && (
            <CalibratingBlock onUpload={() => router.push('/labs/upload')} />
          )}
          {(state === 'solved' || state === 'safety_alert') && insight && (
            <SolvedBlock
              insight={insight}
              safetyAlert={safetyAlert}
            />
          )}
        </motion.div>

        {/* Quick Actions — only shown before first labs upload */}
        {state === 'no_data' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            style={{
              marginTop: '24px',
              display: 'flex',
              gap: '12px',
            }}
          >
            <button
              onClick={() => router.push('/labs/upload')}
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: '18px',
                cursor: 'pointer',
                backdropFilter: 'blur(28px)',
                textAlign: 'center',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px rgba(45,212,191,0.04)',
              }}
            >
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>🧪</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text, letterSpacing: '-0.01em' }}>Upload Labs</div>
            </button>
          </motion.div>
        )}

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            marginTop: '32px',
            padding: '16px',
            fontSize: '11px',
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Meridian provides health insights for informational purposes only. It is not medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical decisions. Meridian interprets, you decide.
        </motion.div>
      </div>
      <NavBar />
    </div>
  )
}

// ===== STATE BLOCKS =====

function NoDataBlock({ onUpload }: { onUpload: () => void }) {
  return (
    <div style={{
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '24px',
      borderLeft: `3px solid ${colors.teal}`,
      overflow: 'hidden',
      backdropFilter: 'blur(28px)',
      boxShadow: `0 0 0 1px ${colors.cardBorder}, 0 0 40px rgba(45,212,191,0.07), inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}>
      <div style={{ padding: '28px 24px 20px' }}>
        {/* Status chip */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: colors.teal,
          marginBottom: '16px',
          padding: '4px 10px',
          border: `1px solid rgba(45,212,191,0.25)`,
          borderRadius: '20px',
          background: 'rgba(45,212,191,0.06)',
        }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.teal, boxShadow: `0 0 5px ${colors.teal}` }} />
          Awaiting Biomarker Data
        </div>
        <h2 style={{
          fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700,
          color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px',
        }}>
          Your health intelligence starts with your labs
        </h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65 }}>
          Upload a PDF from your lab provider. Meridian will extract your biomarkers, analyze them, and give you one clear priority for today.
        </p>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <button
          onClick={onUpload}
          style={{
            width: '100%',
            padding: '18px 24px',
            borderRadius: '16px',
            border: 'none',
            background: `linear-gradient(135deg, ${colors.teal}, ${colors.cyan})`,
            color: colors.background,
            fontSize: '16px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: `0 0 24px rgba(45,212,191,0.3), 0 0 60px rgba(45,212,191,0.1), inset 0 1px 0 rgba(255,255,255,0.2)`,
            letterSpacing: '-0.01em',
          }}
        >
          Upload your first lab PDF →
        </button>
        <div style={{ marginTop: '10px', fontSize: '11px', color: colors.textMuted, textAlign: 'center' }}>
          Takes less than 60 seconds · Meridian interprets, you decide.
        </div>
      </div>
    </div>
  )
}

function LabsSavedBlock({
  onHistory,
  onUpload,
  hasCritical = false,
}: {
  onHistory: () => void
  onUpload: () => void
  hasCritical?: boolean
}) {
  const steps = [
    'Review your Lab Snapshot to see current markers',
    'Upload newer labs when available',
    'Insights gain precision as more history accumulates',
  ]

  // ── Safety Engine V1: safety-first copy when critical markers are present ──
  // Non-diagnostic. No treatment language. Output suppression only.
  if (hasCritical) {
    return (
      <div style={{
        backgroundColor: 'rgba(248,113,113,0.05)',
        border: '1px solid rgba(248,113,113,0.22)',
        borderRadius: '24px',
        borderLeft: '3px solid #F87171',
        overflow: 'hidden',
        backdropFilter: 'blur(28px)',
        boxShadow: '0 0 0 1px rgba(248,113,113,0.12), 0 0 40px rgba(248,113,113,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <div style={{ padding: '28px 24px 24px' }}>
          {/* Safety chip */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: '#F87171',
            marginBottom: '16px', padding: '4px 10px',
            border: '1px solid rgba(248,113,113,0.28)', borderRadius: '20px',
            background: 'rgba(248,113,113,0.07)',
          }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#F87171', boxShadow: '0 0 5px #F87171' }} />
            Safety Review
          </div>
          <h2 style={{
            fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700,
            color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px',
          }}>
            Safety review recommended
          </h2>
          <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65, marginBottom: '10px' }}>
            One or more recent biomarkers may require prompt medical review.
          </p>
          <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: 1.7 }}>
            Meridian is limiting optimization guidance until these results are reviewed with a qualified healthcare professional.
          </p>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <button
            onClick={onHistory}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: '16px', border: 'none',
              background: 'linear-gradient(135deg, #F87171, #FB923C)',
              color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 0 24px rgba(248,113,113,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
              letterSpacing: '-0.01em',
            }}
          >
            Review lab results →
          </button>
        </div>
        <div style={{
          padding: '14px 24px',
          borderTop: 'rgba(248,113,113,0.1) solid 1px',
          fontSize: '11px', color: colors.textMuted, textAlign: 'center',
        }}>
          Meridian interprets, you decide · Always consult a qualified professional.
        </div>
      </div>
    )
  }

  // ── Default: baseline building copy ───────────────────────────────────────
  return (
    <div style={{
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '24px',
      borderLeft: `3px solid ${colors.teal}`,
      overflow: 'hidden',
      backdropFilter: 'blur(28px)',
      boxShadow: `0 0 0 1px ${colors.cardBorder}, 0 0 40px rgba(45,212,191,0.08), inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}>
      <div style={{ padding: '28px 24px 20px' }}>
        {/* Status chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: colors.teal,
          marginBottom: '16px', padding: '4px 10px',
          border: `1px solid rgba(45,212,191,0.25)`, borderRadius: '20px',
          background: 'rgba(45,212,191,0.06)',
        }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.teal, boxShadow: `0 0 5px ${colors.teal}` }} />
          Baseline Building
        </div>
        <h2 style={{
          fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700,
          color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px',
        }}>
          Labs received
        </h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65, marginBottom: '12px' }}>
          Meridian is building your biological baseline.
        </p>
        <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: 1.7 }}>
          Your saved lab history is now part of your Meridian profile. Insights become more precise as more lab history and context accumulate.
        </p>
      </div>

      {/* Action steps */}
      <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', gap: '12px', alignItems: 'center',
            padding: '12px 16px',
            backgroundColor: 'rgba(255,255,255,0.025)',
            borderRadius: '14px',
            border: `1px solid ${colors.cardBorder}`,
          }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '8px', flexShrink: 0,
              backgroundColor: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 800, color: colors.teal,
            }}>
              {i + 1}
            </div>
            <span style={{ fontSize: '14px', color: colors.text, lineHeight: 1.4 }}>{step}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div style={{ padding: '0 24px 24px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={onHistory}
          style={{
            flex: 1, minWidth: '160px', padding: '16px 20px', borderRadius: '16px', border: 'none',
            background: `linear-gradient(135deg, ${colors.teal}, ${colors.cyan})`,
            color: colors.background, fontSize: '15px', fontWeight: 800, cursor: 'pointer',
            boxShadow: `0 0 24px rgba(45,212,191,0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
            letterSpacing: '-0.01em',
          }}
        >
          View Lab History →
        </button>
        <button
          onClick={onUpload}
          style={{
            padding: '16px 18px', borderRadius: '16px',
            border: `1px solid ${colors.cardBorder}`,
            background: colors.cardBg, color: colors.textSoft,
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            backdropFilter: 'blur(16px)',
          }}
        >
          Upload
        </button>
      </div>

      {/* Trust line */}
      <div style={{
        padding: '14px 24px',
        borderTop: `1px solid rgba(103,232,249,0.07)`,
        fontSize: '11px', color: colors.textMuted, textAlign: 'center',
      }}>
        Based on your saved biomarkers · Meridian interprets, you decide.
      </div>
    </div>
  )
}

function CalibratingBlock({ onUpload }: { onUpload: () => void }) {
  return (
    <div style={{
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '24px',
      borderLeft: `3px solid ${colors.cyan}`,
      overflow: 'hidden',
      backdropFilter: 'blur(28px)',
      boxShadow: `0 0 0 1px ${colors.cardBorder}, 0 0 40px rgba(103,232,249,0.07), inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}>
      <div style={{ padding: '28px 24px 20px' }}>
        {/* Status chip */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: colors.cyan,
          marginBottom: '16px',
          padding: '4px 10px',
          border: `1px solid rgba(103,232,249,0.25)`,
          borderRadius: '20px',
          background: 'rgba(103,232,249,0.06)',
        }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.cyan, boxShadow: `0 0 5px ${colors.cyan}` }} />
          Calibration State
        </div>
        <h2 style={{
          fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700,
          color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px',
        }}>
          We have your data — building your baseline
        </h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65 }}>
          Meridian is analyzing your biomarkers but does not yet have enough context for a confident insight. Upload additional labs to help Meridian build a stronger signal.
        </p>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <button
          onClick={onUpload}
          style={{
            width: '100%',
            padding: '18px 24px',
            borderRadius: '16px',
            border: 'none',
            background: `linear-gradient(135deg, ${colors.teal}, ${colors.cyan})`,
            color: colors.background,
            fontSize: '16px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: `0 0 24px rgba(45,212,191,0.3), 0 0 60px rgba(45,212,191,0.1), inset 0 1px 0 rgba(255,255,255,0.2)`,
            letterSpacing: '-0.01em',
          }}
        >
          Upload more labs →
        </button>
      </div>
    </div>
  )
}

function SolvedBlock({ insight, safetyAlert }: { insight: GoldenInsight; safetyAlert: boolean }) {
  const bc = getBlockColors(insight.block_color)

  return (
    <div style={{
      backgroundColor: bc.bg,
      border: `1px solid ${bc.border}`,
      borderRadius: '24px',
      borderLeft: `3px solid ${bc.accent}`,
      overflow: 'hidden',
      backdropFilter: 'blur(28px)',
      boxShadow: `0 0 0 1px ${bc.border}, 0 0 48px ${bc.accent}12, inset 0 1px 0 rgba(255,255,255,0.06)`,
    }}>
      {/* Header */}
      <div style={{ padding: '28px 24px 20px', borderBottom: `1px solid ${colors.cardBorder}` }}>
        {/* Top row: signal chip + status badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: bc.accent,
            padding: '4px 10px',
            border: `1px solid ${bc.accent}40`,
            borderRadius: '20px',
            background: `${bc.accent}0D`,
          }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: bc.accent, boxShadow: `0 0 6px ${bc.accent}` }} />
            Biological Signal
          </div>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.09em',
            textTransform: 'uppercase', color: colors.textMuted,
            padding: '3px 10px',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '20px',
            background: colors.cardBg,
          }}>
            Active
          </div>
        </div>

        {safetyAlert && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: '#F87171',
            marginBottom: '12px',
            padding: '4px 10px',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '20px',
            background: 'rgba(248,113,113,0.07)',
          }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#F87171', boxShadow: '0 0 5px #F87171' }} />
            ⚠ Requires Attention
          </div>
        )}

        <h2 style={{
          fontFamily: fonts.heading,
          fontSize: 'clamp(24px, 5vw, 36px)',
          fontWeight: 700,
          color: colors.text,
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          marginBottom: '10px',
        }}>
          {insight.headline}
        </h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.5 }}>
          {insight.status}
        </p>
      </div>

      {/* Cause */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.cardBorder}` }}>
        <p style={{
          fontSize: '14px', color: colors.textSoft, lineHeight: 1.7,
        }}
          dangerouslySetInnerHTML={{
            __html: insight.cause.replace(
              /\*\*(.*?)\*\*/g,
              `<strong style="color: ${colors.text}; font-weight: 700;">$1</strong>`
            )
          }}
        />
      </div>

      {/* Action Steps */}
      <div style={{ padding: '20px 24px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: bc.accent, marginBottom: '14px',
        }}>
          Today&apos;s Priority
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {insight.action_steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                padding: '14px 16px',
                backgroundColor: 'rgba(255,255,255,0.025)',
                borderRadius: '14px',
                border: `1px solid ${colors.cardBorder}`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 0 1px ${bc.accent}08`,
              }}
            >
              <div style={{
                width: '24px', height: '24px', borderRadius: '8px',
                backgroundColor: `${bc.accent}1A`,
                border: `1px solid ${bc.accent}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 800, color: bc.accent,
                flexShrink: 0,
                boxShadow: `0 0 8px ${bc.accent}18`,
              }}>
                {i + 1}
              </div>
              <p style={{ fontSize: '14px', color: colors.text, lineHeight: 1.5 }}>
                {step}
              </p>
            </div>
          ))}
        </div>

        {/* Confidence Trace */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: `1px solid rgba(103,232,249,0.07)`,
        }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: colors.textMuted,
            marginBottom: '6px',
            textAlign: 'center',
          }}>
            Confidence Trace
          </div>
          <div style={{
            fontSize: '11px',
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            {insight.trust_line}
          </div>
        </div>
      </div>
    </div>
  )
}
