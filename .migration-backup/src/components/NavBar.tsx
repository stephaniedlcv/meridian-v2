'use client'

import { useRouter, usePathname } from 'next/navigation'

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

const navConfig = [
  { path: '/dashboard',    label: 'Home',     id: 'home'     },
  { path: '/labs/upload',  label: 'Labs',     id: 'labs'     },
  { path: '/labs/history', label: 'History',  id: 'history'  },
  { path: '/protocol',     label: 'Protocol', id: 'protocol' },
  { path: '/profile',      label: 'Profile',  id: 'profile'  },
]

function NavIcon({ id, isActive }: { id: string; isActive: boolean }) {
  const stroke = isActive ? colors.teal : colors.textMuted

  if (id === 'home') {
    return (
      <span style={{
        fontFamily: 'var(--font-fraunces), serif',
        fontSize: '22px',
        fontWeight: 700,
        lineHeight: 1,
        display: 'block',
        background: isActive
          ? 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 45%, #2DD4BF 100%)'
          : 'none',
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
    // Conical flask (Erlenmeyer)
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 2h5" />
        <path d="M8 2v5.5L3.5 15a1.5 1.5 0 0 0 1.3 2.2h10.4a1.5 1.5 0 0 0 1.3-2.2L12 7.5V2" />
        <path d="M5.5 13h9" />
      </svg>
    )
  }

  if (id === 'history') {
    // Trend line with axis
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2,15 6.5,10 10.5,12.5 16,5" />
        <circle cx="2"    cy="15"   r="1.3" fill={stroke} stroke="none" />
        <circle cx="6.5"  cy="10"   r="1.3" fill={stroke} stroke="none" />
        <circle cx="10.5" cy="12.5" r="1.3" fill={stroke} stroke="none" />
        <circle cx="16"   cy="5"    r="1.3" fill={stroke} stroke="none" />
        <line x1="2" y1="17.5" x2="18" y2="17.5" strokeWidth="1" />
      </svg>
    )
  }

  if (id === 'protocol') {
    // Route Path P Mark — vertical stem + P-bowl arc + two circular route nodes.
    // Bowl occupies top half (y 3.5→10); lower half is plain stem — reads as P, not S.
    // Left branch at mid-stem connects to an off-axis route node.
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {/* Vertical stem */}
        <line x1="8" y1="3.5" x2="8" y2="16.5" />
        {/* P bowl — arc from top of stem, curves right, returns to mid-stem */}
        <path d="M 8,3.5 C 14,3.5 14,10 8,10" />
        {/* Short horizontal branch to the left-side route node */}
        <line x1="8" y1="10.5" x2="5.5" y2="10.5" />
        {/* Lower route node — anchors bottom of vertical path */}
        <circle cx="8" cy="16.5" r="1.4" fill={stroke} stroke="none" />
        {/* Left route node — off-axis, connected through the stem branch */}
        <circle cx="5.5" cy="10.5" r="1.4" fill={stroke} stroke="none" />
      </svg>
    )
  }

  if (id === 'profile') {
    // Person: head + shoulder arc
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="6.5" r="3" />
        <path d="M3 18c0-3.9 3.1-6 7-6s7 2.1 7 6" />
      </svg>
    )
  }

  return null
}

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(6,19,22,0.95)',
      borderTop: `1px solid ${colors.cardBorder}`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 100,
      padding: '8px 0 env(safe-area-inset-bottom, 8px)',
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
      }}>
        {navConfig.map((item) => {
          const isActive = pathname === item.path || pathname?.startsWith(item.path + '/')

          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                background: isActive ? 'rgba(45,212,191,0.07)' : 'none',
                border: isActive ? '1px solid rgba(45,212,191,0.12)' : '1px solid transparent',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                transition: 'all 0.2s ease',
              }}
            >
              <NavIcon id={item.id} isActive={isActive} />
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: isActive ? colors.teal : colors.textMuted,
              }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
