'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

type BiologyType = 'female' | 'male' | null

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [selected, setSelected] = useState<BiologyType>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/onboarding/welcome')
      }
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

      const { error } = await supabase
        .from('profiles')
        .update({ biological_profile: selected } as any)
        .eq('id', user.id)

      if (error) {
        console.error(error)
        return
      }

      router.push('/onboarding/connect')
    } finally {
      setLoading(false)
    }
  }

  const SelectionCard = ({
    type,
    title,
    subtitle,
  }: {
    type: BiologyType
    title: string
    subtitle: string
  }) => {
    const isSelected = selected === type

    return (
      <motion.button
        onClick={() => setSelected(type)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        style={{
          width: '100%',
          padding: '24px',
          backgroundColor: isSelected
            ? `${colors.teal}10`
            : colors.cardBg,
          border: `1px solid ${isSelected ? colors.teal : colors.cardBorder}`,
          borderRadius: '16px',
          cursor: 'pointer',
          textAlign: 'left',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          transition: 'all 0.2s ease',
        }}
      >
        <h3
          style={{
            fontFamily: fonts.ui,
            fontSize: '18px',
            fontWeight: 600,
            color: colors.text,
            marginBottom: '8px',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontFamily: fonts.ui,
            fontSize: '14px',
            color: colors.textSoft,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      </motion.button>
    )
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
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: '50%',
          height: '50%',
          background: `radial-gradient(circle, ${colors.teal}20 0%, transparent 70%)`,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '-10%',
          width: '50%',
          height: '50%',
          background: `radial-gradient(circle, ${colors.cyan}20 0%, transparent 70%)`,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Headline */}
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: '32px',
            fontWeight: 400,
            color: colors.text,
            textAlign: 'center',
            marginBottom: '12px',
            lineHeight: 1.2,
          }}
        >
          Set your biological profile
        </h1>

        {/* Subtext */}
        <p
          style={{
            fontFamily: fonts.ui,
            fontSize: '16px',
            color: colors.textSoft,
            textAlign: 'center',
            marginBottom: '8px',
            lineHeight: 1.6,
          }}
        >
          Meridian uses this for accurate reference ranges.
        </p>
        <p
          style={{
            fontFamily: fonts.ui,
            fontSize: '14px',
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: '40px',
            lineHeight: 1.6,
          }}
        >
          This is about your biology — not your identity.
        </p>

        {/* Selection Cards */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <SelectionCard
              type="female"
              title="Female biology"
              subtitle="Includes menstrual cycle tracking and female hormonal ranges"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <SelectionCard
              type="male"
              title="Male biology"
              subtitle="Includes male hormonal ranges and PSA tracking"
            />
          </motion.div>
        </div>

        {/* Continue Button */}
        <motion.button
          onClick={handleContinue}
          disabled={!selected || loading}
          whileHover={selected && !loading ? { scale: 1.02 } : {}}
          whileTap={selected && !loading ? { scale: 0.98 } : {}}
          style={{
            width: '100%',
            padding: '16px 24px',
            background: selected && !loading
              ? `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`
              : colors.cardBg,
            border: selected && !loading ? 'none' : `1px solid ${colors.cardBorder}`,
            borderRadius: '12px',
            color: selected && !loading ? colors.background : colors.textMuted,
            fontFamily: fonts.ui,
            fontSize: '16px',
            fontWeight: 600,
            cursor: selected && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease',
          }}
        >
          {loading ? 'Loading...' : 'Continue →'}
        </motion.button>
      </motion.div>
    </div>
  )
}
