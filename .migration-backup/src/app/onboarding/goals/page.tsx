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
  | 'primer_paso'
  | 'bienestar'
  | 'optimizacion'
  | 'rendimiento'
  | 'longevidad'
  | 'claridad'
  | 'condicion'

const goals: Array<{ label: string; value: GoalValue; subtext: string }> = [
  { label: 'Just getting started', value: 'primer_paso',   subtext: 'Beginning my health journey' },
  { label: 'Energy & vitality',    value: 'bienestar',     subtext: 'Feel better, day to day' },
  { label: 'Optimization',         value: 'optimizacion',  subtext: "Fine-tune what's already good" },
  { label: 'Peak performance',     value: 'rendimiento',   subtext: 'Push physical and mental limits' },
  { label: 'Longevity',            value: 'longevidad',    subtext: 'Investing in long-term health' },
  { label: 'Clarity & focus',      value: 'claridad',      subtext: 'Cognitive performance and mood' },
  { label: 'Specific condition',   value: 'condicion',     subtext: 'Monitoring something specific' },
]

export default function GoalsPage() {
  const router = useRouter()
  const [userId, setUserId]               = useState<string | null>(null)
  const [selectedGoals, setSelectedGoals] = useState<GoalValue[]>([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  useEffect(() => {
    let isMounted = true
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
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

  function toggleGoal(val: GoalValue) {
    setSelectedGoals((prev) =>
      prev.includes(val) ? prev.filter((g) => g !== val) : [...prev, val]
    )
  }

  const canContinue = useMemo(() => {
    return Boolean(userId && selectedGoals.length > 0 && !loading)
  }, [loading, selectedGoals, userId])

  async function handleContinue() {
    if (!userId || selectedGoals.length === 0) {
      setError('Choose at least one goal to continue.')
      return
    }
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({ id: userId, user_profile: JSON.stringify(selectedGoals) }, { onConflict: 'id' })
    if (updateError) { setError(updateError.message); setLoading(false); return }
    router.push('/onboarding/connect')
  }

  return (
    <main style={{
      minHeight: '100vh',
      color: colors.text,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '72px 20px 100px',
    }}>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 1 }}
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
            Meridian Mode · Step 3 of 4
          </div>
        </div>

        {/* Glass card */}
        <div style={{
          border: `1px solid ${colors.cardBorder}`,
          background: colors.cardBg,
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '28px 24px 24px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 48px rgba(45,212,191,0.06)',
        }}>

          {/* Heading */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{
              margin: '0 0 8px',
              fontFamily: 'var(--font-fraunces), serif',
              fontSize: 'clamp(22px, 4vw, 28px)',
              lineHeight: 1.1, letterSpacing: '-0.04em',
              color: colors.text, fontWeight: 700,
            }}>
              What are you working toward?
            </h1>
            <p style={{ margin: '0 0 4px', color: colors.textSoft, fontSize: '14px', lineHeight: 1.6 }}>
              Select everything that applies — Meridian will balance guidance across all your goals.
            </p>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
              You can change this later from Profile.
            </p>
          </div>

          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted }}>
              Your goals
            </span>
            <div style={{ flex: 1, height: '1px', background: colors.cardBorder }} />
            {selectedGoals.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: colors.teal, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                {selectedGoals.length} selected
              </span>
            )}
          </div>

          {/* Goal cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: '9px',
            marginBottom: '4px',
          }}>
            {goals.map((goal, i) => {
              const isSelected = selectedGoals.includes(goal.value)
              return (
                <motion.button
                  key={goal.value}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.04 * i }}
                  onClick={() => { toggleGoal(goal.value); if (error) setError('') }}
                  style={{
                    textAlign: 'left',
                    border: isSelected ? '1px solid rgba(45,212,191,0.85)' : `1px solid ${colors.cardBorder}`,
                    background: isSelected ? 'rgba(45,212,191,0.10)' : colors.cardBg,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    color: colors.text,
                    borderRadius: '14px',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
                    boxShadow: isSelected ? '0 0 0 1px rgba(45,212,191,0.15), 0 0 16px rgba(45,212,191,0.08)' : 'none',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(45,212,191,0.35)' }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = colors.cardBorder }}
                >
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '4px', color: isSelected ? colors.teal : colors.text, letterSpacing: '-0.01em' }}>
                    {goal.label}
                  </span>
                  <span style={{ display: 'block', color: isSelected ? '#9EEFE4' : colors.textSoft, fontSize: '11px', lineHeight: 1.4 }}>
                    {goal.subtext}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {error ? (
            <p style={{ margin: '14px 0 0', color: '#EF4444', fontSize: '13px', lineHeight: 1.5 }}>
              {error}
            </p>
          ) : null}

          {/* CTA */}
          <button
            type="button"
            disabled={!canContinue}
            onClick={handleContinue}
            style={{
              width: '100%', border: 'none', borderRadius: '12px',
              padding: '14px 18px', marginTop: '20px',
              background: canContinue
                ? 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)'
                : 'rgba(45,212,191,0.25)',
              color: '#061316',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '15px', fontWeight: 700,
              cursor: canContinue ? 'pointer' : 'not-allowed',
              letterSpacing: '-0.01em',
              boxShadow: canContinue
                ? '0 0 24px rgba(45,212,191,0.32), 0 0 56px rgba(45,212,191,0.10), inset 0 1px 0 rgba(255,255,255,0.22)'
                : 'none',
              transition: 'box-shadow 200ms ease, background 200ms ease',
            }}
          >
            {loading ? 'Saving...' : selectedGoals.length > 0
              ? `Continue with ${selectedGoals.length} goal${selectedGoals.length > 1 ? 's' : ''} →`
              : 'Continue →'
            }
          </button>
        </div>
      </motion.section>
    </main>
  )
}
