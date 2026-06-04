'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar                  from '@/components/NavBar'

// ── Design tokens ─────────────────────────────────────────────────
const colors = {
  background: '#061316',
  teal:       '#2DD4BF',
  cyan:       '#67E8F9',
  text:       '#EAFBF7',
  textSoft:   '#9ACBC1',
  textMuted:  '#5F8E85',
  cardBg:     'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  inputBg:    'rgba(6,19,22,0.6)',
}
const fonts = {
  heading: '"Fraunces", serif',
  ui:      '"Plus Jakarta Sans", sans-serif',
}

// ── Notification types ─────────────────────────────────────────────
type NotifCategory = 'insights' | 'system' | 'reminders' | 'safety' | 'updates'

interface UserNotification {
  id:         string
  category:   NotifCategory
  title:      string
  body:       string
  read:       boolean
  created_at: string
}

// ── Map notification type → display category ───────────────────────
function typeToCategory(type: string): NotifCategory {
  if (type === 'safety_alert') return 'safety'
  if (type === 'system_alert') return 'system'
  if (type === 'push')         return 'reminders'
  if (type === 'email')        return 'updates'
  return 'insights'
}

// ── Category config ────────────────────────────────────────────────
const CATEGORY_META: Record<NotifCategory, { label: string; color: string; bg: string; border: string }> = {
  insights:  { label: 'Insight',   color: '#2DD4BF', bg: 'rgba(45,212,191,0.08)',   border: 'rgba(45,212,191,0.22)' },
  safety:    { label: 'Safety',    color: '#F87171', bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.22)' },
  reminders: { label: 'Reminder',  color: '#FCD34D', bg: 'rgba(252,211,77,0.08)',   border: 'rgba(252,211,77,0.22)'  },
  system:    { label: 'System',    color: '#9ACBC1', bg: 'rgba(154,203,193,0.08)',  border: 'rgba(154,203,193,0.18)' },
  updates:   { label: 'Update',    color: '#67E8F9', bg: 'rgba(103,232,249,0.08)',  border: 'rgba(103,232,249,0.18)' },
}

const ALL_CATEGORIES: NotifCategory[] = ['insights', 'safety', 'reminders', 'system', 'updates']

// ── Category icons ─────────────────────────────────────────────────
function CategoryIcon({ category, color }: { category: NotifCategory; color: string }) {
  if (category === 'insights') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="5.5" r="3" />
        <path d="M5 8.5v1a2 2 0 0 0 4 0v-1" />
        <line x1="7" y1="2" x2="7" y2="1" />
        <line x1="10.2" y1="3" x2="11" y2="2.2" />
        <line x1="3.8" y1="3" x2="3" y2="2.2" />
      </svg>
    )
  }
  if (category === 'safety') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 1L2 3.5v4C2 10.5 4.5 12.5 7 13c2.5-.5 5-2.5 5-5.5v-4L7 1Z" />
        <line x1="7" y1="5" x2="7" y2="7.5" />
        <circle cx="7" cy="9.5" r="0.6" fill={color} stroke="none" />
      </svg>
    )
  }
  if (category === 'reminders') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="5.5" />
        <polyline points="7,4 7,7 9,8.5" />
      </svg>
    )
  }
  if (category === 'system') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="1.8" />
        <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M3.05 3.05l1.06 1.06M9.89 9.89l1.06 1.06M3.05 10.95l1.06-1.06M9.89 4.11l1.06-1.06" />
      </svg>
    )
  }
  if (category === 'updates') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="7,1 8.5,5.5 13,5.5 9.5,8 10.5,12.5 7,10 3.5,12.5 4.5,8 1,5.5 5.5,5.5" />
      </svg>
    )
  }
  return null
}

// ── Helpers ────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs  = Math.floor(diff / 1000)
  const mins  = Math.floor(secs  / 60)
  const hours = Math.floor(mins  / 60)
  const days  = Math.floor(hours / 24)
  if (days  >= 1) return `${days}d ago`
  if (hours >= 1) return `${hours}h ago`
  if (mins  >= 1) return `${mins}m ago`
  return 'Just now'
}

// ── Main component ─────────────────────────────────────────────────
export default function NotificationsPage() {
  const router   = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )

  const [pageLoading,   setPageLoading]   = useState(true)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [activeFilter,  setActiveFilter]  = useState<NotifCategory | 'all'>('all')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/onboarding/welcome'); return }
      fetchNotifications()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchNotifications() {
    try {
      const res  = await fetch('/api/user/notifications')
      const data = await res.json() as {
        notifications: { id: string; title: string; body: string; type: string; read: boolean; created_at: string }[]
      }
      const mapped: UserNotification[] = (data.notifications ?? []).map(n => ({
        id:         n.id,
        category:   typeToCategory(n.type),
        title:      n.title,
        body:       n.body,
        read:       n.read,
        created_at: n.created_at,
      }))
      setNotifications(mapped)
    } catch {
      setNotifications([])
    } finally {
      setPageLoading(false)
    }
  }

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      await fetch('/api/user/notifications/mark-read', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      })
    } catch { /* optimistic — ignore network errors */ }
  }

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await fetch('/api/user/notifications/mark-read', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ all: true }),
      })
    } catch { /* optimistic — ignore network errors */ }
  }

  const filtered = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.category === activeFilter)

  const unreadTotal = notifications.filter(n => !n.read).length

  if (pageLoading) return null

  return (
    <div style={{
      minHeight:      '100vh',
      backgroundColor: colors.background,
      fontFamily:      fonts.ui,
      color:           colors.text,
      position:        'relative',
      overflowX:       'hidden',
    }}>
      {/* Ambient orbs */}
      <div style={{ position: 'fixed', top: '-20%', left: '-15%', width: '65%', height: '65%', background: 'radial-gradient(circle, rgba(45,212,191,0.10) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-15%', width: '65%', height: '65%', background: 'radial-gradient(circle, rgba(103,232,249,0.08) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '44px 20px 120px', position: 'relative', zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              marginBottom: '14px',
            }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.6)', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>
                Notifications
              </span>
            </div>
            <h1 style={{
              margin: 0, fontFamily: fonts.heading,
              fontSize: 'clamp(26px, 5vw, 32px)', fontWeight: 700,
              letterSpacing: '-0.04em', color: colors.text,
              lineHeight: 1.2,
            }}>
              Inbox
            </h1>
            {unreadTotal > 0 && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: colors.textMuted }}>
                {unreadTotal} unread
              </p>
            )}
          </div>

          {unreadTotal > 0 && (
            <button
              onClick={markAllRead}
              style={{
                marginTop:  '2px',
                background: 'transparent',
                border:     '1px solid rgba(103,232,249,0.15)',
                borderRadius: '8px',
                padding:    '7px 12px',
                color:      colors.textMuted,
                fontSize:   '11px',
                fontWeight: 600,
                cursor:     'pointer',
                fontFamily: fonts.ui,
                letterSpacing: '0.01em',
                transition: 'all 0.15s ease',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* ── Category filters ── */}
        <div style={{
          display:    'flex',
          gap:        '6px',
          marginBottom: '20px',
          overflowX:  'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
        }}>
          <FilterPill
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
            color={colors.teal}
          >
            All
          </FilterPill>
          {ALL_CATEGORIES.map(cat => (
            <FilterPill
              key={cat}
              active={activeFilter === cat}
              onClick={() => setActiveFilter(cat)}
              color={CATEGORY_META[cat].color}
            >
              {CATEGORY_META[cat].label}
            </FilterPill>
          ))}
        </div>

        {/* ── Notification list ── */}
        {filtered.length === 0 ? (
          <EmptyState category={activeFilter} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(notif => (
              <NotifCard
                key={notif.id}
                notif={notif}
                onMarkRead={() => markRead(notif.id)}
              />
            ))}
          </div>
        )}

        {/* ── Footer note ── */}
        {filtered.length > 0 && (
          <p style={{
            textAlign: 'center',
            fontSize:  '11px',
            color:     colors.textMuted,
            marginTop: '28px',
            opacity:   0.35,
            letterSpacing: '0.04em',
          }}>
            Meridian · Health Intelligence System
          </p>
        )}

      </div>
      <NavBar />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

function FilterPill({ active, onClick, color, children }: {
  active:   boolean
  onClick:  () => void
  color:    string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink:   0,
        padding:      '6px 14px',
        borderRadius: '999px',
        border:       active ? `1px solid ${color}40` : `1px solid ${colors.cardBorder}`,
        background:   active ? `${color}14` : 'transparent',
        color:        active ? color : colors.textMuted,
        fontSize:     '11px',
        fontWeight:   active ? 700 : 600,
        cursor:       'pointer',
        fontFamily:   fonts.ui,
        letterSpacing:'0.03em',
        transition:   'all 0.15s ease',
      }}
    >
      {children}
    </button>
  )
}

function NotifCard({ notif, onMarkRead }: {
  notif:      UserNotification
  onMarkRead: () => void
}) {
  const meta  = CATEGORY_META[notif.category]
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={!notif.read ? onMarkRead : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    hovered
          ? 'rgba(232,248,245,0.08)'
          : notif.read
            ? colors.cardBg
            : 'rgba(45,212,191,0.04)',
        border:        notif.read
          ? `1px solid ${colors.cardBorder}`
          : '1px solid rgba(45,212,191,0.16)',
        borderRadius:  '16px',
        backdropFilter:'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        padding:       '16px 18px',
        cursor:        notif.read ? 'default' : 'pointer',
        transition:    'all 0.18s ease',
        boxShadow:     notif.read
          ? 'none'
          : 'inset 0 1px 0 rgba(45,212,191,0.06)',
        position:      'relative',
      }}
    >
      {/* Unread indicator bar */}
      {!notif.read && (
        <div style={{
          position:    'absolute',
          left:        0,
          top:         '18px',
          bottom:      '18px',
          width:       '2px',
          borderRadius:'0 2px 2px 0',
          background:  'linear-gradient(180deg, #2DD4BF 0%, #67E8F9 100%)',
          boxShadow:   '0 0 8px rgba(45,212,191,0.5)',
        }} />
      )}

      {/* Top row: category badge + timestamp */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          '5px',
          padding:      '3px 9px 3px 7px',
          borderRadius: '20px',
          background:   meta.bg,
          border:       `1px solid ${meta.border}`,
        }}>
          <CategoryIcon category={notif.category} color={meta.color} />
          <span style={{ fontSize: '10px', fontWeight: 700, color: meta.color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {meta.label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!notif.read && (
            <div style={{
              width:  '6px', height: '6px', borderRadius: '50%',
              background: colors.teal,
              boxShadow: '0 0 6px rgba(45,212,191,0.8)',
              flexShrink: 0,
            }} />
          )}
          <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 500 }}>
            {relativeTime(notif.created_at)}
          </span>
        </div>
      </div>

      {/* Title */}
      <p style={{
        margin:     '0 0 6px',
        fontSize:   '14px',
        fontWeight: notif.read ? 600 : 700,
        color:      notif.read ? colors.textSoft : colors.text,
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      }}>
        {notif.title}
      </p>

      {/* Body */}
      <p style={{
        margin:     0,
        fontSize:   '12px',
        color:      colors.textMuted,
        lineHeight: 1.6,
        fontWeight: 400,
      }}>
        {notif.body}
      </p>

      {/* Mark read hint */}
      {!notif.read && (
        <p style={{
          margin:   '10px 0 0',
          fontSize: '10px',
          color:    'rgba(95,142,133,0.55)',
          fontWeight: 600,
          letterSpacing: '0.03em',
        }}>
          Tap to mark as read
        </p>
      )}
    </div>
  )
}

function EmptyState({ category }: { category: NotifCategory | 'all' }) {
  const label = category === 'all'
    ? 'notifications'
    : `${CATEGORY_META[category].label.toLowerCase()} notifications`

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '64px 24px',
      textAlign:      'center',
      gap:            '14px',
    }}>
      <div style={{
        width:      '56px',
        height:     '56px',
        borderRadius: '50%',
        background:  'rgba(45,212,191,0.06)',
        border:      '1px solid rgba(45,212,191,0.12)',
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        marginBottom: '4px',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(45,212,191,0.45)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3A6.5 6.5 0 0 0 5.5 9.5v4.7L4 17h16l-1.5-2.8V9.5A6.5 6.5 0 0 0 12 3Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      </div>

      <div>
        <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: colors.textSoft, letterSpacing: '-0.01em' }}>
          All clear
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted, lineHeight: 1.6 }}>
          No {label} right now.<br />
          Meridian will surface updates here as your health data evolves.
        </p>
      </div>
    </div>
  )
}
