'use client'

import { useEffect, useState } from 'react'
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

type StateValue =
  | 'just_started'
  | 'burned_out'
  | 'poor_sleep'
  | 'stressed'
  | 'weight_loss'
  | 'muscle_gain'
  | 'digestive'
  | 'training'
  | 'performance'
  | 'managing_health'

const stateOptions: Array<{ value: StateValue; label: string; sub: string }> = [
  { value: 'just_started',    label: 'Just getting started', sub: 'Beginning my health journey' },
  { value: 'burned_out',      label: 'Burned out',           sub: 'Low energy, running on empty' },
  { value: 'poor_sleep',      label: 'Poor sleep',           sub: 'Inconsistent rest and recovery' },
  { value: 'stressed',        label: 'Frequently stressed',  sub: 'High mental or physical load' },
  { value: 'weight_loss',     label: 'Losing weight',        sub: 'Working toward a lighter body' },
  { value: 'muscle_gain',     label: 'Gaining muscle',       sub: 'Building strength and mass' },
  { value: 'digestive',       label: 'Digestive discomfort', sub: 'Gut health is a focus' },
  { value: 'training',        label: 'Training consistently',sub: 'Active fitness routine' },
  { value: 'performance',     label: 'Performance focused',  sub: 'Optimizing physical output' },
  { value: 'managing_health', label: 'Managing a condition', sub: 'Monitoring something specific' },
]

export default function CurrentStatePage() {
  const router = useRouter()
  const [userId, setUserId]             = useState<string | null>(null)
  const [selected, setSelected]         = useState<StateValue[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  useEffect(() => {
    let isMounted = true
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, birth_date, biological_profile, current_state, user_profile, onboarding_completed')
        .eq('id', user.id)
        .single()
      const nextStep = getNextOnboardingStep(prof)
      if (nextStep === null) { router.push('/dashboard'); return }
      if (nextStep !== '/onboarding/current-state') { router.push(nextStep); return }
      if (isMounted) setUserId(user.id)
    }
    checkAuth()
    return () => { isMounted = false }
  }, [router])

  function toggleState(val: StateValue) {
    setSelected((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    )
  }

  async function handleContinue() {
    if (!userId) return
    setLoading(true)
    setError('')
    const stateJson = JSON.stringify(selected)
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({ id: userId, current_state: stateJson }, { onConflict: 'id' })
    setLoading(false)
    if (upsertError) {
      // If column doesn't exist yet (migration pending), log and proceed gracefully
      console.warn('current-state save error (may need migration):', upsertError.message)
    }
    router.push('/onboarding/goals')
  }

  async function handleSkip() {
    if (!userId) return
    setLoading(true)
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({ id: userId, current_state: '[]' }, { onConflict: 'id' })
    setLoading(false)
    if (upsertError) {
      console.warn('current-state skip save error:', upsertError.message)
    }
    router.push('/onboarding/goals')
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
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '72px 20px 100px',
    }}>
      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(45,212,191,0.13) 0%, transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(103,232,249,0.11) 0%, transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '40%', height: '30%', background: 'radial-gradient(circle, rgba(45,212,191,0.05) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

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
            Current State · Step 2 of 4
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
              fontSize: 'clamp(22px, 4vw, 28px)',
              lineHeight: 1.1, letterSpacing: '-0.04em',
              color: colors.text, fontWeight: 700,
            }}>
              Where are you right now?
            </h1>
            <p style={{ margin: '0 0 5px', color: colors.textSoft, fontSize: '15px', lineHeight: 1.6 }}>
              Select everything that feels true — you can pursue multiple realities at once.
            </p>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: '13px', lineHeight: 1.5 }}>
              Meridian calibrates its signals to your current state.
            </p>
          </div>

          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted }}>
              Select all that apply
            </span>
            <div style={{ flex: 1, height: '1px', background: colors.cardBorder }} />
            {selected.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: colors.teal, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                {selected.length} selected
              </span>
            )}
          </div>

          {/* Chip grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px',
            marginBottom: '8px',
          }}>
            {stateOptions.map((opt, i) => {
              const isOn = selected.includes(opt.value)
              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 * i }}
                  onClick={() => toggleState(opt.value)}
                  style={{
                    textAlign: 'left',
                    border: isOn ? '1px solid rgba(45,212,191,0.85)' : `1px solid ${colors.cardBorder}`,
                    background: isOn ? 'rgba(45,212,191,0.10)' : colors.cardBg,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    color: colors.text,
                    borderRadius: '14px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
                    boxShadow: isOn ? '0 0 0 1px rgba(45,212,191,0.15), 0 0 14px rgba(45,212,191,0.07)' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                  onMouseEnter={(e) => { if (!isOn) e.currentTarget.style.borderColor = 'rgba(45,212,191,0.35)' }}
                  onMouseLeave={(e) => { if (!isOn) e.currentTarget.style.borderColor = colors.cardBorder }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block',
                      fontSize: '13px', fontWeight: 700,
                      color: isOn ? colors.teal : colors.text,
                      letterSpacing: '-0.01em',
                      marginBottom: '3px',
                    }}>
                      {opt.label}
                    </span>
                    <span style={{
                      display: 'block',
                      fontSize: '11px', lineHeight: 1.4,
                      color: isOn ? '#9EEFE4' : colors.textMuted,
                    }}>
                      {opt.sub}
                    </span>
                  </div>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '5px',
                    border: `1.5px solid ${isOn ? colors.teal : colors.cardBorder}`,
                    background: isOn ? colors.teal : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: '1px',
                    transition: 'all 180ms ease',
                  }}>
                    {isOn && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={colors.background} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Validation error */}
          {error && (
            <p style={{ margin: '12px 0 0', color: '#EF4444', fontSize: '13px', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            type="button"
            disabled={loading || !userId}
            onClick={handleContinue}
            style={{
              width: '100%', border: 'none', borderRadius: '14px',
              padding: '16px 20px', marginTop: '24px',
              background: !loading && userId
                ? 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)'
                : 'rgba(45,212,191,0.25)',
              color: '#061316',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '15px', fontWeight: 700,
              cursor: loading || !userId ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.01em',
              boxShadow: !loading && userId
                ? '0 0 24px rgba(45,212,191,0.35), 0 0 60px rgba(45,212,191,0.12), inset 0 1px 0 rgba(255,255,255,0.25)'
                : 'none',
              transition: 'box-shadow 200ms ease, background 200ms ease',
            }}
          >
            {loading ? 'Saving...' : selected.length > 0 ? `Continue with ${selected.length} selected →` : 'Continue →'}
          </button>
        </div>

        {/* Skip link */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            style={{
              background: 'none', border: 'none',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '13px', color: colors.textMuted,
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '8px',
            }}
          >
            Skip for now
          </button>
        </div>
      </motion.section>
    </main>
  )
}
