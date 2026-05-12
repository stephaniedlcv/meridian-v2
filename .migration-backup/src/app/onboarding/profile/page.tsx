'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
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

type BiologyType = 'female' | 'male' | null

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [selected, setSelected] = useState<BiologyType>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }
      // Redirect completed users away — don't let them re-do onboarding.
      const { data: prof } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single()
      if (prof?.onboarding_completed) { router.push('/dashboard'); return }
    }
    checkUser()
  }, [router, supabase])

  const handleContinue = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error(userError)
        router.push('/onboarding/welcome')
        return
      }
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, biological_profile: selected }, { onConflict: 'id' })
      if (saveError) { setError(saveError.message); return }
      router.push('/onboarding/goals')
    } finally {
      setLoading(false)
    }
  }

  const SelectionCard = ({
    type, title, subtitle,
  }: {
    type: BiologyType
    title: string
    subtitle: string
  }) => {
    const isSelected = selected === type
    return (
      <button
        onClick={() => setSelected(type)}
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
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <span style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 700,
          marginBottom: '5px',
          color: isSelected ? colors.teal : colors.text,
          letterSpacing: '-0.01em',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>
          {title}
        </span>
        <span style={{
          display: 'block',
          color: isSelected ? '#9EEFE4' : colors.textSoft,
          fontSize: '12px',
          lineHeight: 1.45,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>
          {subtitle}
        </span>
      </button>
    )
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
      padding: '80px 20px 100px',
    }}>
      {/* Ambient orbs — 3 layers matching goals/connect/welcome/landing */}
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
            Biological Profile · Step 2
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
              Set your biological profile
            </h1>
            <p style={{ margin: '0 0 6px', color: colors.textSoft, fontSize: '15px', lineHeight: 1.65 }}>
              Meridian uses this for accurate reference ranges.
            </p>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
              This is about your biology — not your identity.
            </p>
          </div>

          {/* Selection cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <SelectionCard
                type="female"
                title="Female biology"
                subtitle="Includes menstrual cycle tracking and female hormonal ranges"
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <SelectionCard
                type="male"
                title="Male biology"
                subtitle="Includes male hormonal ranges and PSA tracking"
              />
            </motion.div>
          </div>

          {/* Save error */}
          {error ? (
            <p style={{ margin: '0 0 14px', color: '#EF4444', fontSize: '13px', lineHeight: 1.5 }}>
              {error}
            </p>
          ) : null}

          {/* CTA */}
          <button
            type="button"
            disabled={!selected || loading}
            onClick={handleContinue}
            style={{
              width: '100%', border: 'none', borderRadius: '14px',
              padding: '16px 20px',
              background: selected && !loading
                ? 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)'
                : 'rgba(45,212,191,0.25)',
              color: '#061316',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '15px', fontWeight: 700,
              cursor: selected && !loading ? 'pointer' : 'not-allowed',
              letterSpacing: '-0.01em',
              boxShadow: selected && !loading
                ? '0 0 24px rgba(45,212,191,0.35), 0 0 60px rgba(45,212,191,0.12), inset 0 1px 0 rgba(255,255,255,0.25)'
                : 'none',
              transition: 'box-shadow 200ms ease, background 200ms ease',
            }}
          >
            {loading ? 'Loading...' : 'Continue →'}
          </button>
        </div>
      </motion.section>
    </main>
  )
}
