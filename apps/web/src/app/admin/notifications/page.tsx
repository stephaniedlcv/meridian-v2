'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Notification, NotificationType, TargetSegment, SegmentFilters } from '@/types/admin'
import type { UserSearchResult } from '@/app/api/admin/users/search/route'

const colors = {
  background: '#061316',
  teal:       '#2DD4BF',
  cyan:       '#67E8F9',
  text:       '#EAFBF7',
  textSoft:   '#9ACBC1',
  textMuted:  '#5F8E85',
  cardBg:     'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
}
const fonts = { heading: '"Fraunces", serif', ui: '"Plus Jakarta Sans", sans-serif' }

const STATUS_COLOR: Record<string, string> = {
  draft:     '#9ACBC1',
  scheduled: '#FCD34D',
  sending:   '#67E8F9',
  sent:      '#2DD4BF',
  archived:  '#5F8E85',
}

const TYPE_LABEL: Record<string, string> = {
  in_app:       'In-App',
  email:        'Email',
  push:         'Push',
  system_alert: 'System',
  safety_alert: 'Safety',
}

const SEGMENT_LABEL: Record<string, string> = {
  all:                    'All Users',
  active_7d:              'Active 7d',
  onboarding_incomplete:  'Onboarding Incomplete',
  no_labs:                'No Labs',
  safety_alert:           'Safety Alert',
  wearable_connected:     'Wearable Connected',
  specific_users:         'Specific Users',
  female_only:            'Female Only',
  male_only:              'Male Only',
  admins_only:            'Admins Only',
  non_admins:             'Non-Admins',
  custom:                 'Custom Segment',
}

const TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'in_app',       label: 'In-App' },
  { value: 'email',        label: 'Email' },
  { value: 'push',         label: 'Push (future)' },
  { value: 'system_alert', label: 'System Alert' },
  { value: 'safety_alert', label: 'Safety Alert' },
]

const PRIMARY_SEGMENTS: { value: TargetSegment; label: string; desc: string }[] = [
  { value: 'all',            label: 'All Users',     desc: 'Every registered user'          },
  { value: 'specific_users', label: 'Specific Users',desc: 'Hand-pick individual recipients' },
  { value: 'female_only',    label: 'Female',        desc: 'biological_profile = female'    },
  { value: 'male_only',      label: 'Male',          desc: 'biological_profile = male'      },
  { value: 'admins_only',    label: 'Admins Only',   desc: 'Users with admin role'          },
  { value: 'non_admins',     label: 'Non-Admins',    desc: 'All non-admin users'            },
  { value: 'custom',         label: 'Custom',        desc: 'Combine multiple filters'       },
]

type CustomFilter = 'female' | 'male' | 'has_labs' | 'no_labs' | 'active_7d' | 'onboarding_incomplete'
const CUSTOM_FILTERS: { key: CustomFilter; label: string }[] = [
  { key: 'female',                 label: 'Female'           },
  { key: 'male',                   label: 'Male'             },
  { key: 'has_labs',               label: 'Has Labs'         },
  { key: 'no_labs',                label: 'No Labs'          },
  { key: 'active_7d',              label: 'Active 7d'        },
  { key: 'onboarding_incomplete',  label: 'Incomplete Setup' },
]

interface NotificationWithStats extends Notification {
  delivered_count: number
  opened_count:    number
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding:         '2px 8px',
      borderRadius:    '20px',
      fontSize:        '10px',
      fontFamily:      fonts.ui,
      fontWeight:      700,
      color,
      backgroundColor: `${color}18`,
      border:          `1px solid ${color}30`,
      letterSpacing:   '0.04em',
      textTransform:   'uppercase',
    }}>
      {label}
    </span>
  )
}

// ── User search picker ────────────────────────────────────────────────
function UserPicker({
  selected,
  onAdd,
  onRemove,
}: {
  selected: UserSearchResult[]
  onAdd:    (u: UserSearchResult) => void
  onRemove: (id: string) => void
}) {
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<UserSearchResult[]>([])
  const [loading,     setLoading]     = useState(false)
  const [dropOpen,    setDropOpen]    = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); setDropOpen(false); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        const all  = (data.users ?? []) as UserSearchResult[]
        const selectedIds = new Set(selected.map(s => s.id))
        setResults(all.filter(u => !selectedIds.has(u.id)))
        setDropOpen(true)
      } catch {
        setResults([])
      } finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, selected])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const inputStyle: React.CSSProperties = {
    width:           '100%',
    fontFamily:      fonts.ui,
    fontSize:        '13px',
    color:           colors.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
    border:          `1px solid ${colors.cardBorder}`,
    borderRadius:    '8px',
    padding:         '10px 12px',
    outline:         'none',
    boxSizing:       'border-box',
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {selected.map(u => (
            <div key={u.id} style={{
              display:         'inline-flex',
              alignItems:      'center',
              gap:             '6px',
              padding:         '4px 8px 4px 10px',
              borderRadius:    '20px',
              backgroundColor: 'rgba(45,212,191,0.10)',
              border:          '1px solid rgba(45,212,191,0.25)',
              fontSize:        '12px',
              fontFamily:      fonts.ui,
              fontWeight:      600,
              color:           colors.text,
              maxWidth:        '220px',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                {u.display_name ?? u.email ?? u.id.slice(0, 8)}
              </span>
              {u.email && u.display_name && (
                <span style={{ fontSize: '10px', color: colors.textMuted, flexShrink: 0 }}>
                  {u.email.split('@')[0]}
                </span>
              )}
              <button
                onClick={() => onRemove(u.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: '0', lineHeight: 1, fontSize: '14px', flexShrink: 0, touchAction: 'manipulation' }}
                aria-label={`Remove ${u.display_name ?? u.email}`}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setDropOpen(true)}
          placeholder="Search by name or email…"
          style={inputStyle}
          autoComplete="off"
        />
        {loading && (
          <div style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            width: '14px', height: '14px',
            border: `2px solid ${colors.cardBorder}`,
            borderTop: `2px solid ${colors.teal}`,
            borderRadius: '50%',
            animation: 'meridian-spin 0.6s linear infinite',
          }} />
        )}
      </div>

      {dropOpen && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          backgroundColor: '#071a1e', border: `1px solid ${colors.cardBorder}`,
          borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(20px)', overflow: 'hidden', maxHeight: '220px', overflowY: 'auto',
        }}>
          {results.map((u, i) => (
            <button
              key={u.id}
              onClick={() => { onAdd(u); setQuery(''); setDropOpen(false) }}
              style={{
                width: '100%', padding: '10px 14px', display: 'flex', flexDirection: 'column',
                gap: '2px', alignItems: 'flex-start', background: 'none', border: 'none',
                borderBottom: i < results.length - 1 ? `1px solid ${colors.cardBorder}` : 'none',
                cursor: 'pointer', touchAction: 'manipulation', transition: 'background 0.12s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(45,212,191,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, color: colors.text, lineHeight: 1.2 }}>
                {u.display_name ?? 'Unnamed User'}
              </span>
              {u.email && (
                <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                  {u.email}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {dropOpen && query.length >= 2 && !loading && results.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          backgroundColor: '#071a1e', border: `1px solid ${colors.cardBorder}`,
          borderRadius: '10px', padding: '14px',
          fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted, textAlign: 'center',
        }}>
          No users found for "{query}"
        </div>
      )}
    </div>
  )
}

// ── Audience count + breakdown badge ─────────────────────────────────
function AudienceCount({
  segment,
  filters,
  specificCount,
}: {
  segment:       TargetSegment
  filters:       SegmentFilters
  specificCount: number
}) {
  const [breakdown, setBreakdown] = useState<{ total: number; female: number; male: number } | null>(null)
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    if (segment === 'specific_users') {
      setBreakdown({ total: specificCount, female: 0, male: 0 })
      return
    }

    setLoading(true)
    setBreakdown(null)
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch('/api/admin/notifications/audience-breakdown', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ segment, filters }),
        })
        const data = await res.json() as { total: number; female: number; male: number }
        setBreakdown(data)
      } catch {
        setBreakdown(null)
      } finally { setLoading(false) }
    }, 450)
    return () => clearTimeout(timer)
  }, [segment, filters, specificCount])

  return (
    <div style={{
      padding:         '12px 14px',
      borderRadius:    '8px',
      backgroundColor: 'rgba(45,212,191,0.05)',
      border:          '1px solid rgba(45,212,191,0.14)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: breakdown && (breakdown.female > 0 || breakdown.male > 0) ? '8px' : 0 }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.teal, boxShadow: `0 0 6px ${colors.teal}`, flexShrink: 0 }} />
        <span style={{ fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600, color: colors.textSoft }}>
          This notification will reach:&nbsp;
        </span>
        {loading ? (
          <span style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted }}>Estimating…</span>
        ) : breakdown === null ? (
          <span style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted }}>—</span>
        ) : (
          <span style={{ fontFamily: fonts.ui, fontSize: '12px', fontWeight: 700, color: colors.teal }}>
            {breakdown.total.toLocaleString()} user{breakdown.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {breakdown && breakdown.total > 0 && (breakdown.female > 0 || breakdown.male > 0) && segment !== 'specific_users' && (
        <div style={{ display: 'flex', gap: '16px', paddingLeft: '14px' }}>
          {breakdown.female > 0 && (
            <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
              <span style={{ color: colors.textSoft, fontWeight: 600 }}>{breakdown.female}</span> female
            </span>
          )}
          {breakdown.male > 0 && (
            <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
              <span style={{ color: colors.textSoft, fontWeight: 600 }}>{breakdown.male}</span> male
            </span>
          )}
          {breakdown.total - breakdown.female - breakdown.male > 0 && (
            <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
              <span style={{ color: colors.textSoft, fontWeight: 600 }}>{breakdown.total - breakdown.female - breakdown.male}</span> unset
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Notification composer drawer ──────────────────────────────────────
function CreateNotificationDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title,         setTitle]         = useState('')
  const [body,          setBody]          = useState('')
  const [type,          setType]          = useState<NotificationType>('in_app')
  const [segment,       setSegment]       = useState<TargetSegment>('all')
  const [scheduledFor,  setScheduledFor]  = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([])
  const [customFilters, setCustomFilters] = useState<Set<CustomFilter>>(new Set())

  function toggleCustomFilter(f: CustomFilter) {
    setCustomFilters(prev => {
      const next = new Set(prev)
      if (next.has(f)) {
        next.delete(f)
      } else {
        if (f === 'female') next.delete('male')
        if (f === 'male')   next.delete('female')
        if (f === 'has_labs') next.delete('no_labs')
        if (f === 'no_labs')  next.delete('has_labs')
        next.add(f)
      }
      return next
    })
  }

  const builtFilters: SegmentFilters = (() => {
    if (segment === 'specific_users') {
      return { specific_user_ids: selectedUsers.map(u => u.id) }
    }
    if (segment === 'custom') {
      return {
        biological_profile:    customFilters.has('female') ? 'female' : customFilters.has('male') ? 'male' : undefined,
        has_labs:              customFilters.has('has_labs') ? true : customFilters.has('no_labs') ? false : undefined,
        active_7d:             customFilters.has('active_7d') || undefined,
        onboarding_incomplete: customFilters.has('onboarding_incomplete') || undefined,
      }
    }
    return {}
  })()

  async function handleSubmit(saveAsDraft: boolean) {
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return }
    if (segment === 'specific_users' && selectedUsers.length === 0) {
      setError('Select at least one user.')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/admin/notifications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           title.trim(),
          body:            body.trim(),
          type,
          target_segment:  segment,
          segment_filters: Object.keys(builtFilters).length > 0 ? builtFilters : null,
          scheduled_for:   saveAsDraft ? null : (scheduledFor || null),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create notification'); return }
      onCreated()
      onClose()
    } catch {
      setError('Network error')
    } finally { setSaving(false) }
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600,
    color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase',
    display: 'block', marginBottom: '8px',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', fontFamily: fonts.ui, fontSize: '13px', color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.cardBorder}`,
    borderRadius: '8px', padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
    resize: 'none', minHeight: '44px',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  return (
    <>
      <style>{`
        @keyframes meridian-spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>

      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 40, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      />

      <div
        className="admin-drawer"
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: '480px', zIndex: 50,
          backgroundColor: '#071517', borderLeft: `1px solid ${colors.cardBorder}`,
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{
          padding: '24px 24px 20px', borderBottom: `1px solid ${colors.cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, backgroundColor: '#071517', zIndex: 1,
        }}>
          <div style={{ fontFamily: fonts.heading, fontSize: '18px', fontWeight: 700, color: colors.text }}>
            New Notification
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '4px 8px', minWidth: '36px', minHeight: '36px' }}
          >×</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px', flex: 1 }}>

          <div>
            <label style={labelStyle}>Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Notification title…"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Body</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Notification body…"
              rows={4}
              style={{ ...inputStyle, minHeight: '96px' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as NotificationType)}
              style={selectStyle}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value} style={{ backgroundColor: '#061316' }}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Audience Targeting</label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '14px' }}>
              {PRIMARY_SEGMENTS.map(s => {
                const active = segment === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => {
                      setSegment(s.value)
                      setCustomFilters(new Set())
                      setSelectedUsers([])
                    }}
                    title={s.desc}
                    style={{
                      fontFamily:      fonts.ui,
                      fontSize:        '12px',
                      fontWeight:      600,
                      color:           active ? colors.teal : colors.textSoft,
                      backgroundColor: active ? 'rgba(45,212,191,0.10)' : 'rgba(255,255,255,0.03)',
                      border:          `1px solid ${active ? 'rgba(45,212,191,0.30)' : colors.cardBorder}`,
                      borderRadius:    '8px',
                      padding:         '7px 13px',
                      cursor:          'pointer',
                      touchAction:     'manipulation',
                      transition:      'all 0.15s ease',
                      whiteSpace:      'nowrap',
                      minHeight:       '36px',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>

            {segment === 'specific_users' && (
              <div style={{ marginBottom: '14px' }}>
                <UserPicker
                  selected={selectedUsers}
                  onAdd={u => setSelectedUsers(prev => [...prev, u])}
                  onRemove={id => setSelectedUsers(prev => prev.filter(u => u.id !== id))}
                />
              </div>
            )}

            {segment === 'custom' && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontFamily: fonts.ui, color: colors.textMuted, marginBottom: '8px', letterSpacing: '0.04em' }}>
                  Combine filters — all selected conditions apply (AND logic)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {CUSTOM_FILTERS.map(f => {
                    const active = customFilters.has(f.key)
                    return (
                      <button
                        key={f.key}
                        onClick={() => toggleCustomFilter(f.key)}
                        style={{
                          fontFamily:      fonts.ui,
                          fontSize:        '12px',
                          fontWeight:      600,
                          color:           active ? '#061316' : colors.textSoft,
                          backgroundColor: active ? colors.teal : 'rgba(255,255,255,0.03)',
                          border:          `1px solid ${active ? colors.teal : colors.cardBorder}`,
                          borderRadius:    '8px',
                          padding:         '6px 12px',
                          cursor:          'pointer',
                          touchAction:     'manipulation',
                          transition:      'all 0.15s ease',
                          minHeight:       '34px',
                        }}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <AudienceCount
              segment={segment}
              filters={builtFilters}
              specificCount={selectedUsers.length}
            />
          </div>

          <div>
            <label style={labelStyle}>Schedule For (optional)</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={e => setScheduledFor(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>

          {error && (
            <div style={{
              fontFamily: fonts.ui, fontSize: '12px', color: '#F87171',
              padding: '10px 12px', backgroundColor: 'rgba(248,113,113,0.07)',
              borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)',
            }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '20px 24px', borderTop: `1px solid ${colors.cardBorder}`, display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            style={{
              flex: 1, fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600,
              color: colors.textSoft, backgroundColor: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`, borderRadius: '10px',
              padding: '14px', cursor: saving ? 'not-allowed' : 'pointer',
              minHeight: '48px', touchAction: 'manipulation',
            }}
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            style={{
              flex: 1, fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600,
              color: '#061316', backgroundColor: colors.teal, border: 'none',
              borderRadius: '10px', padding: '14px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1, minHeight: '48px', touchAction: 'manipulation',
            }}
          >
            {saving ? 'Saving…' : scheduledFor ? 'Schedule' : 'Save Draft & Close'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationWithStats[]>([])
  const [loading,       setLoading]        = useState(true)
  const [filterStatus,  setFilterStatus]   = useState('')
  const [showCreate,    setShowCreate]      = useState(false)
  const [sending,       setSending]         = useState<string | null>(null)
  const [sendError,     setSendError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterStatus ? `?status=${filterStatus}` : ''
      const res    = await fetch(`/api/admin/notifications${params}`)
      const data   = await res.json()
      setNotifications(data.notifications ?? [])
    } finally { setLoading(false) }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  async function archive(id: string) {
    await fetch('/api/admin/notifications', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, status: 'archived' }),
    })
    load()
  }

  async function sendNow(id: string) {
    setSending(id)
    setSendError(null)
    try {
      const res  = await fetch('/api/admin/notifications', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, status: 'sent' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error ?? 'Failed to send')
        return
      }
      load()
    } catch {
      setSendError('Network error')
    } finally { setSending(null) }
  }

  return (
    <div className="admin-page-pad" style={{ padding: '32px 36px', maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, margin: 0, marginBottom: '6px' }}>
            Notifications
          </h1>
          <p style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, margin: 0 }}>
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600,
            color: '#061316', backgroundColor: colors.teal, border: 'none',
            borderRadius: '10px', padding: '11px 22px', cursor: 'pointer',
            boxShadow: '0 0 20px rgba(45,212,191,0.25)', touchAction: 'manipulation',
            minHeight: '44px', whiteSpace: 'nowrap',
          }}
        >
          + New Notification
        </button>
      </div>

      {/* Send error banner */}
      {sendError && (
        <div style={{
          marginBottom: '16px', padding: '10px 14px',
          backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: '8px', fontFamily: fonts.ui, fontSize: '12px', color: '#F87171',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{sendError}</span>
          <button
            onClick={() => setSendError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', fontSize: '16px', padding: '0 0 0 12px' }}
          >×</button>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['', 'draft', 'scheduled', 'sent', 'archived'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              fontFamily:      fonts.ui,
              fontSize:        '12px',
              fontWeight:      600,
              color:           filterStatus === s ? colors.text : colors.textMuted,
              backgroundColor: filterStatus === s ? 'rgba(45,212,191,0.12)' : colors.cardBg,
              border:          `1px solid ${filterStatus === s ? 'rgba(45,212,191,0.3)' : colors.cardBorder}`,
              borderRadius:    '8px',
              padding:         '8px 16px',
              cursor:          'pointer',
              transition:      'all 0.15s',
              textTransform:   'capitalize',
              touchAction:     'manipulation',
              minHeight:       '40px',
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, padding: '40px 0' }}>
          Loading…
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, padding: '60px 0', textAlign: 'center', lineHeight: 2 }}>
          No notifications yet.<br />
          <span
            style={{ color: colors.teal, cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setShowCreate(true)}
          >
            Create your first one →
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notifications.map(n => (
            <div
              key={n.id}
              style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '18px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.ui, fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '4px' }}>
                    {n.title}
                  </div>
                  <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textSoft, lineHeight: 1.5 }}>
                    {n.body}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                  <Pill label={n.status}                       color={STATUS_COLOR[n.status]  ?? colors.textMuted} />
                  <Pill label={TYPE_LABEL[n.type] ?? n.type}   color={colors.cyan} />
                </div>
              </div>

              {/* Stats + actions row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                    Audience: <span style={{ color: colors.textSoft }}>{SEGMENT_LABEL[n.target_segment] ?? n.target_segment}</span>
                  </span>
                  <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                    Recipients: <span style={{ color: colors.textSoft }}>{n.recipient_count}</span>
                  </span>
                  {n.status === 'sent' && (
                    <>
                      <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                        Delivered: <span style={{ color: colors.teal }}>{n.delivered_count}</span>
                      </span>
                      <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                        Opened: <span style={{ color: n.opened_count > 0 ? colors.cyan : colors.textMuted }}>{n.opened_count}</span>
                      </span>
                      {n.delivered_count > 0 && (
                        <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                          Open rate: <span style={{ color: colors.textSoft }}>
                            {Math.round((n.opened_count / n.delivered_count) * 100)}%
                          </span>
                        </span>
                      )}
                    </>
                  )}
                  {n.scheduled_for && (
                    <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                      Scheduled: <span style={{ color: '#FCD34D' }}>{new Date(n.scheduled_for).toLocaleString()}</span>
                    </span>
                  )}
                  {n.sent_at && (
                    <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                      Sent: <span style={{ color: colors.textSoft }}>{new Date(n.sent_at).toLocaleString()}</span>
                    </span>
                  )}
                  <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {/* Send Now button — draft and scheduled only */}
                  {(n.status === 'draft' || n.status === 'scheduled') && (
                    <button
                      onClick={() => sendNow(n.id)}
                      disabled={sending === n.id}
                      style={{
                        fontFamily:      fonts.ui,
                        fontSize:        '11px',
                        fontWeight:      700,
                        color:           '#061316',
                        backgroundColor: sending === n.id ? 'rgba(45,212,191,0.5)' : colors.teal,
                        border:          'none',
                        borderRadius:    '6px',
                        padding:         '7px 14px',
                        cursor:          sending === n.id ? 'not-allowed' : 'pointer',
                        touchAction:     'manipulation',
                        minHeight:       '36px',
                        transition:      'all 0.15s ease',
                        whiteSpace:      'nowrap',
                      }}
                    >
                      {sending === n.id ? 'Sending…' : 'Send Now'}
                    </button>
                  )}

                  {/* Archive button */}
                  {n.status !== 'archived' && n.status !== 'sent' && (
                    <button
                      onClick={() => archive(n.id)}
                      style={{
                        fontFamily:  fonts.ui,
                        fontSize:    '11px',
                        color:       colors.textMuted,
                        background:  'none',
                        border:      `1px solid ${colors.cardBorder}`,
                        borderRadius:'6px',
                        padding:     '6px 12px',
                        cursor:      'pointer',
                        touchAction: 'manipulation',
                        minHeight:   '36px',
                      }}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateNotificationDrawer onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  )
}
