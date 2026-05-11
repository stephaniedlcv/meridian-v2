'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'

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

const goals: Array<{
  label: string
  value: GoalValue
  subtext: string
}> = [
  {
    label: 'General wellness',
    value: 'bienestar',
    subtext: 'Feel better day to day',
  },
  {
    label: 'Optimization',
    value: 'optimizacion',
    subtext: "Fine-tune what's already good",
  },
  {
    label: 'Peak performance',
    value: 'rendimiento',
    subtext: 'Push physical and mental limits',
  },
  {
    label: 'Specific condition',
    value: 'condicion',
    subtext: 'Monitor a specific health concern',
  },
  {
    label: 'Getting started',
    value: 'primer_paso',
    subtext: 'Just beginning my health journey',
  },
]

export default function GoalsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<GoalValue | null>(null)
  const [birthDate, setBirthDate] = useState('')
  const [medications, setMedications] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/onboarding/welcome')
        return
      }

      if (isMounted) {
        setUserId(user.id)
      }
    }

    checkAuth()

    return () => {
      isMounted = false
    }
  }, [router])

  const canContinue = useMemo(() => {
    return Boolean(userId && selectedGoal && birthDate && !loading)
  }, [birthDate, loading, selectedGoal, userId])

  async function handleContinue() {
    if (!userId || !selectedGoal || !birthDate) {
      setError('Please complete your health goal and date of birth.')
      return
    }

    setLoading(true)
    setError('')

    const medicationArray = medications
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        user_profile: selectedGoal,
        birth_date: birthDate,
        medications: medicationArray,
      })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push('/onboarding/connect')
  }

  return (
    <main
      style={{
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
      }}
    >
      {/* Ambient orbs — 3 layers matching landing/welcome */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%',
        width: '55%', height: '55%',
        background: 'radial-gradient(circle, rgba(45,212,191,0.13) 0%, transparent 70%)',
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: '55%', height: '55%',
        background: 'radial-gradient(circle, rgba(103,232,249,0.11) 0%, transparent 70%)',
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '40%', height: '30%',
        background: 'radial-gradient(circle, rgba(45,212,191,0.05) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: '480px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Premium pill chip — "Extended profile" */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '9px',
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: colors.teal,
            padding: '5px 12px',
            border: '1px solid rgba(45,212,191,0.25)',
            borderRadius: '20px',
            background: 'rgba(45,212,191,0.06)',
          }}>
            <div style={{
              width: '4px', height: '4px', borderRadius: '50%',
              background: colors.teal,
              boxShadow: '0 0 6px rgba(45,212,191,0.9)',
            }} />
            Extended Profile · Step 2
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

          {/* Heading block */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{
              margin: '0 0 10px',
              fontFamily: 'var(--font-fraunces), serif',
              fontSize: 'clamp(28px, 5vw, 40px)',
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              color: colors.text,
              fontWeight: 700,
            }}>
              What&apos;s your health goal?
            </h1>
            <p style={{
              margin: 0,
              color: colors.textSoft,
              fontSize: '15px',
              lineHeight: 1.65,
            }}>
              This helps Meridian prioritize what matters most to you.
            </p>
          </div>

          {/* Goal selection grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '28px',
          }}>
            {goals.map((goal) => {
              const selected = selectedGoal === goal.value

              return (
                <button
                  key={goal.value}
                  type="button"
                  onClick={() => setSelectedGoal(goal.value)}
                  style={{
                    textAlign: 'left',
                    border: selected
                      ? '1px solid rgba(45,212,191,0.85)'
                      : `1px solid ${colors.cardBorder}`,
                    background: selected
                      ? 'rgba(45,212,191,0.10)'
                      : colors.cardBg,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    color: colors.text,
                    borderRadius: '16px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'border-color 180ms ease, background 180ms ease, transform 180ms ease, box-shadow 180ms ease',
                    boxShadow: selected
                      ? '0 0 0 1px rgba(45,212,191,0.15), 0 0 16px rgba(45,212,191,0.08)'
                      : 'none',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <span style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 700,
                    marginBottom: '5px',
                    color: selected ? colors.teal : colors.text,
                    letterSpacing: '-0.01em',
                  }}>
                    {goal.label}
                  </span>
                  <span style={{
                    display: 'block',
                    color: selected ? '#9EEFE4' : colors.textSoft,
                    fontSize: '12px',
                    lineHeight: 1.45,
                  }}>
                    {goal.subtext}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Form fields */}
          <div style={{ display: 'grid', gap: '20px' }}>
            <section>
              <label
                htmlFor="birth-date"
                style={{
                  display: 'block',
                  color: colors.text,
                  fontSize: '14px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  letterSpacing: '-0.01em',
                }}
              >
                Date of birth
              </label>
              <input
                id="birth-date"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1px solid ${colors.cardBorder}`,
                  background: 'rgba(6,19,22,0.6)',
                  color: colors.text,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '15px',
                  outline: 'none',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  colorScheme: 'dark',
                }}
              />
              <p style={{
                margin: '7px 0 0',
                color: colors.textMuted,
                fontSize: '12px',
                lineHeight: 1.45,
              }}>
                Used for age-adjusted reference ranges
              </p>
            </section>

            <section>
              <label
                htmlFor="medications"
                style={{
                  display: 'block',
                  color: colors.text,
                  fontSize: '14px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  letterSpacing: '-0.01em',
                }}
              >
                Current medications{' '}
                <span style={{ color: colors.textMuted, fontWeight: 500 }}>(optional)</span>
              </label>
              <input
                id="medications"
                type="text"
                value={medications}
                onChange={(event) => setMedications(event.target.value)}
                placeholder="e.g. Levothyroxine, Metformin"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1px solid ${colors.cardBorder}`,
                  background: 'rgba(6,19,22,0.6)',
                  color: colors.text,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '15px',
                  outline: 'none',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              />
              <p style={{
                margin: '7px 0 0',
                color: colors.textMuted,
                fontSize: '12px',
                lineHeight: 1.45,
              }}>
                Separate with commas. This helps us flag interactions. Leave blank if none.
              </p>
            </section>
          </div>

          {/* Error message */}
          {error ? (
            <p style={{
              margin: '18px 0 0',
              color: '#EF4444',
              fontSize: '13px',
              lineHeight: 1.5,
            }}>
              {error}
            </p>
          ) : null}

          {/* CTA button */}
          <button
            type="button"
            disabled={!canContinue}
            onClick={handleContinue}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '14px',
              padding: '16px 20px',
              marginTop: '24px',
              background: canContinue
                ? 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)'
                : 'rgba(45,212,191,0.25)',
              color: '#061316',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '15px',
              fontWeight: 700,
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
