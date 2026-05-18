'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
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
}

type ConnectionOption = 'lab'

const FlaskIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22h12" />
    <path d="M9 2v5.33L5 17.5V20a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.5L15 7.33V2" />
    <path d="M9 2h6" />
    <path d="M8 14h8" />
  </svg>
)

const CircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
  </svg>
)

const HeartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
)

// Supabase client at module level — stable reference, never changes between renders.
// Matches the pattern used by identity/page.tsx and goals/page.tsx.
// DO NOT move this inside the component: an in-component client would be a new
// object reference every render, causing the useEffect (which depends on it) to
// re-fire on every render and loop router.push calls for completed users.
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ConnectPage() {
  const router = useRouter()

  const [selected, setSelected] = useState<ConnectionOption[]>([])
  const [loading, setLoading] = useState(false)
  const [completeError, setCompleteError] = useState('')

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      const nextStep = getNextOnboardingStep(prof)
      if (nextStep === null) { router.push('/dashboard'); return }
      if (nextStep !== '/onboarding/connect') { router.push(nextStep); return }
    }
    checkUser()
  // supabase is now module-level (stable) — safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const toggleSelection = (option: ConnectionOption) => {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    )
  }

  const completeOnboarding = async (): Promise<boolean> => {
    setLoading(true)
    setCompleteError('')
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('completeOnboarding: auth error', userError)
        router.push('/onboarding/welcome')
        return false
      }
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, onboarding_completed: true }, { onConflict: 'id' })
      if (error) {
        console.error('completeOnboarding: upsert failed', error)
        setCompleteError('Unable to save your progress. Please try again.')
        return false
      }
      return true
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = async () => {
    const ok = await completeOnboarding()
    if (!ok) return
    if (selected.includes('lab')) { router.push('/labs/upload'); return }
    router.push('/')
  }

  const handleSkip = async () => {
    const ok = await completeOnboarding()
    if (!ok) return
    router.push('/')
  }

  const ConnectionCard = ({
    option, icon, title, subtitle,
  }: {
    option: ConnectionOption
    icon: React.ReactNode
    title: string
    subtitle: string
  }) => {
    const isSelected = selected.includes(option)
    return (
      <button
        onClick={() => toggleSelection(option)}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: isSelected ? 'rgba(45,212,191,0.10)' : colors.cardBg,
          border: isSelected ? '1px solid rgba(45,212,191,0.85)' : `1px solid ${colors.cardBorder}`,
          borderRadius: '16px',
          cursor: 'pointer',
          textAlign: 'left',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          transition: 'border-color 180ms ease, background 180ms ease, transform 180ms ease, box-shadow 180ms ease',
          boxShadow: isSelected ? '0 0 0 1px rgba(45,212,191,0.15), 0 0 16px rgba(45,212,191,0.08)' : 'none',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          backgroundColor: 'rgba(45,212,191,0.08)',
          border: `1px solid ${colors.cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '14px', fontWeight: 700,
            color: isSelected ? colors.teal : colors.text,
            marginBottom: '4px', letterSpacing: '-0.01em',
          }}>
            {title}
          </h3>
          <p style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '12px',
            color: isSelected ? '#9EEFE4' : colors.textSoft,
            lineHeight: 1.45,
          }}>
            {subtitle}
          </p>
        </div>
        <div style={{
          width: '22px', height: '22px', borderRadius: '6px',
          border: `2px solid ${isSelected ? colors.teal : colors.cardBorder}`,
          backgroundColor: isSelected ? colors.teal : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 180ms ease',
        }}>
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.background} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </button>
    )
  }

  return (
    <main style={{
      minHeight: '100vh',
      color: colors.text,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 20px',
    }}>

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
            Connect Data · Step 4 of 4
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
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{
              margin: '0 0 10px',
              fontFamily: 'var(--font-fraunces), serif',
              fontSize: 'clamp(24px, 4vw, 30px)',
              lineHeight: 1.08,
              letterSpacing: '-0.04em',
              color: colors.text,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              Connect your data
            </h1>
            <p style={{ margin: 0, color: colors.textSoft, fontSize: '15px', lineHeight: 1.65 }}>
              Meridian gets smarter with every source you add.
            </p>
          </div>

          {/* Connection cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <ConnectionCard option="lab" icon={<FlaskIcon />} title="Upload lab PDF" subtitle="We'll extract your biomarkers" />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <div style={{
                width: '100%', padding: '16px',
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: '16px', textAlign: 'left',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'flex-start', gap: '16px',
                opacity: 0.55, cursor: 'default',
              }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(45,212,191,0.08)', border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CircleIcon />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 700, color: colors.text, margin: 0, letterSpacing: '-0.01em' }}>Oura Ring</h3>
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted, padding: '2px 7px', borderRadius: '8px', border: `1px solid ${colors.cardBorder}`, background: 'rgba(232,248,245,0.04)', flexShrink: 0 }}>Coming soon</span>
                  </div>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: colors.textMuted, lineHeight: 1.45, margin: 0 }}>HRV, sleep, and temperature — in a future update.</p>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
              <div style={{
                width: '100%', padding: '16px',
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: '16px', textAlign: 'left',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'flex-start', gap: '16px',
                opacity: 0.55, cursor: 'default',
              }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(45,212,191,0.08)', border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HeartIcon />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 700, color: colors.text, margin: 0, letterSpacing: '-0.01em' }}>Apple Health</h3>
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted, padding: '2px 7px', borderRadius: '8px', border: `1px solid ${colors.cardBorder}`, background: 'rgba(232,248,245,0.04)', flexShrink: 0 }}>Coming soon</span>
                  </div>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: colors.textMuted, lineHeight: 1.45, margin: 0 }}>Activity, HRV, and heart rate — in a future update.</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Save error */}
          {completeError ? (
            <p style={{ margin: '0 0 14px', color: '#EF4444', fontSize: '13px', lineHeight: 1.5 }}>
              {completeError}
            </p>
          ) : null}

          {/* CTA */}
          <button
            type="button"
            disabled={loading}
            onClick={handleContinue}
            style={{
              width: '100%', border: 'none', borderRadius: '14px',
              padding: '14px 18px',
              background: loading ? 'rgba(45,212,191,0.25)' : 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)',
              color: '#061316',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '15px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.01em',
              boxShadow: loading
                ? 'none'
                : '0 0 24px rgba(45,212,191,0.32), 0 0 56px rgba(45,212,191,0.10), inset 0 1px 0 rgba(255,255,255,0.22)',
              transition: 'box-shadow 200ms ease, background 200ms ease',
            }}
          >
            {loading ? 'Loading...' : 'Continue →'}
          </button>
        </div>

        {/* Skip — below the card */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <button
            onClick={handleSkip}
            disabled={loading}
            style={{
              background: 'none', border: 'none',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '14px', color: colors.textMuted,
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '8px',
            }}
          >
            I&apos;ll connect later
          </button>
        </div>
      </motion.section>
    </main>
  )
}
