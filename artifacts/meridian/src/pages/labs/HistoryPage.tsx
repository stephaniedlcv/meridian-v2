import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { supabase } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

const colors = {
  background: '#061316', teal: '#2DD4BF', cyan: '#67E8F9', text: '#EAFBF7',
  textSoft: '#9ACBC1', textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)', cardBorder: 'rgba(103,232,249,0.13)',
}

export default function LabsHistoryPage() {
  const [, navigate] = useLocation()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/onboarding/welcome')
      else setLoading(false)
    })
  }, [navigate])

  if (loading) return null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: '"Plus Jakarta Sans", sans-serif', padding: '24px 24px 100px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: '28px', fontWeight: 400, color: colors.text, marginBottom: '8px' }}>Lab History</h1>
        <p style={{ fontSize: '15px', color: colors.textSoft, marginBottom: '32px' }}>Your biomarker results over time.</p>
        <div style={{ padding: '48px 24px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', textAlign: 'center', backdropFilter: 'blur(24px)' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>📊</p>
          <p style={{ fontSize: '16px', color: colors.textSoft, marginBottom: '8px' }}>Coming soon</p>
          <p style={{ fontSize: '13px', color: colors.textMuted }}>View trends, compare results, and track your progress over time.</p>
        </div>
      </div>
      <NavBar />
    </div>
  )
}
