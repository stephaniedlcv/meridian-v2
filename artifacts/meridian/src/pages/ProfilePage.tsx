import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { supabase } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

const colors = {
  background: '#061316', teal: '#2DD4BF', cyan: '#67E8F9', text: '#EAFBF7',
  textSoft: '#9ACBC1', textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)', cardBorder: 'rgba(103,232,249,0.13)',
}

export default function ProfilePageUser() {
  const [, navigate] = useLocation()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ full_name?: string; email?: string; biological_profile?: string; user_profile?: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/onboarding/welcome'); return }
      const { data } = await supabase.from('profiles').select('full_name, biological_profile, user_profile').eq('id', user.id).single()
      setProfile({ ...data, email: user.email })
      setLoading(false)
    }
    load()
  }, [navigate])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/onboarding/welcome')
  }

  if (loading) return null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: '"Plus Jakarta Sans", sans-serif', padding: '24px 24px 100px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: '28px', fontWeight: 400, color: colors.text, marginBottom: '8px' }}>Profile</h1>
        <p style={{ fontSize: '15px', color: colors.textSoft, marginBottom: '32px' }}>Your Meridian account settings.</p>

        <div style={{ padding: '24px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', backdropFilter: 'blur(24px)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Email', value: profile?.email || '—' },
              { label: 'Biological profile', value: profile?.biological_profile ? (profile.biological_profile === 'female' ? 'Female biology' : 'Male biology') : '—' },
              { label: 'Health goal', value: profile?.user_profile ? profile.user_profile.replace(/_/g, ' ') : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '15px', color: colors.text }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleLogout} style={{ width: '100%', padding: '16px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '12px', color: colors.textMuted, fontSize: '15px', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          Log out
        </button>
      </div>
      <NavBar />
    </div>
  )
}
