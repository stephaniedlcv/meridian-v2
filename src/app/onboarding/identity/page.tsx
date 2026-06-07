'use client'

import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'
import { getNextOnboardingStep } from '@/lib/onboarding'
import { useMeridianLanguage } from '@/lib/i18n'

const supabase = createBrowserClient(
  getSupabaseUrl(),
  getSupabasePublishableKey()
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
  const [lang] = useMeridianLanguage()

  const [userId, setUserId]         = useState<string | null>(null)
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [birthDate, setBirthDate]   = useState('')
  const [bioProfile, setBioProfile] = useState<BioProfile>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const copy = lang === 'es'
    ? {
        step: 'Contexto personal · Paso 1 de 4',
        title: 'Personaliza Meridian',
        subtitle: 'Ayuda a Meridian a entender tu contexto antes de interpretar tus señales.',
        profileNote: 'Podrás actualizar esto luego desde Perfil.',
        identitySection: 'Tu identidad',
        firstName: 'Nombre',
        lastName: 'Apellido',
        firstPlaceholder: 'Nombre',
        lastPlaceholder: 'Apellido',
        identityHelp: 'Personaliza tus insights de biomarcadores, reportes y continuidad del perfil.',
        birthDate: 'Fecha de nacimiento',
        birthDateHelp: 'Se usa para calcular rangos de referencia ajustados por edad para tus biomarcadores.',
        biologicalProfile: 'Perfil biológico',
        biologicalProfileHelp: 'Esto se refiere a tu biología, no a tu identidad. Meridian lo usa para rangos clínicos de referencia más precisos.',
        femaleLabel: 'Biología femenina',
        femaleSub: 'Rangos hormonales femeninos y contexto de ciclo',
        maleLabel: 'Biología masculina',
        maleSub: 'Rangos hormonales masculinos y seguimiento de PSA',
        errors: {
          firstName: 'El nombre es requerido.',
          lastName: 'El apellido es requerido.',
          birthDate: 'La fecha de nacimiento es requerida.',
          biologicalProfile: 'El perfil biológico es requerido para calcular rangos de referencia precisos.',
        },
        saving: 'Guardando...',
        continue: 'Continuar →',
      }
    : {
        step: 'Personal Context · Step 1 of 4',
        title: 'Personalize Meridian',
        subtitle: 'Help Meridian understand your context before it interprets your signals.',
        profileNote: 'You can update this later from Profile.',
        identitySection: 'Your identity',
        firstName: 'First name',
        lastName: 'Last name',
        firstPlaceholder: 'First',
        lastPlaceholder: 'Last',
        identityHelp: 'Personalizes your biomarker insights, reports, and profile continuity.',
        birthDate: 'Date of birth',
        birthDateHelp: 'Used to calculate age-adjusted reference ranges for your biomarkers.',
        biologicalProfile: 'Biological profile',
        biologicalProfileHelp: 'This is about your biology — not your identity. Meridian uses this for accurate clinical reference ranges.',
        femaleLabel: 'Female biology',
        femaleSub: 'Female hormonal ranges and cycle context',
        maleLabel: 'Male biology',
        maleSub: 'Male hormonal ranges and PSA tracking',
        errors: {
          firstName: 'First name is required.',
          lastName: 'Last name is required.',
          birthDate: 'Date of birth is required.',
          biologicalProfile: 'Biological profile is required for accurate reference ranges.',
        },
        saving: 'Saving...',
        continue: 'Continue →',
      }

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
    if (!firstName.trim()) { setError(copy.errors.firstName); return }
    if (!lastName.trim())  { setError(copy.errors.lastName); return }
    if (!birthDate)         { setError(copy.errors.birthDate); return }
    if (!bioProfile)        { setError(copy.errors.biologicalProfile); return }
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
            {copy.step}
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
              {copy.title}
            </h1>
            <p style={{ margin: '0 0 4px', color: colors.textSoft, fontSize: '14px', lineHeight: 1.6 }}>
              {copy.subtitle}
            </p>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
              {copy.profileNote}
            </p>
          </div>

          {/* ── Identity section ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted }}>
              {copy.identitySection}
            </span>
            <div style={{ flex: 1, height: '1px', background: colors.cardBorder }} />
          </div>

          <div style={{ display: 'grid', gap: '18px', marginBottom: '24px' }}>

            {/* First + Last name */}
            <section>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="first-name" style={{ display: 'block', color: colors.text, fontSize: '13px', fontWeight: 700, marginBottom: '7px', letterSpacing: '-0.01em' }}>
                    {copy.firstName}
                  </label>
                  <input
                    id="first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); if (error) setError('') }}
                    placeholder={copy.firstPlaceholder}
                    autoComplete="given-name"
                    style={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="last-name" style={{ display: 'block', color: colors.text, fontSize: '13px', fontWeight: 700, marginBottom: '7px', letterSpacing: '-0.01em' }}>
                    {copy.lastName}
                  </label>
                  <input
                    id="last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); if (error) setError('') }}
                    placeholder={copy.lastPlaceholder}
                    autoComplete="family-name"
                    style={inputBase}
                  />
                </div>
              </div>
              <p style={{ margin: '6px 0 0', color: colors.textMuted, fontSize: '12px', lineHeight: 1.45 }}>
                {copy.identityHelp}
              </p>
            </section>

            {/* Date of birth — premium presentation */}
            <section>
              <label htmlFor="birth-date" style={{ display: 'block', color: colors.text, fontSize: '13px', fontWeight: 700, marginBottom: '7px', letterSpacing: '-0.01em' }}>
                {copy.birthDate}
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
                {copy.birthDateHelp}
              </p>
            </section>
          </div>

          {/* ── Biological profile section ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted }}>
              {copy.biologicalProfile}
            </span>
            <div style={{ flex: 1, height: '1px', background: colors.cardBorder }} />
          </div>

          <p style={{ margin: '0 0 12px', color: colors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
            {copy.biologicalProfileHelp}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
            {([
              { value: 'female' as const, label: copy.femaleLabel, sub: copy.femaleSub },
              { value: 'male'   as const, label: copy.maleLabel,   sub: copy.maleSub },
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
            {loading ? copy.saving : copy.continue}
          </button>
        </div>
      </motion.section>
    </main>
  )
}
