'use client'

import { useEffect, useState } from 'react'
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

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `1px solid ${colors.cardBorder}`,
  background: 'rgba(6,19,22,0.6)',
  color: colors.text, borderRadius: '12px',
  padding: '14px 16px', fontSize: '15px', outline: 'none',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  colorScheme: 'dark',
}

export default function IdentityPage() {
  const router = useRouter()

  const [userId, setUserId]       = useState<string | null>(null)
  const [fullName, setFullName]   = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [medications, setMedications] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    let isMounted = true
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }
      if (isMounted) setUserId(user.id)
    }
    checkAuth()
    return () => { isMounted = false }
  }, [router])

  async function handleContinue() {
    if (!userId) return
    setLoading(true)
    setError('')
    const medicationArray = medications.split(',').map((s) => s.trim()).filter(Boolean)
    // All fields optional — only include full_name if user typed something
    const payload: Record<string, unknown> = {
      birth_date: birthDate || null,
      medications: medicationArray,
    }
    if (fullName.trim()) payload.full_name = fullName.trim()
    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
    setLoading(false)
    if (updateError) { setError(updateError.message); return }
    router.push('/onboarding/profile')
  }

  const canContinue = !!userId && !loading

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
            Personal Context · Step 1
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
              Personalize Meridian
            </h1>
            <p style={{ margin: '0 0 5px', color: colors.textSoft, fontSize: '15px', lineHeight: 1.6 }}>
              Help Meridian understand your context before it interprets your signals.
            </p>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: '13px', lineHeight: 1.5 }}>
              You can update this later from Profile.
            </p>
          </div>

          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted }}>
              Your identity
            </span>
            <div style={{ flex: 1, height: '1px', background: colors.cardBorder }} />
          </div>

          {/* Fields */}
          <div style={{ display: 'grid', gap: '20px', marginBottom: '8px' }}>

            {/* Display name */}
            <section>
              <label htmlFor="display-name" style={{ display: 'block', color: colors.text, fontSize: '14px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.01em' }}>
                Display name{' '}
                <span style={{ color: colors.textMuted, fontWeight: 500 }}>(optional)</span>
              </label>
              <input
                id="display-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Stephanie"
                style={inputStyle}
              />
              <p style={{ margin: '7px 0 0', color: colors.textMuted, fontSize: '12px', lineHeight: 1.45 }}>
                This is how Meridian will address you inside the app.
              </p>
            </section>

            {/* Date of birth */}
            <section>
              <label htmlFor="birth-date" style={{ display: 'block', color: colors.text, fontSize: '14px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.01em' }}>
                Date of birth{' '}
                <span style={{ color: colors.textMuted, fontWeight: 500 }}>(optional)</span>
              </label>
              <input
                id="birth-date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                style={inputStyle}
              />
              <p style={{ margin: '7px 0 0', color: colors.textMuted, fontSize: '12px', lineHeight: 1.45 }}>
                Used for age-adjusted biological context.
              </p>
            </section>

            {/* Medications */}
            <section>
              <label htmlFor="medications" style={{ display: 'block', color: colors.text, fontSize: '14px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.01em' }}>
                Current medications{' '}
                <span style={{ color: colors.textMuted, fontWeight: 500 }}>(optional)</span>
              </label>
              <input
                id="medications"
                type="text"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="e.g. Levothyroxine, Metformin"
                style={inputStyle}
              />
              <p style={{ margin: '7px 0 0', color: colors.textMuted, fontSize: '12px', lineHeight: 1.45 }}>
                Separate with commas. Leave blank if none.
              </p>
            </section>
          </div>

          {/* Error */}
          {error && (
            <p style={{ margin: '12px 0 0', color: '#EF4444', fontSize: '13px', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

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
