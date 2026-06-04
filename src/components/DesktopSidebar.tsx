'use client'

import { useRouter } from 'next/navigation'
import { useMeridianLanguage, type MeridianLanguage, type TranslationKey, t } from '@/lib/i18n'

const colors = {
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  sidebarBg: '#071A1E',
  sidebarBorder: 'rgba(103,232,249,0.08)',
}

const navItems: {
  path: string
  labelKey?: TranslationKey
  label?: { en: string; es: string }
  id: 'home' | 'labs' | 'protocol' | 'timeline'
}[] = [
  { path: '/dashboard',   labelKey: 'nav.home',     id: 'home' },
  { path: '/labs/upload', labelKey: 'nav.labs',     id: 'labs' },
  { path: '/protocol',    labelKey: 'nav.protocol', id: 'protocol' },
  { path: '/timeline',    label: { en: 'Agenda', es: 'Agenda' }, id: 'timeline' },
]

function getFirstName(fullName?: string | null): string {
  if (!fullName || fullName === 'there') return ''
  const first = fullName.trim().split(' ')[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function DesktopNavIcon({ id, isActive }: { id: string; isActive: boolean }) {
  const stroke = isActive ? colors.teal : colors.textMuted

  if (id === 'home') {
    return (
      <span style={{
        fontFamily: 'var(--font-fraunces), serif',
        fontSize: '20px',
        fontWeight: 700,
        lineHeight: 1,
        display: 'block',
        background: isActive ? 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 45%, #2DD4BF 100%)' : 'none',
        WebkitBackgroundClip: isActive ? 'text' : undefined,
        WebkitTextFillColor: isActive ? 'transparent' : colors.textMuted,
        color: isActive ? 'transparent' : colors.textMuted,
        filter: isActive ? 'drop-shadow(0 0 8px rgba(45,212,191,0.55))' : 'none',
      }}>
        M
      </span>
    )
  }

  if (id === 'labs') {
    return (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 2h5" />
        <path d="M8 2v5.5L3.5 15a1.5 1.5 0 0 0 1.3 2.2h10.4a1.5 1.5 0 0 0 1.3-2.2L12 7.5V2" />
        <path d="M5.5 13h9" />
      </svg>
    )
  }

  if (id === 'protocol') {
    return (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="2" width="13" height="16" rx="2" />
        <line x1="6.5" y1="7" x2="13.5" y2="7" />
        <circle cx="6.5" cy="11" r="1.1" fill={stroke} stroke="none" />
        <line x1="8.5" y1="11" x2="13.5" y2="11" />
        <line x1="6.5" y1="14.5" x2="11.5" y2="14.5" />
      </svg>
    )
  }

  if (id === 'timeline') {
    return (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="13" rx="2.2" />
        <path d="M6.5 2.5v3" />
        <path d="M13.5 2.5v3" />
        <path d="M3 8h14" />
        <path d="M6.5 11h2" />
        <path d="M11.5 11h2" />
        <path d="M6.5 14h2" />
      </svg>
    )
  }

  return null
}

export default function DesktopSidebar({
  userName,
  currentPath,
}: {
  userName?: string | null
  currentPath: string
}) {
  const router = useRouter()
  const [lang] = useMeridianLanguage()
  const firstName = getFirstName(userName)

  return (
    <aside style={{
      width: '200px',
      flexShrink: 0,
      background: colors.sidebarBg,
      borderRight: `0.5px solid ${colors.sidebarBorder}`,
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      zIndex: 10,
    }}>
      <div style={{
        padding: '22px 18px 18px',
        borderBottom: `0.5px solid ${colors.sidebarBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{
          fontFamily: 'var(--font-fraunces), serif',
          fontSize: '22px',
          fontWeight: 700,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 45%, #2DD4BF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 8px rgba(45,212,191,0.55))',
        }}>
          M
        </span>
        <span style={{
          fontFamily: 'var(--font-fraunces), serif',
          fontSize: '15px',
          fontWeight: 700,
          color: colors.text,
          letterSpacing: '-0.03em',
        }}>
          Meridian
        </span>
      </div>

      <nav style={{
        padding: '14px 8px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {navItems.map((item) => {
          const active = currentPath === item.path || currentPath.startsWith(item.path + '/')
          const label = item.label ? item.label[lang] : t(lang, item.labelKey!)

          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 11px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'rgba(45,212,191,0.09)' : 'transparent',
                color: active ? colors.text : colors.textMuted,
                fontSize: '13px',
                fontWeight: active ? 700 : 550,
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.2s ease, color 0.2s ease',
              }}
            >
              <span style={{
                width: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <DesktopNavIcon id={item.id} isActive={active} />
              </span>
              {label}
            </button>
          )
        })}
      </nav>

      <div style={{
        padding: '14px 12px',
        borderTop: `0.5px solid ${colors.sidebarBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'rgba(45,212,191,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 700,
          color: colors.teal,
          flexShrink: 0,
        }}>
          {firstName ? firstName.slice(0, 2).toUpperCase() : 'M'}
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textSoft }}>
            {firstName || 'Meridian'}
          </div>
          <div style={{ fontSize: '10px', color: colors.textMuted }}>
            {lang === 'es' ? 'Plan activo' : 'Active plan'}
          </div>
        </div>
      </div>
    </aside>
  )
}
