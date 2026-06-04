'use client'

import { useRouter } from 'next/navigation'
import { useMeridianLanguage } from '@/lib/i18n'

const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBorder: 'rgba(103,232,249,0.13)',
  sidebarBorder: 'rgba(103,232,249,0.08)',
}

export default function DesktopTopBar() {
  const router = useRouter()
  const [lang] = useMeridianLanguage()

  return (
    <header style={{
      height: '48px',
      borderBottom: `0.5px solid ${colors.sidebarBorder}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 28px',
      gap: '10px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.teal, flexShrink: 0 }} />
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: colors.textMuted,
        }}>
          {new Date().toLocaleDateString(lang === 'es' ? 'es-PR' : 'en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>

      <button
        onClick={() => router.push('/notifications')}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '11px',
          background: 'rgba(6,19,22,0.82)',
          border: `1px solid ${colors.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(20px)',
        }}
        aria-label={lang === 'es' ? 'Notificaciones' : 'Notifications'}
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke={colors.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2A4.5 4.5 0 0 0 5.5 6.5v3.2L4 12h12l-1.5-2.3V6.5A4.5 4.5 0 0 0 10 2Z" />
          <path d="M8.5 14.5a1.5 1.5 0 0 0 3 0" />
        </svg>
      </button>

      <button
        onClick={() => router.push('/profile')}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '11px',
          background: 'rgba(6,19,22,0.82)',
          border: `1px solid ${colors.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(20px)',
        }}
        aria-label={lang === 'es' ? 'Perfil' : 'Profile'}
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke={colors.textSoft} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="6.5" r="3" />
          <path d="M3 18c0-3.9 3.1-6 7-6s7 2.1 7 6" />
        </svg>
      </button>
    </header>
  )
}
