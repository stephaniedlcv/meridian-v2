import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'wouter'
import { supabase } from '@/lib/supabase'
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
  const [, navigate] = useLocation()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [state, setState] = useState<string>('loading')
  const [insight, setInsight] = useState<GoldenInsight | null>(null)
  const [safetyAlert, setSafetyAlert] = useState(false)

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/onboarding/welcome'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, onboarding_completed')
        .eq('id', user.id)
        .single()

      if (profile && !profile.onboarding_completed) {
        navigate('/onboarding/profile')
        return
      }

      setUserName(profile?.full_name || user.email?.split('@')[0] || 'there')

      try {
        const response = await fetch(`/api/insight?user_id=${user.id}`)
        const data = await response.json()
        if (data.success) {
          setState(data.state)
          setInsight(data.insight)
          setSafetyAlert(data.safety_alert)
        } else {
          setState('no_data')
        }
      } catch {
        setState('no_data')
      }

      setLoading(false)
    }
    loadDashboard()
  }, [navigate])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/onboarding/welcome')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{ width: '48px', height: '48px', border: `3px solid ${colors.cardBorder}`, borderTopColor: colors.teal, borderRadius: '50%' }}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: fonts.ui, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}15 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}15 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 24px 100px', position: 'relative', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div style={{ fontFamily: fonts.heading, fontSize: '24px', fontWeight: 400, background: `linear-gradient(135deg, ${colors.teal}, ${colors.cyan})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '4px' }}>Meridian</div>
            <div style={{ fontSize: '14px', color: colors.textMuted }}>Hi, {userName}</div>
          </div>
          <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', color: colors.textMuted, fontSize: '13px', cursor: 'pointer', fontFamily: fonts.ui }}>Log out</button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          {state === 'no_data' && <NoDataBlock onUpload={() => navigate('/labs/upload')} />}
          {state === 'calibrating' && <CalibratingBlock onUpload={() => navigate('/labs/upload')} />}
          {(state === 'solved' || state === 'safety_alert') && insight && <SolvedBlock insight={insight} safetyAlert={safetyAlert} />}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/labs/upload')} style={{ flex: 1, padding: '16px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', cursor: 'pointer', backdropFilter: 'blur(24px)', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '6px' }}>🧪</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>Upload Labs</div>
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ marginTop: '32px', padding: '16px', fontSize: '11px', color: colors.textMuted, textAlign: 'center', lineHeight: 1.6 }}>
          Meridian provides health insights for informational purposes only. It is not medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical decisions. Meridian interprets, you decide.
        </motion.div>
      </div>
      <NavBar />
    </div>
  )
}

function NoDataBlock({ onUpload }: { onUpload: () => void }) {
  return (
    <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '24px', borderLeft: `4px solid ${colors.teal}`, overflow: 'hidden', backdropFilter: 'blur(24px)' }}>
      <div style={{ padding: '28px 24px 20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.teal, marginBottom: '14px' }}>Getting started</div>
        <h2 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px' }}>Your health intelligence starts with your labs</h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65 }}>Upload a PDF from your lab provider. Meridian will extract your biomarkers, analyze them, and give you one clear priority for today.</p>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <button onClick={onUpload} style={{ width: '100%', padding: '18px 24px', borderRadius: '16px', border: 'none', background: `linear-gradient(135deg, ${colors.teal}, ${colors.cyan})`, color: colors.background, fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}>Upload your first lab PDF →</button>
        <div style={{ marginTop: '10px', fontSize: '11px', color: colors.textMuted, textAlign: 'center' }}>Takes less than 60 seconds · Meridian interprets, you decide.</div>
      </div>
    </div>
  )
}

function CalibratingBlock({ onUpload }: { onUpload: () => void }) {
  return (
    <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '24px', borderLeft: `4px solid ${colors.cyan}`, overflow: 'hidden', backdropFilter: 'blur(24px)' }}>
      <div style={{ padding: '28px 24px 20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.cyan, marginBottom: '14px' }}>Calibrating</div>
        <h2 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px' }}>We have your data — building your baseline</h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65 }}>Meridian is analyzing your biomarkers but needs more data points to generate a confident insight. Upload additional labs to accelerate your first intelligence report.</p>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <button onClick={onUpload} style={{ width: '100%', padding: '18px 24px', borderRadius: '16px', border: 'none', background: `linear-gradient(135deg, ${colors.teal}, ${colors.cyan})`, color: colors.background, fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}>Upload more labs →</button>
      </div>
    </div>
  )
}

function SolvedBlock({ insight, safetyAlert }: { insight: GoldenInsight; safetyAlert: boolean }) {
  const bc = getBlockColors(insight.block_color)
  return (
    <div style={{ backgroundColor: bc.bg, border: `1px solid ${bc.border}`, borderRadius: '24px', borderLeft: `4px solid ${bc.accent}`, overflow: 'hidden', backdropFilter: 'blur(24px)' }}>
      <div style={{ padding: '28px 24px 20px', borderBottom: `1px solid ${colors.cardBorder}` }}>
        {safetyAlert && <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F87171', marginBottom: '10px' }}>⚠ Requires attention</div>}
        <h2 style={{ fontFamily: fonts.heading, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '10px' }}>{insight.headline}</h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.5 }}>{insight.status}</p>
      </div>
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.cardBorder}` }}>
        <p style={{ fontSize: '14px', color: colors.textSoft, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: insight.cause.replace(/\*\*(.*?)\*\*/g, `<strong style="color: ${colors.text}; font-weight: 700;">$1</strong>`) }} />
      </div>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: bc.accent, marginBottom: '14px' }}>Today's actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {insight.action_steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: '12px', border: `1px solid ${colors.cardBorder}` }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '8px', backgroundColor: `${bc.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: bc.accent, flexShrink: 0 }}>{i + 1}</div>
              <p style={{ fontSize: '14px', color: colors.text, lineHeight: 1.5 }}>{step}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '16px', fontSize: '11px', color: colors.textMuted, textAlign: 'center', lineHeight: 1.5 }}>{insight.trust_line}</div>
      </div>
    </div>
  )
}
