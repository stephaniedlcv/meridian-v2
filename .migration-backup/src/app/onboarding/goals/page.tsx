'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'
import { getNextOnboardingStep } from '@/lib/onboarding'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
}

type GoalValue =
  | 'bienestar'
  | 'optimizacion'
  | 'rendimiento'
  | 'condicion'
  | 'primer_paso'

const goals: Array<{ label: string; value: GoalValue; subtext: string }> = [
  { label: 'General wellness',   value: 'bienestar',    subtext: 'Feel better day to day' },
  { label: 'Optimization',       value: 'optimizacion', subtext: "Fine-tune what's already good" },
  { label: 'Peak performance',   value: 'rendimiento',  subtext: 'Push physical and mental limits' },
  { label: 'Specific condition', value: 'condicion',    subtext: 'Monitor a specific health concern' },
  { label: 'Getting started',    value: 'primer_paso',  subtext: 'Just beginning my health journey' },
]

export default function GoalsPage() {
  const router = useRouter()
  const [userId, setUserId]           = useState<string | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<GoalValue | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    let isMounted = true
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, birth_date, biological_profile, user_profile, onboarding_completed')
        .eq('id', user.id)
        .single()
      const nextStep = getNextOnboardingStep(prof)
      if (nextStep === null) { router.push('/dashboard'); return }
      if (nextStep !== '/onboarding/goals') { router.push(nextStep); return }
      if (isMounted) setUserId(user.id)
    }
    checkAuth()
    return () => { isMounted = false }
  }, [router])

  const canContinue = useMemo(() => {
    return Boolean(userId && selectedGoal && !loading)
  }, [loading, selectedGoal, userId])

  async function handleContinue() {
    if (!userId || !selectedGoal) {
      setError('Please choose your Meridian mode to continue.')
      return
    }
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({ id: userId, user_profile: selectedGoal }, { onConflict: 'id' })
    if (updateError) { setError(updateError.message); setLoading(false); return }
    router.push('/onboarding/connect')
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: colors.background,
      color: colors.text,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 20px',
    }}>
      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(45,212,191,0.13) 0%, transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(103,232,249,0.11) 0%, transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '40%', height: '30%', background: 'radial-gradient(circle, rgba(45,212,191,0.05) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}
      >
        {/* Step chip */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: colors.teal,
            padding: '5px 14px', border: '1px solid rgba(45,212,191,0.28)',
            borderRadius: '20px', background: 'rgba(45,212,191,0.07)',
          }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.9)' }} />
            Meridian Mode · Step 3
          </div>
        </div>

        {/* Glass card */}
        <div style={{
          border: `1px solid ${colors.cardBorder}`,
          background: colors.cardBg,
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '32px 28px 28px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 48px rgba(45,212,191,0.06)',
        }}>

          {/* Heading */}
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{
              margin: '0 0 8px',
              fontFamily: 'var(--font-fraunces), serif',
              fontSize: 'clamp(24px, 4vw, 30px)',
              lineHeight: 1.08, letterSpacing: '-0.04em',
              color: colors.text, fontWeight: 700,
            }}>
              Choose your Meridian mode
            </h1>
            <p style={{ margin: '0 0 5px', color: colors.textSoft, fontSize: '15px', lineHeight: 1.6 }}>
              Tell Meridian what kind of guidance should matter most right now.
            </p>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: '13px', lineHeight: 1.5 }}>
              You can change this later from Profile.
            </p>
          </div>

          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted }}>
              Your Meridian mode
            </span>
            <div style={{ flex: 1, height: '1px', background: colors.cardBorder }} />
          </div>

          <p style={{ margin: '0 0 16px', color: colors.textSoft, fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em' }}>
            What brings you to Meridian?
          </p>

          {/* Goal cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
            marginBottom: '4px',
          }}>
            {goals.map((goal) => {
              const isSelected = selectedGoal === goal.value
              return (
                <button
                  key={goal.value}
                  type="button"
                  onClick={() => setSelectedGoal(goal.value)}
                  style={{
                    textAlign: 'left',
                    border: isSelected ? '1px solid rgba(45,212,191,0.85)' : `1px solid ${colors.cardBorder}`,
                    background: isSelected ? 'rgba(45,212,191,0.10)' : colors.cardBg,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    color: colors.text,
                    borderRadius: '16px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'border-color 180ms ease, background 180ms ease, transform 180ms ease, box-shadow 180ms ease',
                    boxShadow: isSelected ? '0 0 0 1px rgba(45,212,191,0.15), 0 0 16px rgba(45,212,191,0.08)' : 'none',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '5px', color: isSelected ? colors.teal : colors.text, letterSpacing: '-0.01em' }}>
                    {goal.label}
                  </span>
                  <span style={{ display: 'block', color: isSelected ? '#9EEFE4' : colors.textSoft, fontSize: '12px', lineHeight: 1.45 }}>
                    {goal.subtext}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Error */}
          {error ? (
            <p style={{ margin: '18px 0 0', color: '#EF4444', fontSize: '13px', lineHeight: 1.5 }}>
              {error}
            </p>
          ) : null}

          {/* CTA */}
          <button
            type="button"
            disabled={!canContinue}
            onClick={handleContinue}
            style={{
              width: '100%', border: 'none', borderRadius: '14px',
              padding: '16px 20px', marginTop: '24px',
              background: canContinue
                ? 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)'
                : 'rgba(45,212,191,0.25)',
              color: '#061316',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '15px', fontWeight: 700,
              cursor: canContinue ? 'pointer' : 'not-allowed',
              letterSpacing: '-0.01em',
              boxShadow: canContinue
                ? '0 0 24px rgba(45,212,191,0.35), 0 0 60px rgba(45,212,191,0.12), inset 0 1px 0 rgba(255,255,255,0.25)'
                : 'none',
              transition: 'box-shadow 200ms ease, background 200ms ease',
            }}
          >
            {loading ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      </motion.section>
    </main>
  )
}
