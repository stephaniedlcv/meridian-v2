'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'
import { getNextOnboardingStep } from '@/lib/onboarding'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
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

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `1px solid ${colors.cardBorder}`,
  background: 'rgba(6,19,22,0.6)',
  color: colors.text, borderRadius: '12px',
  padding: '12px 16px', fontSize: '15px', outline: 'none',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  lineHeight: '1.5',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  colorScheme: 'dark',
}

type BioProfile = 'female' | 'male' | null

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

export default function IdentityPage() {
  const router = useRouter()

  const [userId, setUserId]         = useState<string | null>(null)
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [birthDate, setBirthDate]   = useState('')
  const [bioProfile, setBioProfile] = useState<BioProfile>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

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
      if (nextStep !== '/onboarding/identity') { router.push(nextStep); return }
      if (isMounted) setUserId(user.id)
    }
    checkAuth()
    return () => { isMounted = false }
  }, [router])

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
  const canContinue = !!userId && !loading &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    !!birthDate &&
    !!bioProfile

  async function handleContinue() {
    if (!userId) return
    if (!firstName.trim()) { setError('First name is required.'); return }
    if (!lastName.trim())  { setError('Last name is required.'); return }
    if (!birthDate)         { setError('Date of birth is required.'); return }
    if (!bioProfile)        { setError('Biological profile is required for accurate reference ranges.'); return }
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: birthDate,
          biological_profile: bioProfile,
        },
        { onConflict: 'id' }
      )
    setLoading(false)
    if (updateError) { setError(updateError.message); return }
    // Re-derive next step from the actual saved profile rather than hardcoding.
    // This means the identity page routes correctly whether or not migration 004
    // (current_state column) has been applied — it follows truth, not assumptions.
    const { data: saved } = await supabase.from('profiles').select('*').eq('id', userId).single()
    router.push(getNextOnboardingStep(saved) ?? '/dashboard')
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
            Personal Context · Step 1 of 4
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
              Personalize Meridian
            </h1>
            <p style={{ margin: '0 0 4px', color: colors.textSoft, fontSize: '14px', lineHeight: 1.6 }}>
              Help Meridian understand your context before it interprets your signals.
            </p>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
              You can update this later from Profile.
            </p>
          </div>

          {/* ── Identity section ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted }}>
              Your identity
            </span>
            <div style={{ flex: 1, height: '1px', background: colors.cardBorder }} />
          </div>

          <div style={{ display: 'grid', gap: '18px', marginBottom: '24px' }}>

            {/* First + Last name */}
            <section>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="first-name" style={{ display: 'block', color: colors.text, fontSize: '13px', fontWeight: 700, marginBottom: '7px', letterSpacing: '-0.01em' }}>
                    First name
                  </label>
                  <input
                    id="first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); if (error) setError('') }}
                    placeholder="First"
                    autoComplete="given-name"
                    style={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="last-name" style={{ display: 'block', color: colors.text, fontSize: '13px', fontWeight: 700, marginBottom: '7px', letterSpacing: '-0.01em' }}>
                    Last name
                  </label>
                  <input
                    id="last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); if (error) setError('') }}
                    placeholder="Last"
                    autoComplete="family-name"
                    style={inputBase}
                  />
                </div>
              </div>
              <p style={{ margin: '6px 0 0', color: colors.textMuted, fontSize: '12px', lineHeight: 1.45 }}>
                Personalizes your biomarker insights, reports, and profile continuity.
              </p>
            </section>

            {/* Date of birth — premium presentation */}
            <section>
              <label htmlFor="birth-date" style={{ display: 'block', color: colors.text, fontSize: '13px', fontWeight: 700, marginBottom: '7px', letterSpacing: '-0.01em' }}>
                Date of birth
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: '14px', top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.textMuted,
                  pointerEvents: 'none',
                  display: 'flex', alignItems: 'center',
                }}>
                  <CalendarIcon />
                </div>
                <input
                  id="birth-date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => { setBirthDate(e.target.value); if (error) setError('') }}
                  style={{
                    ...inputBase,
                    paddingLeft: '40px',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    minHeight: '48px',
                    display: 'block',
                    cursor: 'pointer',
                  }}
                />
              </div>
              <p style={{ margin: '6px 0 0', color: colors.textMuted, fontSize: '12px', lineHeight: 1.45 }}>
                Used to calculate age-adjusted reference ranges for your biomarkers.
              </p>
            </section>
          </div>

          {/* ── Biological profile section ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted }}>
              Biological profile
            </span>
            <div style={{ flex: 1, height: '1px', background: colors.cardBorder }} />
          </div>

          <p style={{ margin: '0 0 12px', color: colors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
            This is about your biology — not your identity. Meridian uses this for accurate clinical reference ranges.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
            {([
              { value: 'female' as const, label: 'Female biology',   sub: 'Female hormonal ranges and cycle context' },
              { value: 'male'   as const, label: 'Male biology',     sub: 'Male hormonal ranges and PSA tracking' },
            ]).map((opt) => {
              const isOn = bioProfile === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setBioProfile(opt.value); if (error) setError('') }}
                  style={{
                    textAlign: 'left',
                    border: isOn ? '1px solid rgba(45,212,191,0.85)' : `1px solid ${colors.cardBorder}`,
                    background: isOn ? 'rgba(45,212,191,0.10)' : colors.cardBg,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    color: colors.text,
                    borderRadius: '14px',
                    padding: '13px 14px',
                    cursor: 'pointer',
                    transition: 'border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
                    boxShadow: isOn ? '0 0 0 1px rgba(45,212,191,0.15), 0 0 14px rgba(45,212,191,0.07)' : 'none',
                  }}
                  onMouseEnter={(e) => { if (!isOn) e.currentTarget.style.borderColor = 'rgba(45,212,191,0.35)' }}
                  onMouseLeave={(e) => { if (!isOn) e.currentTarget.style.borderColor = colors.cardBorder }}
                >
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '3px', color: isOn ? colors.teal : colors.text, letterSpacing: '-0.01em' }}>
                    {opt.label}
                  </span>
                  <span style={{ display: 'block', color: isOn ? '#9EEFE4' : colors.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                    {opt.sub}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Validation error */}
          {error && (
            <p style={{ margin: '10px 0 0', color: '#EF4444', fontSize: '13px', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

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
            {loading ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      </motion.section>
    </main>
  )
}
