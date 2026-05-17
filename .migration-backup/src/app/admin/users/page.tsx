'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AdminUserRow, AdminUserDetail } from '@/types/admin'

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
}
const fonts = { heading: '"Fraunces", serif', ui: '"Plus Jakarta Sans", sans-serif' }

const STATE_DOT: Record<string, string> = {
  Normal: '#2DD4BF', Optimal: '#2DD4BF',
  Low: '#FB923C', High: '#FB923C', Attention: '#FB923C',
  Critical: '#F87171', Watch: '#FCD34D',
}

function Dot({ state }: { state: string }) {
  return (
    <span style={{
      width:           '7px',
      height:          '7px',
      borderRadius:    '50%',
      backgroundColor: STATE_DOT[state] ?? colors.textMuted,
      display:         'inline-block',
      boxShadow:       `0 0 5px ${STATE_DOT[state] ?? colors.textMuted}80`,
      flexShrink:      0,
    }} />
  )
}

function Pill({ label, color }: { label: string; color?: string }) {
  const c = color ?? colors.textMuted
  return (
    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontFamily: fonts.ui, fontWeight: 600, color: c, backgroundColor: `${c}18`, border: `1px solid ${c}30`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label:    string
  value:    string
  onChange: (v: string) => void
  options:  { value: string; label: string }[]
}) {
  return (
    <div className="admin-filter-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontFamily: fonts.ui, fontSize: '10px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontFamily:      fonts.ui,
          fontSize:        '12px',
          color:           colors.textSoft,
          backgroundColor: colors.cardBg,
          border:          `1px solid ${colors.cardBorder}`,
          borderRadius:    '8px',
          padding:         '8px 10px',
          outline:         'none',
          cursor:          'pointer',
          minHeight:       '38px',
          width:           '100%',
          boxSizing:       'border-box',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value} style={{ backgroundColor: '#061316' }}>{o.label}</option>)}
      </select>
    </div>
  )
}

function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [user,    setUser]    = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/users/${userId}`)
      .then(r => r.json())
      .then(d => { setUser(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [userId])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 40, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      />
      {/* Drawer — admin-drawer class makes it full-width bottom sheet on mobile */}
      <div
        className="admin-drawer"
        style={{
          position:        'fixed',
          right:           0,
          top:             0,
          bottom:          0,
          width:           '420px',
          zIndex:          50,
          backgroundColor: '#071517',
          borderLeft:      `1px solid ${colors.cardBorder}`,
          overflowY:       'auto',
          display:         'flex',
          flexDirection:   'column',
          boxShadow:       '-20px 0 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Drawer header */}
        <div style={{
          padding:         '24px 24px 20px',
          borderBottom:    `1px solid ${colors.cardBorder}`,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          position:        'sticky',
          top:             0,
          backgroundColor: '#071517',
          zIndex:          1,
        }}>
          <div style={{ fontFamily: fonts.heading, fontSize: '18px', fontWeight: 700, color: colors.text }}>User Detail</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '4px 8px', minWidth: '36px', minHeight: '36px' }}
          >×</button>
        </div>

        {loading ? (
          <div style={{ padding: '40px 24px', fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>Loading…</div>
        ) : !user ? (
          <div style={{ padding: '40px 24px', fontFamily: fonts.ui, fontSize: '13px', color: '#F87171' }}>Failed to load user.</div>
        ) : (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Identity */}
            <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontFamily: fonts.heading, fontSize: '20px', fontWeight: 700, color: colors.text, marginBottom: '4px' }}>{user.display_name ?? user.full_name ?? '—'}</div>
              <div style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, marginBottom: '12px', wordBreak: 'break-all' }}>{user.email ?? '—'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {user.biological_profile && <Pill label={user.biological_profile} color={colors.teal} />}
                {user.user_profile       && <Pill label={user.user_profile.replace(/_/g, ' ')} color="#A78BFA" />}
                {user.safety_status === 'medical_alert' && <Pill label="Safety Alert" color="#F87171" />}
                {user.onboarding_completed ? <Pill label="Onboarded" color={colors.teal} /> : <Pill label="Onboarding Incomplete" color="#FCD34D" />}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Joined',       value: new Date(user.created_at).toLocaleDateString() },
                { label: 'Last Updated', value: user.updated_at ? new Date(user.updated_at).toLocaleDateString() : '—' },
                { label: 'Birth Date',   value: user.birth_date ?? '—' },
                { label: 'Height',       value: user.height_cm ? `${user.height_cm} cm` : '—' },
                { label: 'Weight',       value: user.weight_kg ? `${user.weight_kg} kg` : '—' },
                { label: 'Activity',     value: user.activity_level?.replace(/_/g, ' ') ?? '—' },
                { label: 'Diet',         value: user.diet_pattern?.replace(/_/g, ' ')   ?? '—' },
                { label: 'Goal Phase',   value: user.body_goal_phase?.replace(/_/g, ' ') ?? '—' },
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
    </>
  )
}

const PAGE_SIZE = 25

export default function AdminUsersPage() {
  const [users,        setUsers]        = useState<AdminUserRow[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [onboarding,   setOnboarding]   = useState('')
  const [bioProfile,   setBioProfile]   = useState('')
  const [safety,       setSafety]       = useState('')
  const [userProfile,  setUserProfile]  = useState('')
  const [hasLabs,      setHasLabs]      = useState('')
  const [sortBy,       setSortBy]       = useState('created_at')
  const [sortDir,      setSortDir]      = useState('desc')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(async (s: string, pg: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pg), sort: sortBy, dir: sortDir,
        ...(s           && { search: s }),
        ...(onboarding  && { onboarding }),
        ...(bioProfile  && { bio_profile: bioProfile }),
        ...(safety      && { safety }),
        ...(userProfile && { user_profile: userProfile }),
        ...(hasLabs     && { has_labs: hasLabs }),
      })
      const res  = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [sortBy, sortDir, onboarding, bioProfile, safety, userProfile, hasLabs])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); fetchUsers(search, 1) }, 300)
  }, [search, fetchUsers])

  useEffect(() => { fetchUsers(search, page) }, [page, fetchUsers])

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
        <p style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, margin: 0 }}>{total} total users</p>
      </div>

      {/* Search + Filters */}
      <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', padding: '18px 20px', marginBottom: '18px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{
            width:           '100%',
            fontFamily:      fonts.ui,
            fontSize:        '14px',
            color:           colors.text,
            backgroundColor: 'rgba(255,255,255,0.04)',
            border:          `1px solid ${colors.cardBorder}`,
            borderRadius:    '10px',
            padding:         '10px 14px',
            outline:         'none',
            marginBottom:    '14px',
            boxSizing:       'border-box',
            minHeight:       '44px',
          }}
        />
        {/* Filters row — becomes column on mobile */}
        <div className="admin-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <FilterSelect
            label="Onboarding" value={onboarding}
            onChange={v => { setOnboarding(v); setPage(1) }}
            options={[{ value: '', label: 'All' }, { value: 'true', label: 'Completed' }, { value: 'false', label: 'Incomplete' }]}
          />
          <FilterSelect
            label="Bio Profile" value={bioProfile}
            onChange={v => { setBioProfile(v); setPage(1) }}
            options={[{ value: '', label: 'All' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
          />
          <FilterSelect
            label="Safety" value={safety}
            onChange={v => { setSafety(v); setPage(1) }}
            options={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'medical_alert', label: 'Alert' }]}
          />
          <FilterSelect
            label="User Profile" value={userProfile}
            onChange={v => { setUserProfile(v); setPage(1) }}
            options={[
              { value: '', label: 'All' },
              { value: 'bienestar',    label: 'Bienestar' },
              { value: 'optimizacion', label: 'Optimización' },
              { value: 'rendimiento',  label: 'Rendimiento' },
              { value: 'condicion',    label: 'Condición' },
              { value: 'primer_paso',  label: 'Primer Paso' },
            ]}
          />
          <FilterSelect
            label="Labs" value={hasLabs}
            onChange={v => { setHasLabs(v); setPage(1) }}
            options={[{ value: '', label: 'All' }, { value: 'true', label: 'Has Labs' }, { value: 'false', label: 'No Labs' }]}
          />
        </div>
      </div>

      {/* Table — horizontal scroll on mobile */}
      <div
        className="admin-table-scroll"
        style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}
      >
        {/* Inner min-width wrapper */}
        <div className="admin-table-min">
          {/* Table header */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 70px 80px 90px',
            padding:             '12px 20px',
            borderBottom:        `1px solid ${colors.cardBorder}`,
            backgroundColor:     'rgba(45,212,191,0.03)',
          }}>
            {[
              { label: 'User',       col: 'full_name' },
              { label: 'Profile',    col: null },
              { label: 'Safety',     col: null },
              { label: 'Onboarding', col: null },
              { label: 'Labs',       col: null },
              { label: 'Joined',     col: 'created_at' },
              { label: '',           col: null },
            ].map((h, i) => (
              <div
                key={i}
                onClick={h.col ? () => toggleSort(h.col!) : undefined}
                style={{
                  fontFamily:    fonts.ui,
                  fontSize:      '10px',
                  fontWeight:    700,
                  color:         colors.textMuted,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  cursor:        h.col ? 'pointer' : 'default',
                  display:       'flex',
                  alignItems:    'center',
                  gap:           '4px',
                  userSelect:    'none',
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
                  display:             'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 70px 80px 90px',
                  padding:             '14px 20px',
                  borderBottom:        idx < users.length - 1 ? `1px solid ${colors.cardBorder}` : 'none',
                  cursor:              'pointer',
                  transition:          'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                onClick={() => setSelectedId(u.id)}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.display_name ?? u.full_name ?? '—'}
                  </div>
                  <div style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email ?? '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {u.biological_profile
                    ? <Pill label={u.biological_profile} color={colors.teal} />
                    : <span style={{ color: colors.textMuted, fontSize: '12px', fontFamily: fonts.ui }}>—</span>
                  }
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {u.safety_status === 'medical_alert'
                    ? <Pill label="Alert"  color="#F87171" />
                    : <Pill label="Active" color={colors.teal} />
                  }
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {u.onboarding_completed
                    ? <Pill label="Done"    color={colors.teal} />
                    : <Pill label="Pending" color="#FCD34D" />
                  }
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontFamily: fonts.ui, fontSize: '13px', color: u.labs_count > 0 ? colors.textSoft : colors.textMuted }}>
                  {u.labs_count}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontFamily: fonts.ui, fontSize: '12px', color: colors.textMuted }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </div>
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
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ fontFamily: fonts.ui, fontSize: '12px', color: page === 1 ? colors.textMuted : colors.teal, background: 'none', border: `1px solid ${colors.cardBorder}`, borderRadius: '6px', padding: '8px 14px', cursor: page === 1 ? 'not-allowed' : 'pointer', minHeight: '38px', touchAction: 'manipulation' }}
            >← Prev</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ fontFamily: fonts.ui, fontSize: '12px', color: page === totalPages ? colors.textMuted : colors.teal, background: 'none', border: `1px solid ${colors.cardBorder}`, borderRadius: '6px', padding: '8px 14px', cursor: page === totalPages ? 'not-allowed' : 'pointer', minHeight: '38px', touchAction: 'manipulation' }}
            >Next →</button>
          </div>
        </div>
      )}

      {selectedId && <UserDrawer userId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
