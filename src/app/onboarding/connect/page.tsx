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

type ConnectionOption = 'lab' | 'oura' | 'apple'

const FlaskIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={colors.teal}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 22h12" />
    <path d="M9 2v5.33L5 17.5V20a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.5L15 7.33V2" />
    <path d="M9 2h6" />
    <path d="M8 14h8" />
  </svg>
)

const CircleIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={colors.teal}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
  </svg>
)

const HeartIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={colors.teal}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
)

export default function ConnectPage() {
  const router = useRouter()
  const supabase = createClient()

  const [selected, setSelected] = useState<ConnectionOption[]>([])
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

  const toggleSelection = (option: ConnectionOption) => {
    setSelected((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option]
    )
  }

  const completeOnboarding = async () => {
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
        .update({ onboarding_completed: true } as any)
        .eq('id', user.id)

      if (error) {
        console.error(error)
        return
      }

      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => completeOnboarding()
  const handleSkip = () => completeOnboarding()

  const ConnectionCard = ({
    option,
    icon,
    title,
    subtitle,
  }: {
    option: ConnectionOption
    icon: React.ReactNode
    title: string
    subtitle: string
  }) => {
    const isSelected = selected.includes(option)

    return (
      <motion.button
        onClick={() => toggleSelection(option)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        style={{
          width: '100%',
          padding: '20px',
          backgroundColor: isSelected ? `${colors.teal}10` : colors.cardBg,
          border: `1px solid ${isSelected ? colors.teal : colors.cardBorder}`,
          borderRadius: '16px',
          cursor: 'pointer',
          textAlign: 'left',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: `${colors.teal}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontFamily: fonts.ui,
              fontSize: '16px',
              fontWeight: 600,
              color: colors.text,
              marginBottom: '4px',
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontFamily: fonts.ui,
              fontSize: '14px',
              color: colors.textSoft,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        </div>
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: `2px solid ${isSelected ? colors.teal : colors.cardBorder}`,
            backgroundColor: isSelected ? colors.teal : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}
        >
          {isSelected && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.background}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
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
          Connect your data
        </h1>

        {/* Subtext */}
        <p
          style={{
            fontFamily: fonts.ui,
            fontSize: '16px',
            color: colors.textSoft,
            textAlign: 'center',
            marginBottom: '40px',
            lineHeight: 1.6,
          }}
        >
          Meridian gets smarter with every source you add.
        </p>

        {/* Connection Cards */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <ConnectionCard
              option="lab"
              icon={<FlaskIcon />}
              title="Upload lab PDF"
              subtitle="We'll extract your biomarkers"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <ConnectionCard
              option="oura"
              icon={<CircleIcon />}
              title="Connect Oura"
              subtitle="HRV, sleep, temperature"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <ConnectionCard
              option="apple"
              icon={<HeartIcon />}
              title="Connect Apple Health"
              subtitle="Activity, HRV, heart rate"
            />
          </motion.div>
        </div>

        {/* Continue Button */}
        <motion.button
          onClick={handleContinue}
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
            borderRadius: '12px',
            color: colors.background,
            fontFamily: fonts.ui,
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '16px',
          }}
        >
          {loading ? 'Loading...' : 'Continue →'}
        </motion.button>

        {/* Skip link */}
        <button
          onClick={handleSkip}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            fontFamily: fonts.ui,
            fontSize: '14px',
            color: colors.textMuted,
            cursor: loading ? 'not-allowed' : 'pointer',
            padding: '8px',
          }}
        >
          I&apos;ll connect later
        </button>
      </motion.div>
    </div>
  )
}
