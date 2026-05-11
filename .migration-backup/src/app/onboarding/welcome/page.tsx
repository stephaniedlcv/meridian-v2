'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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

export default function WelcomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(() => searchParams.get('mode') === 'login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function switchMode(toLogin: boolean) {
    setIsLogin(toLogin)
    setError(null)
    router.replace(`/onboarding/welcome?mode=${toLogin ? 'login' : 'signup'}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (authError) {
          setError(authError.message)
          return
        }
        router.push('/')
        return
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: '' },
        },
      })
      if (authError) {
        setError(authError.message)
        return
      }
      router.push('/onboarding/profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        fontFamily: fonts.ui,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '55%', height: '55%', background: `radial-gradient(circle, rgba(45,212,191,0.13) 0%, transparent 70%)`, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '55%', height: '55%', background: `radial-gradient(circle, rgba(103,232,249,0.11) 0%, transparent 70%)`, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '40%', height: '30%', background: `radial-gradient(circle, rgba(45,212,191,0.05) 0%, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo halo */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          {/* Outer orbit ring */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '1px solid rgba(103,232,249,0.09)',
            boxShadow: '0 0 56px rgba(45,212,191,0.07), 0 0 140px rgba(45,212,191,0.03)',
          }} />
          {/* Inner reticle ring */}
          <div style={{
            position: 'absolute', inset: '18px', borderRadius: '50%',
            border: '0.5px solid rgba(103,232,249,0.14)',
          }} />
          <span style={{
            fontFamily: fonts.heading,
            fontSize: '62px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            position: 'relative',
            zIndex: 1,
          }}>
            M
          </span>
        </motion.div>

        {/* Wordmark */}
        <div style={{
          fontFamily: fonts.heading,
          fontSize: '30px',
          fontWeight: 700,
          color: colors.text,
          letterSpacing: '-0.05em',
          marginBottom: '8px',
        }}>
          Meridian
        </div>

        {/* Brand label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
        }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: colors.teal,
            boxShadow: '0 0 8px rgba(45,212,191,0.9), 0 0 16px rgba(45,212,191,0.4)',
          }} />
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: colors.textMuted,
          }}>
            Biological Intelligence System
          </div>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: colors.teal,
            boxShadow: '0 0 8px rgba(45,212,191,0.9), 0 0 16px rgba(45,212,191,0.4)',
          }} />
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: '26px',
            fontWeight: 400,
            color: colors.text,
            textAlign: 'center',
            marginBottom: '10px',
            lineHeight: 1.2,
            letterSpacing: '-0.03em',
            whiteSpace: 'nowrap',
          }}
        >
          Your biological intelligence system
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: fonts.ui,
            fontSize: '15px',
            color: colors.textSoft,
            textAlign: 'center',
            marginBottom: '36px',
            lineHeight: 1.75,
          }}
        >
          Connect your labs and wearables.<br />
          Get one clear priority every day.
        </p>

        {/* Glass form card */}
        <div style={{
          width: '100%',
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: '24px',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 32px rgba(45,212,191,0.04)',
          padding: '28px 24px 24px',
        }}>
          <form onSubmit={handleSubmit}>
            {/* Email Input */}
            <div style={{ marginBottom: '14px' }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '15px 18px',
                  backgroundColor: 'rgba(6,19,22,0.6)',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '12px',
                  color: colors.text,
                  fontFamily: fonts.ui,
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              />
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: '20px' }}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '15px 18px',
                  backgroundColor: 'rgba(6,19,22,0.6)',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '12px',
                  color: colors.text,
                  fontFamily: fonts.ui,
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <p style={{
                color: '#EF4444',
                fontSize: '14px',
                textAlign: 'center',
                marginBottom: '16px',
              }}>
                {error}
              </p>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={loading ? {} : { scale: 1.02 }}
              whileTap={loading ? {} : { scale: 0.98 }}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: loading
                  ? `${colors.teal}60`
                  : `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`,
                border: 'none',
                borderRadius: '14px',
                color: colors.background,
                fontFamily: fonts.ui,
                fontSize: '16px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em',
                boxShadow: loading
                  ? 'none'
                  : '0 0 24px rgba(45,212,191,0.3), 0 0 60px rgba(45,212,191,0.10), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              {loading ? 'Loading...' : isLogin ? 'Log in →' : 'Get started →'}
            </motion.button>
          </form>
        </div>

        {/* Mode toggle */}
        <p
          style={{
            fontFamily: fonts.ui,
            fontSize: '14px',
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: '20px',
            marginBottom: '8px',
          }}
        >
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span
            onClick={() => switchMode(!isLogin)}
            style={{ color: colors.teal, cursor: 'pointer' }}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </span>
        </p>

        {/* Time estimate */}
        <p
          style={{
            fontFamily: fonts.ui,
            fontSize: '13px',
            color: colors.textMuted,
            textAlign: 'center',
          }}
        >
          Takes 2 minutes
        </p>
      </motion.div>
    </div>
  )
}
