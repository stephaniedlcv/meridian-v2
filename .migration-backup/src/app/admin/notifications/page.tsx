'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Notification, NotificationType, TargetSegment } from '@/types/admin'

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
  custom:                 'Custom Segment',
}

const TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'in_app',       label: 'In-App' },
  { value: 'email',        label: 'Email' },
  { value: 'push',         label: 'Push (future)' },
  { value: 'system_alert', label: 'System Alert' },
  { value: 'safety_alert', label: 'Safety Alert' },
]

const SEGMENT_OPTIONS: { value: TargetSegment; label: string }[] = [
  { value: 'all',                   label: 'All Users' },
  { value: 'active_7d',             label: 'Active last 7 days' },
  { value: 'onboarding_incomplete', label: 'Onboarding Incomplete' },
  { value: 'no_labs',               label: 'No Labs Uploaded' },
  { value: 'safety_alert',          label: 'Safety Alert Users' },
  { value: 'wearable_connected',    label: 'Wearable Connected' },
]

function Pill({ label, color }: { label: string; color: string }) {
  return <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontFamily: fonts.ui, fontWeight: 700, color, backgroundColor: `${color}18`, border: `1px solid ${color}30`, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
}

function CreateNotificationDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title,        setTitle]        = useState('')
  const [body,         setBody]         = useState('')
  const [type,         setType]         = useState<NotificationType>('in_app')
  const [segment,      setSegment]      = useState<TargetSegment>('all')
  const [scheduledFor, setScheduledFor] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  async function handleSubmit(saveAsDraft: boolean) {
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:          title.trim(),
          body:           body.trim(),
          type,
          target_segment: segment,
          scheduled_for:  saveAsDraft ? null : (scheduledFor || null),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create notification'); return }
      onCreated()
      onClose()
    } catch (e) {
      setError('Network error')
    } finally { setSaving(false) }
  }

  const labelStyle: React.CSSProperties = { fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }
  const inputStyle: React.CSSProperties = { width: '100%', fontFamily: fonts.ui, fontSize: '13px', color: colors.text, backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', padding: '10px 12px', outline: 'none', boxSizing: 'border-box', resize: 'none' }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '460px', zIndex: 50, backgroundColor: '#071517', borderLeft: `1px solid ${colors.cardBorder}`, overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '24px 24px 20px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, backgroundColor: '#071517', zIndex: 1 }}>
          <div style={{ fontFamily: fonts.heading, fontSize: '18px', fontWeight: 700, color: colors.text }}>New Notification</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title…" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Notification body…" rows={4} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as NotificationType)} style={selectStyle}>
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ backgroundColor: '#061316' }}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Target Segment</label>
              <select value={segment} onChange={e => setSegment(e.target.value as TargetSegment)} style={selectStyle}>
                {SEGMENT_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ backgroundColor: '#061316' }}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Schedule For (optional)</label>
            <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
          </div>

          {error && <div style={{ fontFamily: fonts.ui, fontSize: '12px', color: '#F87171', padding: '10px 12px', backgroundColor: 'rgba(248,113,113,0.07)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)' }}>{error}</div>}
        </div>

        <div style={{ padding: '20px 24px', borderTop: `1px solid ${colors.cardBorder}`, display: 'flex', gap: '10px' }}>
          <button onClick={() => handleSubmit(true)} disabled={saving}
            style={{ flex: 1, fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, color: colors.textSoft, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '10px', padding: '12px', cursor: saving ? 'not-allowed' : 'pointer' }}>
            Save Draft
          </button>
          <button onClick={() => handleSubmit(false)} disabled={saving}
            style={{ flex: 1, fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, color: '#061316', backgroundColor: colors.teal, border: 'none', borderRadius: '10px', padding: '12px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {scheduledFor ? 'Schedule' : 'Create Notification'}
          </button>
        </div>
      </div>
    </>
  )
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]        = useState(true)
  const [filterStatus,  setFilterStatus]   = useState('')
  const [showCreate,    setShowCreate]     = useState(false)

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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'archived' }),
    })
    load()
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, margin: 0, marginBottom: '6px' }}>Notifications</h1>
          <p style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, margin: 0 }}>{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, color: '#061316', backgroundColor: colors.teal, border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', boxShadow: '0 0 20px rgba(45,212,191,0.25)' }}
        >
          + New Notification
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['', 'draft', 'scheduled', 'sent', 'archived'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600,
              color: filterStatus === s ? colors.text : colors.textMuted,
              backgroundColor: filterStatus === s ? 'rgba(45,212,191,0.12)' : colors.cardBg,
              border: `1px solid ${filterStatus === s ? 'rgba(45,212,191,0.3)' : colors.cardBorder}`,
              borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, padding: '40px 0' }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, padding: '60px 0', textAlign: 'center' }}>
          No notifications yet.<br />
          <span style={{ color: colors.teal, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowCreate(true)}>Create your first one →</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notifications.map(n => (
            <div key={n.id} style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fonts.ui, fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '4px' }}>{n.title}</div>
                  <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textSoft, lineHeight: 1.5 }}>{n.body}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <Pill label={n.status}                         color={STATUS_COLOR[n.status]  ?? colors.textMuted} />
                  <Pill label={TYPE_LABEL[n.type] ?? n.type}     color={colors.cyan} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                    Segment: <span style={{ color: colors.textSoft }}>{SEGMENT_LABEL[n.target_segment] ?? n.target_segment}</span>
                  </span>
                  <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                    Recipients: <span style={{ color: colors.textSoft }}>{n.recipient_count}</span>
                  </span>
                  {n.scheduled_for && (
                    <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                      Scheduled: <span style={{ color: '#FCD34D' }}>{new Date(n.scheduled_for).toLocaleString()}</span>
                    </span>
                  )}
                  <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
                {n.status !== 'archived' && n.status !== 'sent' && (
                  <button
                    onClick={() => archive(n.id)}
                    style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted, background: 'none', border: `1px solid ${colors.cardBorder}`, borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}
                  >
                    Archive
                  </button>
                )}
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
