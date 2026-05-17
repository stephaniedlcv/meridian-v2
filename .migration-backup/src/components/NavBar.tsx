'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect }    from 'react'

const colors = {
  background: '#061316',
  teal:       '#2DD4BF',
  cyan:       '#67E8F9',
  text:       '#EAFBF7',
  textSoft:   '#9ACBC1',
  textMuted:  '#5F8E85',
  cardBorder: 'rgba(103,232,249,0.13)',
}

// 4-item nav — Notifications moved to global bell
const navConfig = [
  { path: '/dashboard',   label: 'Home',     id: 'home'     },
  { path: '/labs/upload', label: 'Labs',     id: 'labs'     },
  { path: '/protocol',    label: 'Protocol', id: 'protocol' },
  { path: '/profile',     label: 'Profile',  id: 'profile'  },
]

function NavIcon({ id, isActive }: { id: string; isActive: boolean }) {
  const stroke = isActive ? colors.teal : colors.textMuted

  if (id === 'home') {
    return (
      <span style={{
        fontFamily:           'var(--font-fraunces), serif',
        fontSize:             '22px',
        fontWeight:           700,
        lineHeight:           1,
        display:              'block',
        background:           isActive ? 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 45%, #2DD4BF 100%)' : 'none',
        WebkitBackgroundClip: isActive ? 'text' : undefined,
        WebkitTextFillColor:  isActive ? 'transparent' : colors.textMuted,
        color:                isActive ? 'transparent' : colors.textMuted,
        filter:               isActive ? 'drop-shadow(0 0 8px rgba(45,212,191,0.55))' : 'none',
      }}>
        M
      </span>
    )
  }

  if (id === 'labs') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 2h5" />
        <path d="M8 2v5.5L3.5 15a1.5 1.5 0 0 0 1.3 2.2h10.4a1.5 1.5 0 0 0 1.3-2.2L12 7.5V2" />
        <path d="M5.5 13h9" />
      </svg>
    )
  }

  if (id === 'protocol') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="2" width="13" height="16" rx="2" />
        <line x1="6.5" y1="7"    x2="13.5" y2="7" />
        <circle cx="6.5" cy="11" r="1.1" fill={stroke} stroke="none" />
        <line x1="8.5" y1="11"   x2="13.5" y2="11" />
        <line x1="6.5" y1="14.5" x2="11.5" y2="14.5" />
      </svg>
    )
  }

  if (id === 'profile') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="6.5" r="3" />
        <path d="M3 18c0-3.9 3.1-6 7-6s7 2.1 7 6" />
      </svg>
    )
  }

  return null
}

// ── Global notification bell ──────────────────────────────────────
function NotificationBell({ unreadCount, pathname }: { unreadCount: number; pathname: string }) {
  const router    = useRouter()
  const isActive  = pathname === '/notifications' || pathname?.startsWith('/notifications/')
  const hasUnread = unreadCount > 0 && !isActive
  const stroke    = isActive ? colors.teal : colors.textSoft

  return (
    <button
      onClick={() => router.push('/notifications')}
      aria-label="Notifications"
      style={{
        position:            'fixed',
        top:                 'calc(env(safe-area-inset-top, 0px) + 14px)',
        right:               'calc(env(safe-area-inset-right, 0px) + 16px)',
        zIndex:              90,
        width:               '42px',
        height:              '42px',
        borderRadius:        '13px',
        background:          isActive
          ? 'rgba(45,212,191,0.08)'
          : 'rgba(6,19,22,0.82)',
        border:              isActive
          ? '1px solid rgba(45,212,191,0.22)'
          : `1px solid ${colors.cardBorder}`,
        backdropFilter:      'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        boxShadow:           hasUnread
          ? '0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(45,212,191,0.15), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        cursor:              'pointer',
        display:             'flex',
        alignItems:          'center',
        justifyContent:      'center',
        padding:             0,
        transition:          'box-shadow 0.3s ease, border 0.3s ease, background 0.2s ease',
        animation:           hasUnread ? 'meridian-bell-glow 3s ease-in-out infinite' : 'none',
      }}
    >
      {/* Bell icon */}
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2A4.5 4.5 0 0 0 5.5 6.5v3.2L4 12h12l-1.5-2.3V6.5A4.5 4.5 0 0 0 10 2Z" />
        <path d="M8.5 14.5a1.5 1.5 0 0 0 3 0" />
      </svg>

      {/* Unread badge */}
      {hasUnread && (
        <span style={{
          position:        'absolute',
          top:             '7px',
          right:           '7px',
          minWidth:        unreadCount > 9 ? '15px' : '8px',
          height:          '8px',
          borderRadius:    '4px',
          backgroundColor: colors.teal,
          border:          '1.5px solid #061316',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         unreadCount > 9 ? '0 2px' : '0',
          animation:       'meridian-badge-pulse 2.5s ease-in-out infinite',
          boxSizing:       'border-box',
        }}>
          {unreadCount > 9 && (
            <span style={{
              fontSize:      '7px',
              fontWeight:    700,
              color:         '#061316',
              fontFamily:    '"Plus Jakarta Sans", sans-serif',
              lineHeight:    1,
              letterSpacing: '-0.02em',
            }}>
              9+
            </span>
          )}
        </span>
      )}
    </button>
  )
}

export default function NavBar() {
  const router        = useRouter()
  const pathname      = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetch('/api/user/notifications/unread-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(data => setUnreadCount(data.count ?? 0))
      .catch(() => {})
  }, [pathname])

  return (
    <>
      {/* Keyframes */}
      <style>{`
        @keyframes meridian-badge-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(45,212,191,0.55); }
          50%       { box-shadow: 0 0 0 3px rgba(45,212,191,0); }
        }
        @keyframes meridian-bell-glow {
          0%, 100% { filter: none; }
          50%       { filter: drop-shadow(0 0 6px rgba(45,212,191,0.3)); }
        }
      `}</style>

      {/* Global notification bell — top-right across all NavBar pages */}
      <NotificationBell unreadCount={unreadCount} pathname={pathname ?? ''} />

      {/* Bottom navigation — 4 items */}
      <nav style={{
        position:              'fixed',
        bottom:                0,
        left:                  0,
        right:                 0,
        backgroundColor:       'rgba(6,19,22,0.95)',
        borderTop:             `1px solid ${colors.cardBorder}`,
        backdropFilter:        'blur(20px)',
        WebkitBackdropFilter:  'blur(20px)',
        zIndex:                100,
        padding:               '8px 0 env(safe-area-inset-bottom, 8px)',
      }}>
        <div style={{
          maxWidth:       '560px',
          margin:         '0 auto',
          display:        'flex',
          justifyContent: 'space-around',
          alignItems:     'center',
        }}>
          {navConfig.map((item) => {
            const isActive = pathname === item.path || pathname?.startsWith(item.path + '/')

            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                style={{
                  background:    isActive ? 'rgba(45,212,191,0.07)' : 'none',
                  border:        isActive ? '1px solid rgba(45,212,191,0.12)' : '1px solid transparent',
                  borderRadius:  '12px',
                  cursor:        'pointer',
                  display:       'flex',
                  flexDirection: 'column',
                  alignItems:    'center',
                  gap:           '4px',
                  padding:       '8px 14px',
                  fontFamily:    '"Plus Jakarta Sans", sans-serif',
                  transition:    'all 0.2s ease',
                  minWidth:      '60px',
                  touchAction:   'manipulation',
                }}
              >
                <NavIcon id={item.id} isActive={isActive} />
                <span style={{
                  fontSize:      '9px',
                  fontWeight:    600,
                  letterSpacing: '0.04em',
                  color:         isActive ? colors.teal : colors.textMuted,
                  whiteSpace:    'nowrap',
                }}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
