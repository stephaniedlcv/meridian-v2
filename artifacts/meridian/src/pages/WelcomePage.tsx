import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'wouter'
import { supabase } from '@/lib/supabase'

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
  const [, navigate] = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) { setError(authError.message); return }
        navigate('/dashboard')
        return
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: '' } },
      })
      if (authError) { setError(authError.message); return }
      navigate('/onboarding/profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      fontFamily: fonts.ui,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}
        >
          <span style={{ fontFamily: fonts.heading, fontSize: '64px', fontWeight: 400, background: `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>M</span>
        </motion.div>

        <h1 style={{ fontFamily: fonts.heading, fontSize: '32px', fontWeight: 400, color: colors.text, textAlign: 'center', marginBottom: '12px', lineHeight: 1.2 }}>
          Your biological intelligence system
        </h1>

        <p style={{ fontFamily: fonts.ui, fontSize: '16px', color: colors.textSoft, textAlign: 'center', marginBottom: '40px', lineHeight: 1.6 }}>
          Connect your labs and wearables. Get one clear priority every day.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '16px 20px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '12px', color: colors.text, fontFamily: fonts.ui, fontSize: '16px', outline: 'none', backdropFilter: 'blur(24px)', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '16px 20px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '12px', color: colors.text, fontFamily: fonts.ui, fontSize: '16px', outline: 'none', backdropFilter: 'blur(24px)', boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ color: '#EF4444', fontSize: '14px', textAlign: 'center', marginBottom: '16px' }}>{error}</p>}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={loading ? {} : { scale: 1.02 }}
            whileTap={loading ? {} : { scale: 0.98 }}
            style={{ width: '100%', padding: '16px 24px', background: loading ? `${colors.teal}60` : `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`, border: 'none', borderRadius: '12px', color: colors.background, fontFamily: fonts.ui, fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '16px' }}
          >
            {loading ? 'Loading...' : isLogin ? 'Log in →' : 'Get started →'}
          </motion.button>
        </form>

        <p style={{ fontFamily: fonts.ui, fontSize: '14px', color: colors.textMuted, textAlign: 'center', marginBottom: '8px' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={() => { setIsLogin(prev => !prev); setError(null) }} style={{ color: colors.teal, cursor: 'pointer' }}>
            {isLogin ? 'Sign up' : 'Log in'}
          </span>
        </p>

        <p style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, textAlign: 'center' }}>
          Takes 2 minutes
        </p>
      </motion.div>
    </div>
  )
}
