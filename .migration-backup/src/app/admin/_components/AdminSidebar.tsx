'use client'

import { usePathname, useRouter } from 'next/navigation'

const colors = {
  background:  '#061316',
  teal:        '#2DD4BF',
  cyan:        '#67E8F9',
  text:        '#EAFBF7',
  textSoft:    '#9ACBC1',
  textMuted:   '#5F8E85',
  cardBg:      'rgba(232,248,245,0.055)',
  cardBorder:  'rgba(103,232,249,0.13)',
}

const fonts = {
  heading: '"Fraunces", serif',
  ui:      '"Plus Jakarta Sans", sans-serif',
}

const ROLE_LABEL: Record<string, string> = {
  super_admin:        'Super Admin',
  admin:              'Admin',
  analyst:            'Analyst',
  support:            'Support',
  clinician_readonly: 'Clinician',
}

const ROLE_COLOR: Record<string, string> = {
  super_admin:        colors.cyan,
  admin:              colors.teal,
  analyst:            '#A78BFA',
  support:            '#FCD34D',
  clinician_readonly: '#86EFAC',
}

const NAV = [
  {
    href:  '/admin',
    label: 'Dashboard',
    exact:  true,
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href:  '/admin/users',
    label: 'Users',
    exact:  false,
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="3" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" />
        <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href:  '/admin/analytics',
    label: 'Analytics',
    exact:  false,
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 12l4-4 3 3 4-5 3 2" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1 14h14" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href:  '/admin/notifications',
    label: 'Notifications',
    exact:  false,
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v3L2 11h12l-1.5-2V6A4.5 4.5 0 0 0 8 1.5Z" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke={active ? colors.teal : colors.textMuted} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
]

interface Props {
  role:        string
  displayName: string | null
  email:       string | null
  onClose?:    () => void
}

export default function AdminSidebar({ role, displayName, email, onClose }: Props) {
  const pathname = usePathname()
  const router   = useRouter()

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  }

  function handleNav(href: string) {
    router.push(href)
    onClose?.()
  }

  return (
    <aside style={{
      width:           '220px',
      minWidth:        '220px',
      height:          '100%',
      minHeight:       '100vh',
      display:         'flex',
      flexDirection:   'column',
      backgroundColor: 'rgba(4,14,16,0.98)',
      borderRight:     `1px solid ${colors.cardBorder}`,
      backdropFilter:  'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      position:        'sticky',
      top:             0,
    }}>
      {/* Logo + close button row */}
      <div style={{ padding: '24px 20px 18px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontFamily:           fonts.heading,
            fontSize:             '22px',
            fontWeight:           700,
            background:           'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 45%, #2DD4BF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor:  'transparent',
            filter:               'drop-shadow(0 0 8px rgba(45,212,191,0.4))',
          }}>M</span>
          <div>
            <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 700, color: colors.textSoft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Meridian</div>
            <div style={{ fontFamily: fonts.ui, fontSize: '10px', color: colors.textMuted, letterSpacing: '0.05em' }}>Admin</div>
          </div>
        </div>
        {/* Close button — visible on mobile via topbar, but also available in drawer */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background:  'none',
              border:      'none',
              cursor:      'pointer',
              color:       colors.textMuted,
              fontSize:    '20px',
              lineHeight:  1,
              padding:     '4px 6px',
              borderRadius:'6px',
              display:     'flex',
              alignItems:  'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <button
              key={item.href}
              onClick={() => handleNav(item.href)}
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             '10px',
                padding:         '11px 12px',
                borderRadius:    '8px',
                border:          'none',
                cursor:          'pointer',
                width:           '100%',
                textAlign:       'left',
                fontFamily:      fonts.ui,
                fontSize:        '13px',
                fontWeight:      active ? 600 : 400,
                color:           active ? colors.text : colors.textSoft,
                backgroundColor: active ? 'rgba(45,212,191,0.10)' : 'transparent',
                boxShadow:       active ? 'inset 0 0 0 1px rgba(45,212,191,0.18)' : 'none',
                transition:      'all 0.15s ease',
                touchAction:     'manipulation',
                minHeight:       '44px',
              }}
            >
              {item.icon(active)}
              {item.label}
              {active && (
                <span style={{ marginLeft: 'auto', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.8)', flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* Return to Meridian */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${colors.cardBorder}` }}>
        <button
          onClick={() => { router.push('/dashboard'); onClose?.() }}
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             '8px',
            padding:         '10px 12px',
            borderRadius:    '8px',
            border:          'none',
            cursor:          'pointer',
            width:           '100%',
            textAlign:       'left',
            fontFamily:      fonts.ui,
            fontSize:        '12px',
            fontWeight:      500,
            color:           colors.textMuted,
            backgroundColor: 'transparent',
            transition:      'all 0.15s ease',
            minHeight:       '40px',
            letterSpacing:   '0.01em',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.textSoft; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(154,203,193,0.04)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.textMuted; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 2.5L4 7l4.5 4.5" />
            <line x1="4" y1="7" x2="12" y2="7" />
          </svg>
          Return to Meridian
        </button>
      </div>

      {/* User info */}
      <div style={{ padding: '16px 14px', borderTop: `1px solid ${colors.cardBorder}` }}>
        <div style={{ fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600, color: colors.textSoft, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName ?? email ?? 'Admin'}
        </div>
        <div style={{
          display:         'inline-flex',
          alignItems:      'center',
          padding:         '2px 8px',
          borderRadius:    '20px',
          fontSize:        '10px',
          fontFamily:      fonts.ui,
          fontWeight:      700,
          letterSpacing:   '0.05em',
          textTransform:   'uppercase',
          color:           ROLE_COLOR[role] ?? colors.teal,
          backgroundColor: `${ROLE_COLOR[role] ?? colors.teal}18`,
          border:          `1px solid ${ROLE_COLOR[role] ?? colors.teal}35`,
        }}>
          {ROLE_LABEL[role] ?? role}
        </div>
      </div>
    </aside>
  )
}
