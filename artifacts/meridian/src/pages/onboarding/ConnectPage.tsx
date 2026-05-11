import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'wouter'
import { supabase } from '@/lib/supabase'

const colors = {
  background: '#061316', teal: '#2DD4BF', cyan: '#67E8F9', text: '#EAFBF7',
  textSoft: '#9ACBC1', textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)', cardBorder: 'rgba(103,232,249,0.13)',
}

type ConnectionOption = 'lab' | 'oura' | 'apple'

export default function ConnectPage() {
  const [, navigate] = useLocation()
  const [selected, setSelected] = useState<ConnectionOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/onboarding/welcome')
    })
  }, [navigate])

  const toggle = (opt: ConnectionOption) => setSelected(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt])

  const completeOnboarding = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/onboarding/welcome'); return }
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
    setLoading(false)
  }

  const handleContinue = async () => {
    await completeOnboarding()
    if (selected.includes('lab')) navigate('/labs/upload')
    else navigate('/')
  }

  const handleSkip = async () => {
    await completeOnboarding()
    navigate('/')
  }

  const options = [
    { opt: 'lab' as ConnectionOption, icon: '🧪', title: 'Upload lab PDF', subtitle: "We'll extract your biomarkers" },
    { opt: 'oura' as ConnectionOption, icon: '⬤', title: 'Connect Oura', subtitle: 'HRV, sleep, temperature' },
    { opt: 'apple' as ConnectionOption, icon: '♥', title: 'Connect Apple Health', subtitle: 'Activity, HRV, heart rate' },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: '"Plus Jakarta Sans", sans-serif', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: '32px', fontWeight: 400, color: colors.text, textAlign: 'center', marginBottom: '12px' }}>Connect your data</h1>
        <p style={{ fontSize: '16px', color: colors.textSoft, textAlign: 'center', marginBottom: '40px', lineHeight: 1.6 }}>Meridian gets smarter with every source you add.</p>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          {options.map(({ opt, icon, title, subtitle }, i) => {
            const isSelected = selected.includes(opt)
            return (
              <motion.div key={opt} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}>
                <motion.button onClick={() => toggle(opt)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} style={{ width: '100%', padding: '20px', backgroundColor: isSelected ? `${colors.teal}10` : colors.cardBg, border: `1px solid ${isSelected ? colors.teal : colors.cardBorder}`, borderRadius: '16px', cursor: 'pointer', textAlign: 'left', backdropFilter: 'blur(24px)', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: `${colors.teal}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '20px' }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.text, marginBottom: '4px' }}>{title}</h3>
                    <p style={{ fontSize: '14px', color: colors.textSoft, lineHeight: 1.4 }}>{subtitle}</p>
                  </div>
                  <div style={{ width: '24px', height: '24px', borderRadius: '6px', border: `2px solid ${isSelected ? colors.teal : colors.cardBorder}`, backgroundColor: isSelected ? colors.teal : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#061316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                </motion.button>
              </motion.div>
            )
          })}
        </div>

        <motion.button onClick={handleContinue} disabled={loading} whileHover={loading ? {} : { scale: 1.02 }} whileTap={loading ? {} : { scale: 0.98 }} style={{ width: '100%', padding: '16px 24px', background: loading ? `${colors.teal}60` : `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`, border: 'none', borderRadius: '12px', color: colors.background, fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '16px' }}>
          {loading ? 'Loading...' : 'Continue →'}
        </motion.button>
        <button onClick={handleSkip} disabled={loading} style={{ background: 'none', border: 'none', fontSize: '14px', color: colors.textMuted, cursor: loading ? 'not-allowed' : 'pointer', padding: '8px' }}>
          I'll connect later
        </button>
      </motion.div>
    </div>
  )
}
