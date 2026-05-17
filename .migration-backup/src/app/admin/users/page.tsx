'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AdminUserRow, AdminUserDetail, AdminRole, AccountStatus } from '@/types/admin'

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
  rowHover:   'rgba(45,212,191,0.04)',
  red:        '#F87171',
  amber:      '#FCD34D',
}
const fonts = { heading: '"Fraunces", serif', ui: '"Plus Jakarta Sans", sans-serif' }

// ── Role + status meta ────────────────────────────────────────────
const ROLES: AdminRole[] = ['super_admin', 'admin', 'analyst', 'support', 'clinician_readonly']
const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin:        'Super Admin',
  admin:              'Admin',
  analyst:            'Analyst',
  support:            'Support',
  clinician_readonly: 'Clinician',
}
const ROLE_COLOR: Record<AdminRole, string> = {
  super_admin:        colors.cyan,
  admin:              colors.teal,
  analyst:            '#A78BFA',
  support:            colors.amber,
  clinician_readonly: '#86EFAC',
}

const STATUS_LABEL: Record<AccountStatus, string> = {
  active:         'Active',
  suspended:      'Suspended',
  banned:         'Banned',
  disabled:       'Disabled',
  pending_review: 'Review',
}
const STATUS_COLOR: Record<AccountStatus, string> = {
  active:         colors.teal,
  suspended:      colors.amber,
  banned:         colors.red,
  disabled:       colors.textMuted,
  pending_review: '#A78BFA',
}

const STATE_DOT: Record<string, string> = {
  Normal: colors.teal, Optimal: colors.teal,
  Low: '#FB923C', High: '#FB923C', Attention: '#FB923C',
  Critical: colors.red, Watch: colors.amber,
}

// ── Shared sub-components ─────────────────────────────────────────
function Dot({ state }: { state: string }) {
  return (
    <span style={{
      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
      backgroundColor: STATE_DOT[state] ?? colors.textMuted,
      display: 'inline-block',
      boxShadow: `0 0 5px ${STATE_DOT[state] ?? colors.textMuted}80`,
    }} />
  )
}

function Pill({ label, color }: { label: string; color?: string }) {
  const c = color ?? colors.textMuted
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '20px',
      fontSize: '11px', fontFamily: fonts.ui, fontWeight: 600,
      color: c, backgroundColor: `${c}18`, border: `1px solid ${c}30`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function RolePill({ role }: { role: AdminRole | null }) {
  if (!role) return <span style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted }}>—</span>
  const c = ROLE_COLOR[role] ?? colors.teal
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '20px',
      fontSize: '11px', fontFamily: fonts.ui, fontWeight: 700,
      color: c, backgroundColor: `${c}18`, border: `1px solid ${c}35`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}` }} />
      {ROLE_LABEL[role]}
    </span>
  )
}

function StatusPill({ status }: { status: AccountStatus }) {
  const c = STATUS_COLOR[status] ?? colors.textMuted
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '20px',
      fontSize: '11px', fontFamily: fonts.ui, fontWeight: 700,
      color: c, backgroundColor: `${c}18`, border: `1px solid ${c}30`,
      whiteSpace: 'nowrap',
    }}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="admin-filter-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontFamily: fonts.ui, fontSize: '10px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{
          fontFamily: fonts.ui, fontSize: '12px', color: colors.textSoft,
          backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
          borderRadius: '8px', padding: '8px 10px', outline: 'none',
          cursor: 'pointer', minHeight: '38px', width: '100%', boxSizing: 'border-box',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value} style={{ backgroundColor: '#061316' }}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmColor, requireReason, loading, onConfirm, onCancel }: {
  title:         string
  message:       string
  confirmLabel:  string
  confirmColor?: string
  requireReason?: boolean
  loading:       boolean
  onConfirm:     (reason: string) => void
  onCancel:      () => void
}) {
  const [reason, setReason] = useState('')
  const cc = confirmColor ?? colors.red

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div style={{
        position: 'fixed', zIndex: 70, top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: '380px',
        margin: '0 16px', boxSizing: 'border-box',
      }}>
        <div style={{
          backgroundColor: '#0A1C20', border: `1px solid ${colors.cardBorder}`,
          borderRadius: '16px', padding: '28px 24px',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${cc}18`, border: `1px solid ${cc}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={cc} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 1L1 13h12L7 1Z" />
                <line x1="7" y1="6" x2="7" y2="9" />
                <circle cx="7" cy="11" r="0.5" fill={cc} stroke="none" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: fonts.heading, fontSize: '16px', fontWeight: 700, color: colors.text, marginBottom: '4px' }}>{title}</div>
              <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, lineHeight: 1.5 }}>{message}</div>
            </div>
          </div>

          {requireReason !== false && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontFamily: fonts.ui, fontSize: '10px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px' }}>
                Reason {requireReason ? '(required)' : '(optional)'}
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Enter reason…"
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  fontFamily: fonts.ui, fontSize: '13px', color: colors.text,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${colors.cardBorder}`, borderRadius: '8px',
                  padding: '9px 12px', outline: 'none',
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                background: 'transparent', border: `1px solid ${colors.cardBorder}`,
                color: colors.textSoft, fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', fontFamily: fonts.ui,
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={loading || (requireReason === true && !reason.trim())}
              style={{
                flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
                background: loading ? `${cc}40` : `${cc}CC`,
                color: '#061316', fontSize: '13px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: fonts.ui,
              }}
            >
              {loading ? 'Processing…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Role Selector ─────────────────────────────────────────────────
function RoleSelector({ value, onChange }: { value: AdminRole; onChange: (r: AdminRole) => void }) {
  return (
    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
      {ROLES.map(r => {
        const active = value === r
        const c = ROLE_COLOR[r]
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            style={{
              padding: '5px 11px', borderRadius: '20px', border: 'none',
              background: active ? `${c}28` : 'rgba(255,255,255,0.03)',
              color: active ? c : colors.textMuted,
              fontSize: '11px', fontWeight: active ? 700 : 500,
              cursor: 'pointer', fontFamily: fonts.ui, letterSpacing: '0.01em',
              boxShadow: active ? `inset 0 0 0 1px ${c}50` : `inset 0 0 0 1px ${colors.cardBorder}`,
              transition: 'all 0.12s ease',
            }}
          >
            {ROLE_LABEL[r]}
          </button>
        )
      })}
    </div>
  )
}

// ── User Drawer ───────────────────────────────────────────────────
function UserDrawer({ userId, actingRole, onClose }: {
  userId:      string
  actingRole:  AdminRole | null
  onClose:     () => void
}) {
  const [user,        setUser]        = useState<AdminUserDetail | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [actionBusy,  setActionBusy]  = useState(false)
  const [feedback,    setFeedback]    = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // Access management state
  const [selectedRole, setSelectedRole] = useState<AdminRole>('admin')

  // Moderation state
  const [moderateReason, setModerateReason] = useState('')

  // Confirm modal state
  const [confirm, setConfirm] = useState<{
    title:         string
    message:       string
    confirmLabel:  string
    confirmColor?: string
    requireReason?: boolean
    onConfirm:     (reason: string) => void
  } | null>(null)

  const isSuperAdmin = actingRole === 'super_admin'

  function loadUser() {
    setLoading(true)
    setFeedback(null)
    fetch(`/api/admin/users/${userId}`)
      .then(r => r.json())
      .then(d => {
        setUser(d)
        setSelectedRole(d.admin_role ?? 'admin')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadUser() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  function showFeedback(type: 'ok' | 'err', msg: string) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function callAccess(action: string, role?: AdminRole, reason?: string) {
    setActionBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, role, reason }),
      })
      const data = await res.json()
      if (!res.ok) { showFeedback('err', data.error ?? 'Action failed'); return }
      showFeedback('ok', 'Access updated.')
      loadUser()
    } finally {
      setActionBusy(false)
      setConfirm(null)
    }
  }

  async function callModerate(action: string, reason: string) {
    setActionBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const data = await res.json()
      if (!res.ok) { showFeedback('err', data.error ?? 'Action failed'); return }
      showFeedback('ok', 'User status updated.')
      loadUser()
    } finally {
      setActionBusy(false)
      setConfirm(null)
      setModerateReason('')
    }
  }

  function confirmAction(cfg: typeof confirm) { setConfirm(cfg) }

  const status: AccountStatus = user?.account_status ?? 'active'
  const isAdmin: boolean      = user?.is_admin        ?? false

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 40, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />

      {/* Drawer */}
      <div
        className="admin-drawer"
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: '460px', zIndex: 50,
          backgroundColor: '#071517', borderLeft: `1px solid ${colors.cardBorder}`,
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 20px', borderBottom: `1px solid ${colors.cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, backgroundColor: '#071517', zIndex: 1,
        }}>
          <div style={{ fontFamily: fonts.heading, fontSize: '18px', fontWeight: 700, color: colors.text }}>User Detail</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '4px 8px', minWidth: '36px', minHeight: '36px' }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: '40px 24px', fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>Loading…</div>
        ) : !user ? (
          <div style={{ padding: '40px 24px', fontFamily: fonts.ui, fontSize: '13px', color: colors.red }}>Failed to load user.</div>
        ) : (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Feedback banner */}
            {feedback && (
              <div style={{
                padding: '10px 14px', borderRadius: '10px',
                background: feedback.type === 'ok' ? 'rgba(45,212,191,0.08)' : 'rgba(248,113,113,0.08)',
                border: `1px solid ${feedback.type === 'ok' ? 'rgba(45,212,191,0.25)' : 'rgba(248,113,113,0.25)'}`,
                fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600,
                color: feedback.type === 'ok' ? colors.teal : colors.red,
              }}>
                {feedback.msg}
              </div>
            )}

            {/* Identity */}
            <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                <div style={{ fontFamily: fonts.heading, fontSize: '20px', fontWeight: 700, color: colors.text }}>
                  {user.display_name ?? user.full_name ?? '—'}
                </div>
                <StatusPill status={status} />
              </div>
              <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, marginBottom: '12px', wordBreak: 'break-all' }}>{user.email ?? '—'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {user.admin_role && <RolePill role={user.admin_role} />}
                {user.biological_profile && <Pill label={user.biological_profile} color={colors.teal} />}
                {user.user_profile && <Pill label={user.user_profile.replace(/_/g, ' ')} color="#A78BFA" />}
                {user.safety_status === 'medical_alert' && <Pill label="Safety Alert" color={colors.red} />}
                {user.onboarding_completed ? <Pill label="Onboarded" color={colors.teal} /> : <Pill label="Onboarding Incomplete" color={colors.amber} />}
                {user.deleted_at && <Pill label="Soft Deleted" color={colors.textMuted} />}
              </div>
            </div>

            {/* ── SYSTEM ACCESS — super_admin only ─────────────── */}
            {isSuperAdmin && (
              <div style={{
                backgroundColor: 'rgba(103,232,249,0.03)',
                border: `1px solid rgba(103,232,249,0.12)`,
                borderRadius: '14px', padding: '18px 20px',
                display: 'flex', flexDirection: 'column', gap: '18px',
              }}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: fonts.ui, fontSize: '10px', fontWeight: 700, color: colors.textMuted, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                    System Access
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(103,232,249,0.06)', border: '1px solid rgba(103,232,249,0.16)' }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.cyan, boxShadow: '0 0 5px rgba(103,232,249,0.8)' }} />
                    <span style={{ fontSize: '9px', fontWeight: 700, color: colors.cyan, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Operator Controls</span>
                  </div>
                </div>

                {/* ── Admin Role subsection ──────────────────────── */}
                <div>
                  <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '10px' }}>
                    Admin Role
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    {isAdmin ? (
                      <RolePill role={user.admin_role!} />
                    ) : (
                      <span style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted, fontStyle: 'italic' }}>No admin access</span>
                    )}
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontFamily: fonts.ui, fontSize: '10px', color: colors.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '7px' }}>
                      {isAdmin ? 'Change role to:' : 'Assign role:'}
                    </div>
                    <RoleSelector value={selectedRole} onChange={setSelectedRole} />
                  </div>

                  <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                    {!isAdmin ? (
                      <button
                        disabled={actionBusy}
                        onClick={() => callAccess('grant', selectedRole, moderateReason)}
                        style={{
                          padding: '8px 16px', borderRadius: '8px', border: 'none',
                          background: actionBusy ? 'rgba(45,212,191,0.2)' : 'rgba(45,212,191,0.15)',
                          color: colors.teal, fontSize: '12px', fontWeight: 700,
                          cursor: actionBusy ? 'not-allowed' : 'pointer', fontFamily: fonts.ui,
                          boxShadow: 'inset 0 0 0 1px rgba(45,212,191,0.35)',
                        }}
                      >
                        Grant Admin Access
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={actionBusy}
                          onClick={() => callAccess('change_role', selectedRole)}
                          style={{
                            padding: '8px 16px', borderRadius: '8px', border: 'none',
                            background: actionBusy ? 'rgba(45,212,191,0.1)' : 'rgba(45,212,191,0.12)',
                            color: colors.teal, fontSize: '12px', fontWeight: 700,
                            cursor: actionBusy ? 'not-allowed' : 'pointer', fontFamily: fonts.ui,
                            boxShadow: 'inset 0 0 0 1px rgba(45,212,191,0.30)',
                          }}
                        >
                          Update Role
                        </button>
                        <button
                          disabled={actionBusy}
                          onClick={() => confirmAction({
                            title:        'Revoke Admin Access',
                            message:      `Remove admin privileges from ${user.display_name ?? user.full_name ?? 'this user'}? They will lose all console access immediately.`,
                            confirmLabel: 'Revoke Access',
                            confirmColor: colors.red,
                            onConfirm:    (reason) => callAccess('revoke', undefined, reason),
                          })}
                          style={{
                            padding: '8px 16px', borderRadius: '8px', border: 'none',
                            background: 'rgba(248,113,113,0.08)',
                            color: colors.red, fontSize: '12px', fontWeight: 700,
                            cursor: actionBusy ? 'not-allowed' : 'pointer', fontFamily: fonts.ui,
                            boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.25)',
                          }}
                        >
                          Revoke Access
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: colors.cardBorder }} />

                {/* ── Account Moderation subsection ─────────────── */}
                <div>
                  <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '10px' }}>
                    Account Status
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <StatusPill status={status} />
                    {user.moderation_reason && (
                      <div style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted, marginTop: '6px', fontStyle: 'italic' }}>
                        Reason: {user.moderation_reason}
                      </div>
                    )}
                    {status === 'suspended' && user.suspended_at && (
                      <div style={{ fontFamily: fonts.ui, fontSize: '10px', color: colors.textMuted, marginTop: '3px' }}>
                        Since {new Date(user.suspended_at).toLocaleDateString()}
                      </div>
                    )}
                    {status === 'banned' && user.banned_at && (
                      <div style={{ fontFamily: fonts.ui, fontSize: '10px', color: colors.textMuted, marginTop: '3px' }}>
                        Banned {new Date(user.banned_at).toLocaleDateString()}
                      </div>
                    )}
                    {user.deleted_at && (
                      <div style={{ fontFamily: fonts.ui, fontSize: '10px', color: colors.textMuted, marginTop: '3px' }}>
                        Soft deleted {new Date(user.deleted_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Reason input */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontFamily: fonts.ui, fontSize: '10px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>
                      Reason (optional)
                    </label>
                    <input
                      value={moderateReason}
                      onChange={e => setModerateReason(e.target.value)}
                      placeholder="Add a reason for this action…"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        fontFamily: fonts.ui, fontSize: '12px', color: colors.text,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${colors.cardBorder}`,
                        borderRadius: '8px', padding: '8px 12px', outline: 'none',
                      }}
                    />
                  </div>

                  {/* Context-sensitive action buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Restore — always visible except when active with no deleted_at */}
                    {(status !== 'active' || user.deleted_at) && (
                      <ActionBtn
                        label="Restore Access"
                        color={colors.teal}
                        disabled={actionBusy}
                        onClick={() => callModerate('restore', moderateReason)}
                      />
                    )}

                    {/* Suspend — visible when active or pending_review */}
                    {(status === 'active' || status === 'pending_review') && (
                      <ActionBtn
                        label="Suspend"
                        color={colors.amber}
                        disabled={actionBusy}
                        onClick={() => callModerate('suspend', moderateReason)}
                      />
                    )}

                    {/* Lift suspension */}
                    {status === 'suspended' && (
                      <ActionBtn
                        label="Lift Suspension"
                        color={colors.teal}
                        disabled={actionBusy}
                        onClick={() => callModerate('restore', moderateReason)}
                      />
                    )}

                    {/* Disable */}
                    {(status === 'active' || status === 'suspended' || status === 'pending_review') && (
                      <ActionBtn
                        label="Disable"
                        color={colors.textMuted}
                        disabled={actionBusy}
                        onClick={() => callModerate('disable', moderateReason)}
                      />
                    )}

                    {/* Ban — danger, requires confirm */}
                    {status !== 'banned' && !user.deleted_at && (
                      <ActionBtn
                        label="Ban User"
                        color={colors.red}
                        disabled={actionBusy}
                        onClick={() => confirmAction({
                          title:        'Ban User',
                          message:      `Permanently ban ${user.display_name ?? user.full_name ?? 'this user'}? Their session will be invalidated and future logins blocked.`,
                          confirmLabel: 'Ban User',
                          confirmColor: colors.red,
                          onConfirm:    (reason) => callModerate('ban', reason || moderateReason),
                        })}
                      />
                    )}

                    {/* Soft delete — danger, requires confirm */}
                    {!user.deleted_at && (
                      <ActionBtn
                        label="Soft Delete"
                        color={colors.red}
                        disabled={actionBusy}
                        onClick={() => confirmAction({
                          title:         'Soft Delete User',
                          message:       `Mark ${user.display_name ?? user.full_name ?? 'this user'} as deleted? Data is preserved and this action is reversible by a super_admin.`,
                          confirmLabel:  'Soft Delete',
                          confirmColor:  colors.red,
                          requireReason: true,
                          onConfirm:     (reason) => callModerate('soft_delete', reason || moderateReason),
                        })}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Joined',        value: new Date(user.created_at).toLocaleDateString() },
                { label: 'Last Updated',  value: user.updated_at ? new Date(user.updated_at).toLocaleDateString() : '—' },
                { label: 'Birth Date',    value: user.birth_date  ?? '—' },
                { label: 'Height',        value: user.height_cm   ? `${user.height_cm} cm` : '—' },
                { label: 'Weight',        value: user.weight_kg   ? `${user.weight_kg} kg` : '—' },
                { label: 'Activity',      value: user.activity_level?.replace(/_/g, ' ')   ?? '—' },
                { label: 'Diet',          value: user.diet_pattern?.replace(/_/g, ' ')     ?? '—' },
                { label: 'Goal Phase',    value: user.body_goal_phase?.replace(/_/g, ' ')  ?? '—' },
              ].map(item => (
                <div key={item.label} style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontFamily: fonts.ui, fontSize: '10px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textSoft, textTransform: 'capitalize' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Recent biomarkers */}
            <div>
              <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '10px' }}>Recent Biomarkers</div>
              {user.recentBiomarkers.length === 0 ? (
                <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>No labs on record.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {user.recentBiomarkers.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', flexWrap: 'wrap' }}>
                      <Dot state={b.state} />
                      <span style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textSoft, flex: 1, minWidth: '80px' }}>{b.marker_name}</span>
                      <span style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.text, fontWeight: 600, whiteSpace: 'nowrap' }}>{b.value ?? '—'} {b.unit}</span>
                      <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted, whiteSpace: 'nowrap' }}>{b.collected_at.slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Confirm Modal — rendered above everything */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          confirmColor={confirm.confirmColor}
          requireReason={confirm.requireReason}
          loading={actionBusy}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  )
}

function ActionBtn({ label, color, disabled, onClick }: {
  label: string; color: string; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 13px', borderRadius: '8px', border: 'none',
        background: `${color}12`,
        color: color,
        fontSize: '12px', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: fonts.ui,
        boxShadow: `inset 0 0 0 1px ${color}30`,
        transition: 'all 0.12s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────
const PAGE_SIZE = 25

export default function AdminUsersPage() {
  const [users,        setUsers]        = useState<AdminUserRow[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [fetchError,   setFetchError]   = useState<string | null>(null)
  const [actingRole,   setActingRole]   = useState<AdminRole | null>(null)

  // Filters
  const [search,       setSearch]       = useState('')
  const [onboarding,   setOnboarding]   = useState('')
  const [bioProfile,   setBioProfile]   = useState('')
  const [safety,       setSafety]       = useState('')
  const [userProfile,  setUserProfile]  = useState('')
  const [hasLabs,      setHasLabs]      = useState('')
  const [isAdmin,      setIsAdmin]      = useState('')       // 'true' | 'false' | ''
  const [roleFilter,   setRoleFilter]   = useState('')       // AdminRole | ''
  const [statusFilter, setStatusFilter] = useState('')       // AccountStatus | ''

  const [sortBy,       setSortBy]       = useState('created_at')
  const [sortDir,      setSortDir]      = useState('desc')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch acting admin role
  useEffect(() => {
    fetch('/api/admin/check')
      .then(r => r.ok ? r.json() : { isAdmin: false })
      .then(d => setActingRole(d.isAdmin ? d.role : null))
      .catch(() => {})
  }, [])

  const fetchUsers = useCallback(async (s: string, pg: number) => {
    setLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams({
        page: String(pg), sort: sortBy, dir: sortDir,
        ...(s            && { search:         s            }),
        ...(onboarding   && { onboarding                   }),
        ...(bioProfile   && { bio_profile:    bioProfile   }),
        ...(safety       && { safety                       }),
        ...(userProfile  && { user_profile:   userProfile  }),
        ...(hasLabs      && { has_labs:       hasLabs      }),
        ...(isAdmin      && { is_admin:       isAdmin      }),
        ...(roleFilter   && { role:           roleFilter   }),
        ...(statusFilter && { account_status: statusFilter }),
      })
      const res  = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.error ?? `Server error ${res.status}`
        console.error('[admin/users] fetch failed:', msg)
        setFetchError(msg)
        setUsers([])
        setTotal(0)
        return
      }
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error fetching users'
      console.error('[admin/users] fetch exception:', err)
      setFetchError(msg)
      setUsers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [sortBy, sortDir, onboarding, bioProfile, safety, userProfile, hasLabs, isAdmin, roleFilter, statusFilter])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); fetchUsers(search, 1) }, 300)
  }, [search, fetchUsers])

  useEffect(() => { fetchUsers(search, page) }, [page, fetchUsers]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="admin-page-pad" style={{ padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, margin: 0, marginBottom: '6px' }}>Users</h1>
        <p style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, margin: 0 }}>
          {fetchError ? 'Failed to load' : `${total} total users`}
        </p>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div style={{
          marginBottom: '16px',
          padding: '14px 18px',
          borderRadius: '12px',
          backgroundColor: 'rgba(248,113,113,0.07)',
          border: '1px solid rgba(248,113,113,0.25)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
            <path d="M8 1L1 14h14L8 1Z" stroke="#F87171" strokeWidth="1.4" strokeLinejoin="round" />
            <line x1="8" y1="6.5" x2="8" y2="10" stroke="#F87171" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="12" r="0.6" fill="#F87171" />
          </svg>
          <div>
            <div style={{ fontFamily: fonts.ui, fontSize: '13px', fontWeight: 700, color: colors.red, marginBottom: '2px' }}>
              Failed to load users
            </div>
            <div style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted, lineHeight: 1.5 }}>
              {fetchError}
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '18px 20px', marginBottom: '18px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{
            width: '100%', fontFamily: fonts.ui, fontSize: '14px', color: colors.text,
            backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.cardBorder}`,
            borderRadius: '10px', padding: '10px 14px', outline: 'none',
            marginBottom: '14px', boxSizing: 'border-box', minHeight: '44px',
          }}
        />
        <div className="admin-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <FilterSelect
            label="Access" value={isAdmin}
            onChange={v => { setIsAdmin(v); setPage(1) }}
            options={[{ value: '', label: 'All Users' }, { value: 'true', label: 'Admins Only' }, { value: 'false', label: 'Non-Admins' }]}
          />
          <FilterSelect
            label="Role" value={roleFilter}
            onChange={v => { setRoleFilter(v); setIsAdmin(v ? 'true' : ''); setPage(1) }}
            options={[
              { value: '',                   label: 'All Roles'  },
              { value: 'super_admin',        label: 'Super Admin' },
              { value: 'admin',              label: 'Admin'       },
              { value: 'analyst',            label: 'Analyst'     },
              { value: 'support',            label: 'Support'     },
              { value: 'clinician_readonly', label: 'Clinician'   },
            ]}
          />
          <FilterSelect
            label="Account Status" value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1) }}
            options={[
              { value: '',               label: 'All Statuses'  },
              { value: 'active',         label: 'Active'        },
              { value: 'suspended',      label: 'Suspended'     },
              { value: 'banned',         label: 'Banned'        },
              { value: 'disabled',       label: 'Disabled'      },
              { value: 'pending_review', label: 'Pending Review' },
            ]}
          />
          <FilterSelect
            label="Onboarding" value={onboarding}
            onChange={v => { setOnboarding(v); setPage(1) }}
            options={[{ value: '', label: 'All' }, { value: 'true', label: 'Completed' }, { value: 'false', label: 'Incomplete' }]}
          />
          <FilterSelect
            label="Safety" value={safety}
            onChange={v => { setSafety(v); setPage(1) }}
            options={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'medical_alert', label: 'Alert' }]}
          />
          <FilterSelect
            label="Bio Profile" value={bioProfile}
            onChange={v => { setBioProfile(v); setPage(1) }}
            options={[{ value: '', label: 'All' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
          />
          <FilterSelect
            label="User Profile" value={userProfile}
            onChange={v => { setUserProfile(v); setPage(1) }}
            options={[
              { value: '',             label: 'All'          },
              { value: 'bienestar',    label: 'Bienestar'    },
              { value: 'optimizacion', label: 'Optimización' },
              { value: 'rendimiento',  label: 'Rendimiento'  },
              { value: 'condicion',    label: 'Condición'    },
              { value: 'primer_paso',  label: 'Primer Paso'  },
            ]}
          />
          <FilterSelect
            label="Labs" value={hasLabs}
            onChange={v => { setHasLabs(v); setPage(1) }}
            options={[{ value: '', label: 'All' }, { value: 'true', label: 'Has Labs' }, { value: 'false', label: 'No Labs' }]}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="admin-table-scroll"
        style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}
      >
        <div className="admin-table-min">
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 0.7fr 0.7fr 55px 80px 65px',
            padding: '12px 20px',
            borderBottom: `1px solid ${colors.cardBorder}`,
            backgroundColor: 'rgba(45,212,191,0.03)',
          }}>
            {[
              { label: 'User',       col: 'full_name'  },
              { label: 'Access',     col: null          },
              { label: 'Status',     col: null          },
              { label: 'Safety',     col: null          },
              { label: 'Onboarding', col: null          },
              { label: 'Labs',       col: null          },
              { label: 'Joined',     col: 'created_at'  },
              { label: '',           col: null          },
            ].map((h, i) => (
              <div
                key={i}
                onClick={h.col ? () => toggleSort(h.col!) : undefined}
                style={{
                  fontFamily: fonts.ui, fontSize: '10px', fontWeight: 700,
                  color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: h.col ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: '4px', userSelect: 'none',
                }}
              >
                {h.label}
                {h.col && sortBy === h.col && <span style={{ color: colors.teal }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '40px 20px', fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>Loading…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: '40px 20px', fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>No users match the current filters.</div>
          ) : (
            users.map((u, idx) => (
              <div
                key={u.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 0.7fr 0.7fr 55px 80px 65px',
                  padding: '13px 20px',
                  borderBottom: idx < users.length - 1 ? `1px solid ${colors.cardBorder}` : 'none',
                  cursor: 'pointer', transition: 'background 0.12s',
                  opacity: u.account_status !== 'active' ? 0.65 : 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                onClick={() => setSelectedId(u.id)}
              >
                {/* User */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.display_name ?? u.full_name ?? '—'}
                  </div>
                  <div style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email ?? '—'}
                  </div>
                </div>
                {/* Access */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <RolePill role={u.admin_role} />
                </div>
                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <StatusPill status={u.account_status ?? 'active'} />
                </div>
                {/* Safety */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {u.safety_status === 'medical_alert'
                    ? <Pill label="Alert"  color={colors.red} />
                    : <Pill label="Active" color={colors.teal} />
                  }
                </div>
                {/* Onboarding */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {u.onboarding_completed
                    ? <Pill label="Done"    color={colors.teal} />
                    : <Pill label="Pending" color={colors.amber} />
                  }
                </div>
                {/* Labs */}
                <div style={{ display: 'flex', alignItems: 'center', fontFamily: fonts.ui, fontSize: '13px', color: u.labs_count > 0 ? colors.textSoft : colors.textMuted }}>
                  {u.labs_count}
                </div>
                {/* Joined */}
                <div style={{ display: 'flex', alignItems: 'center', fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </div>
                {/* Action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedId(u.id) }}
                    style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.teal, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', touchAction: 'manipulation' }}
                  >
                    View →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="admin-pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted }}>Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ fontFamily: fonts.ui, fontSize: '12px', color: page === 1 ? colors.textMuted : colors.teal, background: 'none', border: `1px solid ${colors.cardBorder}`, borderRadius: '6px', padding: '8px 14px', cursor: page === 1 ? 'not-allowed' : 'pointer', minHeight: '38px', touchAction: 'manipulation' }}
            >← Prev</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ fontFamily: fonts.ui, fontSize: '12px', color: page === totalPages ? colors.textMuted : colors.teal, background: 'none', border: `1px solid ${colors.cardBorder}`, borderRadius: '6px', padding: '8px 14px', cursor: page === totalPages ? 'not-allowed' : 'pointer', minHeight: '38px', touchAction: 'manipulation' }}
            >Next →</button>
          </div>
        </div>
      )}

      {selectedId && (
        <UserDrawer
          userId={selectedId}
          actingRole={actingRole}
          onClose={() => { setSelectedId(null); fetchUsers(search, page) }}
        />
      )}
    </div>
  )
}
