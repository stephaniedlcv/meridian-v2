'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar from '@/components/NavBar'

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

export default function LabsHistoryPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/onboarding/welcome')
        return
      }
      setLoading(false)
    }
    checkAuth()
  }, [router, supabase])

  if (loading) return null

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      fontFamily: fonts.ui,
      padding: '24px 24px 100px',
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{
          fontFamily: fonts.heading,
          fontSize: '28px',
          fontWeight: 400,
          color: colors.text,
          marginBottom: '8px',
        }}>
          Lab History
        </h1>
        <p style={{
          fontSize: '15px',
          color: colors.textSoft,
          marginBottom: '32px',
        }}>
          Your biomarker results over time.
        </p>

        <div style={{
          padding: '48px 24px',
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: '16px',
          textAlign: 'center',
          backdropFilter: 'blur(24px)',
        }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>📊</p>
          <p style={{ fontSize: '16px', color: colors.textSoft, marginBottom: '8px' }}>
            Coming soon
          </p>
          <p style={{ fontSize: '13px', color: colors.textMuted }}>
            View trends, compare results, and track your progress over time.
          </p>
        </div>
      </div>
      <NavBar />
    </div>
  )
}
