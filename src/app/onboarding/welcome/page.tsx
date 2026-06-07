'use client'

import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import { Suspense, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { getNextOnboardingStep } from '@/lib/onboarding'
import { useMeridianLanguage } from '@/lib/i18n'

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

const fonts = {
  heading: '"Fraunces", serif',
  ui: '"Plus Jakarta Sans", sans-serif',
}

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  backgroundColor: 'rgba(6,19,22,0.6)',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: '12px',
  color: colors.text,
  fontFamily: fonts.ui,
  fontSize: '15px',
  outline: 'none',
  boxSizing: 'border-box',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
}

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )

function WelcomePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [lang] = useMeridianLanguage()
  const supabase = createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableKey()
  )

  const [email, setEmail]                       = useState('')
  const [password, setPassword]                 = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [showPassword, setShowPassword]         = useState(false)
  const [showConfirm, setShowConfirm]           = useState(false)
  const [isLogin, setIsLogin]                   = useState(() => searchParams.get('mode') === 'login')
  const [loading, setLoading]                   = useState(false)
  const [error, setError]                       = useState<string | null>(null)
  const [emailConfirmPending, setEmailConfirmPending] = useState(false)

  const passwordsMatch = password === confirmPassword
  const showMatchState = !isLogin && confirmPassword.length > 0
  const canSubmit = !loading && !!email && !!password &&
    (isLogin || (!!confirmPassword && passwordsMatch))

  const copy = lang === 'es'
    ? {
        brandLabel: 'Sistema de inteligencia biológica',
        headline: 'Entiende tu biología en contexto.',
        subtitleLine1: 'Conecta tus laboratorios y señales clave.',
        subtitleLine2: 'Recibe una prioridad clara cada día.',
        checkInbox: 'Revisa tu correo',
        confirmationSent: 'Enviamos un enlace de confirmación a',
        activateAccount: 'Abre el enlace para activar tu cuenta y luego inicia sesión aquí.',
        goToLogin: 'Ir a iniciar sesión →',
        email: 'Correo electrónico',
        password: 'Contraseña',
        confirmPassword: 'Confirmar contraseña',
        hidePassword: 'Ocultar contraseña',
        showPassword: 'Mostrar contraseña',
        hideConfirmPassword: 'Ocultar confirmación de contraseña',
        showConfirmPassword: 'Mostrar confirmación de contraseña',
        passwordsMatch: 'Las contraseñas coinciden',
        passwordsDontMatch: 'Las contraseñas no coinciden',
        loading: 'Cargando...',
        login: 'Iniciar sesión →',
        getStarted: 'Crear cuenta →',
        noAccount: '¿No tienes cuenta? ',
        hasAccount: '¿Ya tienes cuenta? ',
        signUp: 'Crear cuenta',
        logIn: 'Iniciar sesión',
      }
    : {
        brandLabel: 'Biological Intelligence System',
        headline: 'Understand your biology in context.',
        subtitleLine1: 'Connect your labs and key signals.',
        subtitleLine2: 'Get one clear priority every day.',
        checkInbox: 'Check your inbox',
        confirmationSent: 'We sent a confirmation link to',
        activateAccount: 'Click the link to activate your account, then log in here.',
        goToLogin: 'Go to Log in →',
        email: 'Email address',
        password: 'Password',
        confirmPassword: 'Confirm password',
        hidePassword: 'Hide password',
        showPassword: 'Show password',
        hideConfirmPassword: 'Hide confirm password',
        showConfirmPassword: 'Show confirm password',
        passwordsMatch: 'Passwords match',
        passwordsDontMatch: "Passwords don't match",
        loading: 'Loading...',
        login: 'Log in →',
        getStarted: 'Get started →',
        noAccount: "Don't have an account? ",
        hasAccount: 'Already have an account? ',
        signUp: 'Sign up',
        logIn: 'Log in',
      }

  function switchMode(toLogin: boolean) {
    setIsLogin(toLogin)
    setError(null)
    setEmailConfirmPending(false)
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirm(false)
    router.replace(`/onboarding/welcome?mode=${toLogin ? 'login' : 'signup'}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLogin && !passwordsMatch) { setError(copy.passwordsDontMatch); return }
    setLoading(true)
    setError(null)
    try {
      if (isLogin) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) { setError(authError.message); return }
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user!.id)
          .single()
        router.push(getNextOnboardingStep(profile) ?? '/')
        return
      }
      const { data: signUpData, error: authError } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: '' } },
      })
      if (authError) { setError(authError.message); return }
      if (signUpData.session) {
        await supabase.from('profiles').upsert({ id: signUpData.user!.id }, { onConflict: 'id' })
        router.push('/onboarding/identity')
      } else {
        setEmailConfirmPending(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: fonts.ui,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Logo halo */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            position: 'relative',
            width: '112px',
            height: '112px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
          }}
        >
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '1px solid rgba(103,232,249,0.09)',
            boxShadow: '0 0 56px rgba(45,212,191,0.07), 0 0 140px rgba(45,212,191,0.03)',
          }} />
          <div style={{
            position: 'absolute', inset: '16px', borderRadius: '50%',
            border: '0.5px solid rgba(103,232,249,0.14)',
          }} />
          <div style={{
            fontFamily: 'var(--font-fraunces), serif',
            fontSize: '56px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            position: 'relative',
            zIndex: 1,
          }}>
            M
          </div>
        </motion.div>

        {/* Wordmark */}
        <div style={{
          fontFamily: 'var(--font-fraunces), serif',
          fontSize: '28px',
          fontWeight: 700,
          color: '#EAFBF7',
          letterSpacing: '-0.05em',
          marginBottom: '9px',
        }}>
          Meridian
        </div>

        {/* Brand label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '36px',
        }}>
          <div style={{
            width: '4px', height: '4px', borderRadius: '50%',
            background: '#2DD4BF',
            boxShadow: '0 0 8px rgba(45,212,191,0.9), 0 0 16px rgba(45,212,191,0.4)',
          }} />
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#5F8E85',
          }}>
            {copy.brandLabel}
          </div>
          <div style={{
            width: '4px', height: '4px', borderRadius: '50%',
            background: '#2DD4BF',
            boxShadow: '0 0 8px rgba(45,212,191,0.9), 0 0 16px rgba(45,212,191,0.4)',
          }} />
        </div>

        {/* Headline — refined, calmer tone */}
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: '24px',
            fontWeight: 400,
            color: colors.text,
            textAlign: 'center',
            marginBottom: '8px',
            lineHeight: 1.25,
            letterSpacing: '-0.03em',
          }}
        >
          {copy.headline}
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: fonts.ui,
            fontSize: '14px',
            color: colors.textSoft,
            textAlign: 'center',
            marginBottom: '20px',
            lineHeight: 1.7,
          }}
        >
          {copy.subtitleLine1}<br />
          {copy.subtitleLine2}
        </p>

        {/* Glass form card — lighter, more breathable */}
        <div style={{
          width: '100%',
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: '22px',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 32px rgba(45,212,191,0.04)',
          padding: '22px 20px 18px',
        }}>
          {emailConfirmPending ? (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: colors.teal,
                padding: '5px 14px', border: '1px solid rgba(45,212,191,0.28)',
                borderRadius: '20px', background: 'rgba(45,212,191,0.07)',
                marginBottom: '16px',
              }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.9)' }} />
                {copy.checkInbox}
              </div>
              <p style={{ color: colors.text, fontSize: '15px', lineHeight: 1.65, marginBottom: '10px' }}>
                {copy.confirmationSent} <strong>{email}</strong>.
              </p>
              <p style={{ color: colors.textSoft, fontSize: '13px', lineHeight: 1.6, marginBottom: '18px' }}>
                {copy.activateAccount}
              </p>
              <button
                type="button"
                onClick={() => switchMode(true)}
                style={{
                  width: '100%', border: 'none', borderRadius: '12px',
                  padding: '13px 18px',
                  background: 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)',
                  color: '#061316', fontFamily: fonts.ui,
                  fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 0 24px rgba(45,212,191,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                {copy.goToLogin}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="email"
                  placeholder={copy.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputBase}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: isLogin ? '18px' : '12px', position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={copy.password}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ ...inputBase, paddingRight: '46px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  style={{
                    position: 'absolute', right: '13px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: colors.textMuted, padding: '4px',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>

              {/* Confirm password — signup only */}
              {!isLogin && (
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder={copy.confirmPassword}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(null) }}
                      required
                      style={{ ...inputBase, paddingRight: '46px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      tabIndex={-1}
                      aria-label={showConfirm ? copy.hideConfirmPassword : copy.showConfirmPassword}
                      style={{
                        position: 'absolute', right: '13px', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: colors.textMuted, padding: '4px',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <EyeIcon open={showConfirm} />
                    </button>
                  </div>
                  {showMatchState && (
                    <p style={{
                      margin: '0 0 12px',
                      fontSize: '12px',
                      color: passwordsMatch ? colors.teal : '#E8A87C',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      <span style={{
                        display: 'inline-block', width: '5px', height: '5px',
                        borderRadius: '50%',
                        background: passwordsMatch ? colors.teal : '#E8A87C',
                        boxShadow: passwordsMatch
                          ? '0 0 6px rgba(45,212,191,0.8)'
                          : '0 0 6px rgba(232,168,124,0.6)',
                        flexShrink: 0,
                      }} />
                      {passwordsMatch ? copy.passwordsMatch : copy.passwordsDontMatch}
                    </p>
                  )}
                  {!showMatchState && <div style={{ marginBottom: '12px' }} />}
                </div>
              )}

              {/* Error */}
              {error && (
                <p style={{
                  color: '#EF4444',
                  fontSize: '13px',
                  textAlign: 'center',
                  marginBottom: '14px',
                }}>
                  {error}
                </p>
              )}

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileHover={canSubmit ? { scale: 1.02 } : {}}
                whileTap={canSubmit ? { scale: 0.98 } : {}}
                style={{
                  width: '100%',
                  padding: '14px 22px',
                  background: canSubmit
                    ? `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`
                    : `${colors.teal}60`,
                  border: 'none',
                  borderRadius: '12px',
                  color: colors.background,
                  fontFamily: fonts.ui,
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  letterSpacing: '-0.01em',
                  boxShadow: canSubmit
                    ? '0 0 24px rgba(45,212,191,0.28), 0 0 56px rgba(45,212,191,0.09), inset 0 1px 0 rgba(255,255,255,0.2)'
                    : 'none',
                }}
              >
                {loading ? copy.loading : isLogin ? copy.login : copy.getStarted}
              </motion.button>
            </form>
          )}
        </div>

        {/* Mode toggle */}
        <p
          style={{
            fontFamily: fonts.ui,
            fontSize: '13px',
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: '18px',
          }}
        >
          {isLogin ? copy.noAccount : copy.hasAccount}
          <span
            onClick={() => switchMode(!isLogin)}
            style={{ color: colors.teal, cursor: 'pointer' }}
          >
            {isLogin ? copy.signUp : copy.logIn}
          </span>
        </p>
      </motion.div>
    </div>
  )
}

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomePageInner />
    </Suspense>
  )
}
