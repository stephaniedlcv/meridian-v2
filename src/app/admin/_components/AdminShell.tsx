'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AdminSidebar from './AdminSidebar'

const colors = {
  teal:       '#2DD4BF',
  cyan:       '#67E8F9',
  text:       '#EAFBF7',
  textSoft:   '#9ACBC1',
  textMuted:  '#5F8E85',
  cardBorder: 'rgba(103,232,249,0.13)',
}

const fonts = {
  heading: '"Fraunces", serif',
  ui:      '"Plus Jakarta Sans", sans-serif',
}

const SECTION_LABELS: [string, string][] = [
  ['/admin/users',         'Users'],
  ['/admin/analytics',     'Analytics'],
  ['/admin/notifications', 'Notifications'],
  ['/admin',               'Dashboard'],
]

interface Props {
  role:        string
  displayName: string | null
  email:       string | null
  children:    React.ReactNode
}

export default function AdminShell({ role, displayName, email, children }: Props) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const section = SECTION_LABELS.find(([key]) => pathname === key || pathname.startsWith(key + '/'))?.[1] ?? 'Admin'

  const hamLine = (transform: string, opacity = 1) => ({
    display:         'block',
    width:           '20px',
    height:          '1.5px',
    backgroundColor: colors.textSoft,
    borderRadius:    '2px',
    transition:      'transform 0.22s ease, opacity 0.22s ease',
    transform,
    opacity,
  } as React.CSSProperties)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: '#061316' }}>

      {/* ── Mobile Topbar ──────────────────────────────────────── */}
      <div className="admin-topbar" style={{ backgroundColor: 'rgba(4,14,16,0.98)', borderBottom: `1px solid ${colors.cardBorder}` }}>
        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          style={{
            background:     'none',
            border:         'none',
            cursor:         'pointer',
            padding:        '8px',
            borderRadius:   '8px',
            display:        'flex',
            flexDirection:  'column',
            gap:            '5px',
            alignItems:     'center',
            justifyContent: 'center',
            minWidth:       '36px',
            minHeight:      '36px',
            touchAction:    'manipulation',
          }}
        >
          <span style={hamLine(menuOpen ? 'translateY(6.5px) rotate(45deg)' : 'none')} />
          <span style={hamLine('none', menuOpen ? 0 : 1)} />
          <span style={hamLine(menuOpen ? 'translateY(-6.5px) rotate(-45deg)' : 'none')} />
        </button>

        {/* Logo + section — tapping Meridian returns to /dashboard */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <button
            onClick={() => { router.push('/dashboard'); setMenuOpen(false) }}
            aria-label="Return to Meridian"
            style={{
              display:         'flex',
              alignItems:      'center',
              gap:             '8px',
              background:      'none',
              border:          'none',
              cursor:          'pointer',
              padding:         0,
              touchAction:     'manipulation',
            }}
          >
            <span style={{
              fontFamily:           fonts.heading,
              fontSize:             '20px',
              fontWeight:           700,
              background:           'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 45%, #2DD4BF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              filter:               'drop-shadow(0 0 6px rgba(45,212,191,0.35))',
            }}>M</span>
            <span style={{ fontFamily: fonts.ui, fontSize: '12px', letterSpacing: '0.05em', fontWeight: 700, color: colors.textSoft, textTransform: 'uppercase' }}>Meridian</span>
          </button>
          <span style={{ fontFamily: fonts.ui, fontSize: '12px', letterSpacing: '0.05em', color: colors.textMuted }}>/ {section}</span>
        </div>

        {/* Right spacer (balances hamburger) */}
        <div style={{ width: '36px' }} />
      </div>

      {/* ── Body Row: sidebar + main ───────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>

        {/* Backdrop */}
        <div
          className={`admin-sidebar-backdrop${menuOpen ? ' is-open' : ''}`}
          onClick={() => setMenuOpen(false)}
        />

        {/* Sidebar wrapper — CSS handles fixed vs sticky at breakpoints */}
        <div className={`admin-sidebar-wrapper${menuOpen ? ' is-open' : ''}`} style={{ flexShrink: 0 }}>
          <AdminSidebar
            role={role}
            displayName={displayName}
            email={email}
            onClose={() => setMenuOpen(false)}
          />
        </div>

        {/* Main */}
        <main className="admin-main-content" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
