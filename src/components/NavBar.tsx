'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { t, useMeridianLanguage, type MeridianLanguage, type TranslationKey } from '../lib/i18n'

const colors = {
  background: '#061316',
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

// 4-item nav — Notifications and Profile moved to global top actions
const navConfig: {
  path: string
  labelKey?: TranslationKey
  label?: { en: string; es: string }
  id: string
}[] = [
  { path: '/dashboard',   labelKey: 'nav.home',     id: 'home'     },
  { path: '/labs/upload', labelKey: 'nav.labs',     id: 'labs'     },
  { path: '/protocol',    labelKey: 'nav.protocol', id: 'protocol' },
  { path: '/timeline',    label: { en: 'Agenda', es: 'Agenda' }, id: 'timeline' },
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

  if (id === 'timeline') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
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

// ── Notification types ─────────────────────────────────────────────
type NotifCategory = 'insights' | 'safety' | 'reminders' | 'system' | 'updates'

interface PreviewNotif {
  id:         string
  category:   NotifCategory
  title:      string
  body:       string
  read:       boolean
  created_at: string
}

function typeToCategory(type: string): NotifCategory {
  if (type === 'safety_alert') return 'safety'
  if (type === 'system_alert') return 'system'
  if (type === 'push')         return 'reminders'
  if (type === 'email')        return 'updates'
  return 'insights'
}

const NOTIF_COLOR: Record<NotifCategory, string> = {
  insights:  colors.teal,
  safety:    '#F87171',
  reminders: '#FCD34D',
  system:    colors.textSoft,
  updates:   colors.cyan,
}

function relTime(iso: string, lang: MeridianLanguage): string {
  const ms   = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days  = Math.floor(ms / 86400000)
  if (days  >= 1) return lang === 'es' ? `${days}d` : `${days}d ago`
  if (hours >= 1) return lang === 'es' ? `${hours}h` : `${hours}h ago`
  if (mins  >= 1) return lang === 'es' ? `${mins}min` : `${mins}m ago`
  return t(lang, 'notifications.justNow')
}

// ── Global profile shortcut ───────────────────────────────────────────
function ProfileButton({
  pathname,
  onOpen,
  lang,
}: {
  pathname: string
  onOpen: () => void
  lang: MeridianLanguage
}) {
  const isActive = pathname === '/profile' || pathname.startsWith('/profile/')
  const stroke = isActive ? colors.teal : colors.textSoft

  return (
    <button
      onClick={onOpen}
      aria-label={lang === 'es' ? 'Abrir perfil' : 'Open profile'}
      style={{
        position:             'fixed',
        top:                  'calc(env(safe-area-inset-top, 0px) + 14px)',
        right:                'calc(env(safe-area-inset-right, 0px) + 66px)',
        zIndex:               90,
        width:                '42px',
        height:               '42px',
        borderRadius:         '13px',
        background:           isActive
          ? 'rgba(45,212,191,0.08)'
          : 'rgba(6,19,22,0.82)',
        border:               isActive
          ? '1px solid rgba(45,212,191,0.22)'
          : `1px solid ${colors.cardBorder}`,
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow:            '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        cursor:               'pointer',
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'center',
        padding:              0,
        touchAction:          'manipulation',
        transition:           'box-shadow 0.3s ease, border 0.3s ease, background 0.25s ease, transform 0.18s ease',
      }}
    >
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="6.5" r="3" />
        <path d="M3 18c0-3.9 3.1-6 7-6s7 2.1 7 6" />
      </svg>
    </button>
  )
}

// ── Global notification bell ──────────────────────────────────────────
function NotificationBell({
  unreadCount, pathname, isOpen, onToggle, lang,
}: {
  unreadCount: number
  pathname:    string
  isOpen:      boolean
  onToggle:    () => void
  lang:        MeridianLanguage
}) {
  const isActive  = pathname === '/notifications' || isOpen
  const hasUnread = unreadCount > 0 && !isActive
  const stroke    = isActive ? colors.teal : colors.textSoft

  return (
    <button
      onClick={onToggle}
      aria-label={isOpen ? t(lang, 'notifications.close') : t(lang, 'notifications.title')}
      aria-expanded={isOpen}
      style={{
        position:             'fixed',
        top:                  'calc(env(safe-area-inset-top, 0px) + 14px)',
        right:                'calc(env(safe-area-inset-right, 0px) + 16px)',
        zIndex:               90,
        width:                '42px',
        height:               '42px',
        borderRadius:         '13px',
        background:           isActive
          ? 'rgba(45,212,191,0.08)'
          : 'rgba(6,19,22,0.82)',
        border:               isActive
          ? '1px solid rgba(45,212,191,0.22)'
          : `1px solid ${colors.cardBorder}`,
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow:            hasUnread
          ? '0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(45,212,191,0.15), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        cursor:               'pointer',
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'center',
        padding:              0,
        touchAction:          'manipulation',
        transition:           'box-shadow 0.3s ease, border 0.3s ease, background 0.25s ease, transform 0.18s ease',
        transform:            isOpen ? 'scale(0.93)' : 'scale(1)',
        animation:            hasUnread ? 'meridian-bell-glow 3s ease-in-out infinite' : 'none',
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
              fontFamily:    fonts.ui,
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
  const router   = useRouter()
  const pathname = usePathname()
  const [lang]   = useMeridianLanguage()

  const [unreadCount,  setUnreadCount]  = useState(0)
  const [notifOpen,    setNotifOpen]    = useState(false)
  const [notifs,       setNotifs]       = useState<PreviewNotif[]>([])
  const [drawerLoaded, setDrawerLoaded] = useState(false)
  const drawerLoadingRef = useRef(false)

  // Close drawer on page navigation
  useEffect(() => { setNotifOpen(false) }, [pathname])

  // Scroll lock while drawer is open
  useEffect(() => {
    document.body.style.overflow = notifOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [notifOpen])

  // Fetch unread count from Supabase on every nav change
  useEffect(() => {
    fetch('/api/user/notifications/unread-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(data => setUnreadCount(data.count ?? 0))
      .catch(() => {})
  }, [pathname])

  // Fetch real notification list when drawer first opens
  useEffect(() => {
    if (!notifOpen || drawerLoaded || drawerLoadingRef.current) return
    drawerLoadingRef.current = true
    fetch('/api/user/notifications')
      .then(r => r.ok ? r.json() : { notifications: [] })
      .then(data => {
        const mapped: PreviewNotif[] = ((data.notifications ?? []) as {
          id: string; title: string; body: string; type: string; read: boolean; created_at: string
        }[]).map(n => ({
          id:         n.id,
          category:   typeToCategory(n.type),
          title:      n.title,
          body:       n.body,
          read:       n.read,
          created_at: n.created_at,
        }))
        setNotifs(mapped)
        setDrawerLoaded(true)
      })
      .catch(() => { setDrawerLoaded(true) })
      .finally(() => { drawerLoadingRef.current = false })
  }, [notifOpen, drawerLoaded])

  // Re-fetch when navigating back to page with drawer closed
  useEffect(() => {
    setDrawerLoaded(false)
  }, [pathname])

  async function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await fetch('/api/user/notifications/mark-read', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ all: true }),
      })
    } catch { /* optimistic */ }
  }

  async function markOneRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await fetch('/api/user/notifications/mark-read', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      })
    } catch { /* optimistic */ }
  }

  const localUnread    = notifs.filter(n => !n.read).length
  const displayCount   = drawerLoaded ? localUnread : unreadCount

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

        @media (min-width: 768px) {
          .meridian-bottom-nav {
            display: none !important;
          }
        }
      `}</style>

      {/* Global top actions */}
      <ProfileButton
        pathname={pathname ?? ''}
        onOpen={() => router.push('/profile')}
        lang={lang}
      />

      <NotificationBell
        unreadCount={displayCount}
        pathname={pathname ?? ''}
        isOpen={notifOpen}
        onToggle={() => setNotifOpen(o => !o)}
        lang={lang}
      />

      {/* Backdrop — tapping outside closes the drawer */}
      <div
        onClick={() => setNotifOpen(false)}
        aria-hidden="true"
        style={{
          position:             'fixed',
          inset:                0,
          zIndex:               88,
          backgroundColor:      'rgba(0,0,0,0.45)',
          backdropFilter:       notifOpen ? 'blur(5px)' : 'none',
          WebkitBackdropFilter: notifOpen ? 'blur(5px)' : 'none',
          opacity:              notifOpen ? 1 : 0,
          pointerEvents:        notifOpen ? 'auto' : 'none',
          transition:           'opacity 0.25s ease',
        }}
      />

      {/* Notification Drawer — iOS-style bottom sheet */}
      <div
        role="dialog"
        aria-label={t(lang, 'notifications.title')}
        aria-modal="true"
        style={{
          position:             'fixed',
          bottom:               0,
          left:                 0,
          right:                0,
          zIndex:               89,
          transform:            notifOpen ? 'translateY(0)' : 'translateY(106%)',
          transition:           'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
          backgroundColor:      'rgba(4,12,15,0.99)',
          borderRadius:         '22px 22px 0 0',
          border:               `1px solid ${colors.cardBorder}`,
          borderBottom:         'none',
          backdropFilter:       'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow:            '0 -24px 60px rgba(0,0,0,0.55), 0 -1px 0 rgba(103,232,249,0.06)',
          maxHeight:            '72vh',
          display:              'flex',
          flexDirection:        'column',
          overflow:             'hidden',
          paddingBottom:        'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: '12px 0 2px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(154,203,193,0.18)' }} />
        </div>

        {/* Header */}
        <div style={{
          padding:       '10px 22px 14px',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'space-between',
          borderBottom:  `1px solid ${colors.cardBorder}`,
          flexShrink:    0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontFamily:    fonts.heading,
              fontSize:      '20px',
              fontWeight:    700,
              color:         colors.text,
              letterSpacing: '-0.03em',
            }}>
              {t(lang, 'notifications.title')}
            </span>
            {localUnread > 0 && (
              <span style={{
                padding:         '2px 8px',
                borderRadius:    '20px',
                fontSize:        '10px',
                fontWeight:      700,
                fontFamily:      fonts.ui,
                color:           colors.teal,
                backgroundColor: 'rgba(45,212,191,0.10)',
                border:          '1px solid rgba(45,212,191,0.22)',
              }}>
                {localUnread} {t(lang, 'notifications.new')}
              </span>
            )}
          </div>
          {localUnread > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background:   'none',
                border:       'none',
                cursor:       'pointer',
                fontFamily:   fonts.ui,
                fontSize:     '12px',
                fontWeight:   600,
                color:        colors.teal,
                padding:      '4px 8px',
                borderRadius: '6px',
                touchAction:  'manipulation',
              }}
            >
              {t(lang, 'notifications.markAllRead')}
            </button>
          )}
        </div>

        {/* Notification list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!drawerLoaded ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '40px 22px',
              fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted,
            }}>
              {t(lang, 'notifications.loading')}
            </div>
          ) : notifs.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '40px 22px', gap: '8px', textAlign: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(45,212,191,0.35)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3A6.5 6.5 0 0 0 5.5 9.5v4.7L4 17h16l-1.5-2.8V9.5A6.5 6.5 0 0 0 12 3Z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
              <p style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, margin: 0, lineHeight: 1.6 }}>
                {t(lang, 'notifications.empty')}
              </p>
            </div>
          ) : (
            notifs.map((n, i) => {
              const c = NOTIF_COLOR[n.category]
              return (
                <div
                  key={n.id}
                  onClick={!n.read ? () => markOneRead(n.id) : undefined}
                  style={{
                    padding:         '14px 22px',
                    borderBottom:    i < notifs.length - 1 ? `1px solid ${colors.cardBorder}` : 'none',
                    backgroundColor: n.read ? 'transparent' : 'rgba(45,212,191,0.015)',
                    display:         'flex',
                    gap:             '12px',
                    alignItems:      'flex-start',
                    cursor:          n.read ? 'default' : 'pointer',
                  }}
                >
                  {/* Indicator */}
                  <div style={{
                    width:           '28px',
                    height:          '28px',
                    borderRadius:    '8px',
                    flexShrink:      0,
                    backgroundColor: `${c}14`,
                    border:          `1px solid ${c}2A`,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    marginTop:       '1px',
                  }}>
                    {n.read ? (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6.5l2.5 2.5 5.5-5.5" />
                      </svg>
                    ) : (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: c, boxShadow: `0 0 5px ${c}` }} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display:       'flex',
                      justifyContent:'space-between',
                      alignItems:    'flex-start',
                      gap:           '8px',
                      marginBottom:  '3px',
                    }}>
                      <div style={{
                        fontFamily:  fonts.ui,
                        fontSize:    '13px',
                        fontWeight:  n.read ? 500 : 700,
                        color:       n.read ? colors.textSoft : colors.text,
                        lineHeight:  1.3,
                      }}>
                        {n.title}
                      </div>
                      <div style={{
                        fontFamily:  fonts.ui,
                        fontSize:    '10px',
                        color:       colors.textMuted,
                        whiteSpace:  'nowrap',
                        flexShrink:  0,
                        paddingTop:  '1px',
                      }}>
                        {relTime(n.created_at, lang)}
                      </div>
                    </div>
                    <div style={{
                      fontFamily:          fonts.ui,
                      fontSize:            '12px',
                      color:               colors.textMuted,
                      lineHeight:          1.55,
                      overflow:            'hidden',
                      display:             '-webkit-box',
                      WebkitLineClamp:     2,
                      WebkitBoxOrient:     'vertical',
                    } as React.CSSProperties}>
                      {n.body}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer — view all */}
        <div style={{
          padding:     '12px 22px',
          borderTop:   `1px solid ${colors.cardBorder}`,
          flexShrink:  0,
        }}>
          <button
            onClick={() => { router.push('/notifications'); setNotifOpen(false) }}
            style={{
              width:        '100%',
              padding:      '13px',
              background:   `linear-gradient(135deg, rgba(45,212,191,0.10), rgba(103,232,249,0.04))`,
              border:       `1px solid ${colors.cardBorder}`,
              borderRadius: '13px',
              cursor:       'pointer',
              fontFamily:   fonts.ui,
              fontSize:     '13px',
              fontWeight:   700,
              color:        colors.teal,
              letterSpacing:'-0.01em',
              touchAction:  'manipulation',
            }}
          >
            {t(lang, 'notifications.viewAll')} →
          </button>
        </div>
      </div>

      {/* Bottom navigation — 4 items */}
      <nav className="meridian-bottom-nav" style={{
        position:             'fixed',
        bottom:               0,
        left:                 0,
        right:                0,
        backgroundColor:      'rgba(6,19,22,0.95)',
        borderTop:            `1px solid ${colors.cardBorder}`,
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex:               100,
        padding:              '8px 0 env(safe-area-inset-bottom, 8px)',
      }}>
        <div className="meridian-nav-inner" style={{
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
                className="meridian-nav-item"
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
                  fontFamily:    fonts.ui,
                  transition:    'all 0.2s ease',
                  minWidth:      '60px',
                  touchAction:   'manipulation',
                }}
              >
                <NavIcon id={item.id} isActive={isActive} />
                <span className="meridian-nav-label" style={{
                  fontSize:      '9px',
                  fontWeight:    600,
                  letterSpacing: '0.04em',
                  color:         isActive ? colors.teal : colors.textMuted,
                  whiteSpace:    'nowrap',
                }}>
                  {item.label ? item.label[lang] : t(lang, item.labelKey!)}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
