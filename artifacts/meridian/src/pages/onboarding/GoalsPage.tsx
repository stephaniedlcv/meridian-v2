import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'

type GoalValue = 'bienestar' | 'optimizacion' | 'rendimiento' | 'condicion' | 'primer_paso'

const goals = [
  { label: 'General wellness', value: 'bienestar' as GoalValue, subtext: 'Feel better day to day' },
  { label: 'Optimization', value: 'optimizacion' as GoalValue, subtext: "Fine-tune what's already good" },
  { label: 'Peak performance', value: 'rendimiento' as GoalValue, subtext: 'Push physical and mental limits' },
  { label: 'Specific condition', value: 'condicion' as GoalValue, subtext: 'Monitor a specific health concern' },
  { label: 'Getting started', value: 'primer_paso' as GoalValue, subtext: 'Just beginning my health journey' },
]

export default function GoalsPage() {
  const [, navigate] = useLocation()
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<GoalValue | null>(null)
  const [birthDate, setBirthDate] = useState('')
  const [medications, setMedications] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/onboarding/welcome')
      else setUserId(user.id)
    })
  }, [navigate])

  const canContinue = useMemo(() => Boolean(userId && selectedGoal && birthDate && !loading), [userId, selectedGoal, birthDate, loading])

  async function handleContinue() {
    if (!userId || !selectedGoal || !birthDate) { setError('Please complete your health goal and date of birth.'); return }
    setLoading(true); setError('')
    const medicationArray = medications.split(',').map(s => s.trim()).filter(Boolean)
    const { error: updateError } = await supabase.from('profiles').update({ user_profile: selectedGoal, birth_date: birthDate, medications: medicationArray }).eq('id', userId)
    if (updateError) { setError(updateError.message); setLoading(false); return }
    navigate('/onboarding/connect')
  }

  return (
    <main style={{ minHeight: '100vh', background: '#061316', color: '#EAFBF7', fontFamily: 'Plus Jakarta Sans, sans-serif', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
      <div style={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,191,0.28), transparent 68%)', top: -110, left: -105, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 390, height: 390, borderRadius: '50%', background: 'radial-gradient(circle, rgba(103,232,249,0.22), transparent 70%)', right: -125, bottom: -120, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }} style={{ width: '100%', maxWidth: 760, position: 'relative', zIndex: 1 }}>
        <div style={{ border: '1px solid rgba(103,232,249,0.13)', background: 'rgba(232,248,245,0.055)', backdropFilter: 'blur(24px)', borderRadius: 28, padding: '34px', boxShadow: '0 24px 80px rgba(0,0,0,0.24)' }}>
          <div style={{ marginBottom: 28 }}>
            <p style={{ margin: '0 0 12px', color: '#2DD4BF', fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>Extended profile</p>
            <h1 style={{ margin: 0, fontFamily: 'Fraunces, serif', fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: 1.02, letterSpacing: '-0.04em', color: '#EAFBF7' }}>What's your health goal?</h1>
            <p style={{ margin: '14px 0 0', color: '#9ACBC1', fontSize: 16, lineHeight: 1.65 }}>This helps Meridian prioritize what matters most to you.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 30 }}>
            {goals.map((goal) => {
              const selected = selectedGoal === goal.value
              return (
                <button key={goal.value} type="button" onClick={() => setSelectedGoal(goal.value)} style={{ textAlign: 'left', border: selected ? '1px solid rgba(45,212,191,0.92)' : '1px solid rgba(103,232,249,0.13)', background: selected ? 'rgba(45,212,191,0.14)' : 'rgba(232,248,245,0.055)', backdropFilter: 'blur(24px)', color: '#EAFBF7', borderRadius: 18, padding: '18px 18px 17px', cursor: 'pointer', transition: 'all 180ms ease' }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{goal.label}</span>
                  <span style={{ display: 'block', color: selected ? '#9EEFE4' : '#9ACBC1', fontSize: 13, lineHeight: 1.45 }}>{goal.subtext}</span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gap: 22 }}>
            <section>
              <label style={{ display: 'block', color: '#EAFBF7', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Date of birth</label>
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(103,232,249,0.13)', background: 'rgba(232,248,245,0.055)', color: '#EAFBF7', borderRadius: 14, padding: '15px 16px', fontSize: 15, outline: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' }} />
              <p style={{ margin: '8px 0 0', color: '#5F8E85', fontSize: 12 }}>Used for age-adjusted reference ranges</p>
            </section>
            <section>
              <label style={{ display: 'block', color: '#EAFBF7', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Current medications <span style={{ color: '#5F8E85', fontWeight: 500 }}>(optional)</span></label>
              <input type="text" value={medications} onChange={e => setMedications(e.target.value)} placeholder="e.g. Levothyroxine, Metformin" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(103,232,249,0.13)', background: 'rgba(232,248,245,0.055)', color: '#EAFBF7', borderRadius: 14, padding: '15px 16px', fontSize: 15, outline: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' }} />
              <p style={{ margin: '8px 0 0', color: '#5F8E85', fontSize: 12 }}>Separate with commas. Leave blank if none.</p>
            </section>
          </div>

          {error && <p style={{ margin: '20px 0 0', color: '#67E8F9', fontSize: 13 }}>{error}</p>}

          <button type="button" disabled={!canContinue} onClick={handleContinue} style={{ width: '100%', border: 'none', borderRadius: 12, padding: '16px 20px', marginTop: 28, background: canContinue ? 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)' : 'linear-gradient(135deg, rgba(45,212,191,0.32) 0%, rgba(103,232,249,0.26) 100%)', color: '#061316', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 800, cursor: canContinue ? 'pointer' : 'not-allowed' }}>
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </motion.section>
    </main>
  )
}
