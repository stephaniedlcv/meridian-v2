'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar from '@/components/NavBar'

// ——— Design tokens ———
const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  inputBg: 'rgba(6,19,22,0.6)',
}

const fonts = {
  heading: '"Fraunces", serif',
  ui: '"Plus Jakarta Sans", sans-serif',
}

// ——— Types ———
type BiologicalProfile = 'female' | 'male'
type UserProfile = 'bienestar' | 'optimizacion' | 'rendimiento' | 'condicion' | 'primer_paso'

interface ProfileData {
  full_name: string | null
  preferred_name: string | null   // may not yet exist in DB — handled gracefully
  biological_profile: BiologicalProfile | null
  user_profile: UserProfile | null
  avatar_url: string | null        // may not yet exist in DB — handled gracefully
  birth_date: string | null
}

// ——— Goal reference map ———
const GOAL_MAP: Record<UserProfile, { label: string; description: string }> = {
  bienestar:    {
    label: 'General Wellness',
    description: 'Meridian tracks your everyday vitality and surfaces patterns that affect how you feel day to day.',
  },
  optimizacion: {
    label: 'Optimization',
    description: "You're already in good shape — Meridian helps fine-tune what's working and identify where you can push further.",
  },
  rendimiento:  {
    label: 'Peak Performance',
    description: 'Meridian prioritizes markers that affect physical and mental output, recovery, and resilience at the edge.',
  },
  condicion:    {
    label: 'Specific Condition',
    description: 'Meridian keeps close watch on the markers most relevant to your health concern and surfaces meaningful changes.',
  },
  primer_paso:  {
    label: 'Getting Started',
    description: "You're beginning your health journey. Meridian delivers clear, accessible insights without overwhelming detail.",
  },
}

const BIO_MAP: Record<BiologicalProfile, string> = {
  female: 'Female biology',
  male: 'Male biology',
}

const ALL_GOALS: UserProfile[] = ['bienestar', 'optimizacion', 'rendimiento', 'condicion', 'primer_paso']

// ——— Main page ———
export default function ProfilePage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Core state
  const [pageLoading, setPageLoading]   = useState(true)
  const [userId, setUserId]             = useState('')
  const [userEmail, setUserEmail]       = useState('')
  const [profile, setProfile]           = useState<ProfileData>({
    full_name: null, preferred_name: null, biological_profile: null,
    user_profile: null, avatar_url: null, birth_date: null,
  })
  const [hasLabs, setHasLabs]           = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Edit state
  const [editingSection, setEditingSection]       = useState<'identity' | 'focus' | null>(null)
  const [editPreferredName, setEditPreferredName] = useState('')
  const [editBioProfile, setEditBioProfile]       = useState<BiologicalProfile | null>(null)
  const [editUserProfile, setEditUserProfile]     = useState<UserProfile | null>(null)
  const [saving, setSaving]                       = useState(false)
  const [saveStatus, setSaveStatus]               = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, biological_profile, user_profile, birth_date, preferred_name, avatar_url')
        .eq('id', user.id)
        .single()

      if (prof) {
        // Cast to unknown first to safely read fields that may not exist in the DB schema yet
        const raw = prof as unknown as Record<string, unknown>
        setProfile({
          full_name:           typeof raw.full_name === 'string'           ? raw.full_name           : null,
          preferred_name:      typeof raw.preferred_name === 'string'      ? raw.preferred_name      : null,
          biological_profile:  (raw.biological_profile === 'female' || raw.biological_profile === 'male') ? raw.biological_profile : null,
          user_profile:        typeof raw.user_profile === 'string'        ? raw.user_profile as UserProfile : null,
          avatar_url:          typeof raw.avatar_url === 'string'          ? raw.avatar_url          : null,
          birth_date:          typeof raw.birth_date === 'string'          ? raw.birth_date          : null,
        })
      }

      const { count } = await supabase
        .from('biomarkers_static')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setHasLabs(typeof count === 'number' && count > 0)

      setPageLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ——— Derived ———
  const displayName = profile.preferred_name || profile.full_name || 'Your Profile'
  const avatarSrc   = photoPreview || profile.avatar_url

  // ——— Photo handlers ———
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setPhotoPreview(ev.target?.result as string) }
    reader.readAsDataURL(file)
    // TODO: upload to Supabase Storage and persist avatar_url in profiles when bucket is configured
  }

  function handleRemovePhoto() {
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    // TODO: clear avatar_url in profiles table here
  }

  // ——— Edit handlers ———
  function startEditIdentity() {
    setEditPreferredName(profile.preferred_name || profile.full_name || '')
    setEditBioProfile(profile.biological_profile)
    setEditingSection('identity')
    setSaveStatus('idle')
  }

  function startEditFocus() {
    setEditUserProfile(profile.user_profile)
    setEditingSection('focus')
    setSaveStatus('idle')
  }

  function cancelEdit() {
    setEditingSection(null)
    setSaveStatus('idle')
  }

  async function saveIdentity() {
    if (!userId) return
    setSaving(true)
    setSaveStatus('idle')

    // Try full update including preferred_name
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_name: editPreferredName || null, biological_profile: editBioProfile })
      .eq('id', userId)

    if (error) {
      // preferred_name column may not exist yet — fall back to biological_profile only
      const { error: fallback } = await supabase
        .from('profiles')
        .update({ biological_profile: editBioProfile })
        .eq('id', userId)
      setSaving(false)
      if (fallback) { setSaveStatus('error'); return }
      setProfile(p => ({ ...p, biological_profile: editBioProfile }))
    } else {
      setSaving(false)
      setProfile(p => ({ ...p, preferred_name: editPreferredName || null, biological_profile: editBioProfile }))
    }

    setSaveStatus('success')
    setTimeout(() => { setEditingSection(null); setSaveStatus('idle') }, 900)
  }

  async function saveFocus() {
    if (!userId || !editUserProfile) return
    setSaving(true)
    setSaveStatus('idle')
    const { error } = await supabase
      .from('profiles')
      .update({ user_profile: editUserProfile })
      .eq('id', userId)
    setSaving(false)
    if (error) { setSaveStatus('error'); return }
    setProfile(p => ({ ...p, user_profile: editUserProfile }))
    setSaveStatus('success')
    setTimeout(() => { setEditingSection(null); setSaveStatus('idle') }, 900)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/onboarding/welcome')
  }

  if (pageLoading) return null

  // ——— Render ———
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      fontFamily: fonts.ui,
      color: colors.text,
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* Ambient orbs */}
      <div style={{ position: 'fixed', top: '-20%', left: '-15%', width: '65%', height: '65%', background: 'radial-gradient(circle, rgba(45,212,191,0.10) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-15%', width: '65%', height: '65%', background: 'radial-gradient(circle, rgba(103,232,249,0.08) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', width: '45%', height: '30%', background: 'radial-gradient(circle, rgba(45,212,191,0.04) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: '540px', margin: '0 auto', padding: '0 20px 120px', position: 'relative', zIndex: 1 }}>

        {/* ═══════════════════════════════════════ HERO ══ */}
        <div style={{
          paddingTop: '52px',
          paddingBottom: '36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
        }}>
          {/* Glow behind avatar */}
          <div style={{
            position: 'absolute',
            top: '36px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '220px',
            height: '220px',
            background: 'radial-gradient(circle, rgba(45,212,191,0.17) 0%, transparent 68%)',
            filter: 'blur(36px)',
            pointerEvents: 'none',
          }} />

          {/* Identity chip */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.13em',
            textTransform: 'uppercase', color: colors.teal,
            padding: '4px 13px',
            border: '1px solid rgba(45,212,191,0.22)',
            borderRadius: '20px',
            background: 'rgba(45,212,191,0.06)',
            marginBottom: '26px',
            position: 'relative',
          }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.9)' }} />
            Biological Identity
          </div>

          {/* Avatar circle */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <div style={{
              width: '96px', height: '96px', borderRadius: '50%',
              border: '2px solid rgba(45,212,191,0.50)',
              boxShadow: '0 0 0 5px rgba(45,212,191,0.07), 0 0 36px rgba(45,212,191,0.20)',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(6,19,22,0.95) 0%, rgba(15,38,44,0.90) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{
                  fontFamily: fonts.heading,
                  fontSize: '44px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1,
                  background: 'linear-gradient(135deg, #EAFBF7 0%, #67E8F9 40%, #2DD4BF 100%)',
                  backgroundClip: 'text', WebkitBackgroundClip: 'text',
                  color: 'transparent', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 10px rgba(45,212,191,0.45))',
                  userSelect: 'none',
                }}>
                  {displayName !== 'Your Profile' ? displayName[0].toUpperCase() : 'M'}
                </span>
              )}
            </div>

            {/* Upload button on avatar */}
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label={avatarSrc ? 'Change photo' : 'Upload photo'}
              style={{
                position: 'absolute', bottom: '0', right: '-4px',
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'rgba(45,212,191,0.14)',
                border: '1.5px solid rgba(45,212,191,0.48)',
                color: colors.teal, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 700, lineHeight: 1,
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              +
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>

          {/* Photo action links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px', height: '18px' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.teal, fontSize: '12px', fontWeight: 600, fontFamily: fonts.ui, letterSpacing: '-0.01em', padding: 0 }}
            >
              {avatarSrc ? 'Change photo' : 'Upload photo'}
            </button>
            {avatarSrc && (
              <>
                <span style={{ color: colors.textMuted, fontSize: '12px', userSelect: 'none' }}>·</span>
                <button
                  onClick={handleRemovePhoto}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: '12px', fontWeight: 600, fontFamily: fonts.ui, letterSpacing: '-0.01em', padding: 0 }}
                >
                  Remove
                </button>
              </>
            )}
          </div>

          {/* Name */}
          <h1 style={{
            fontFamily: fonts.heading,
            fontSize: 'clamp(28px, 7vw, 38px)',
            fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1,
            color: colors.text,
            margin: '0 0 7px',
          }}>
            {displayName}
          </h1>

          {/* Email */}
          <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0, letterSpacing: '-0.01em' }}>
            {userEmail}
          </p>
        </div>

        {/* ═══════════════════════════════════ IDENTITY CARD ══ */}
        <div style={cardStyle}>
          <div style={cardHeaderRow}>
            <span style={cardLabel}>Identity</span>
            {editingSection !== 'identity' && (
              <SmallButton onClick={startEditIdentity}>Edit</SmallButton>
            )}
          </div>

          {editingSection === 'identity' ? (
            <div>
              {/* Display name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={fieldLabel}>Display name</label>
                <input
                  type="text"
                  value={editPreferredName}
                  onChange={e => setEditPreferredName(e.target.value)}
                  placeholder={profile.full_name || 'Enter your name'}
                  style={inputStyle}
                />
                <p style={fieldHint}>This is how Meridian addresses you.</p>
              </div>

              {/* Biological profile */}
              <div style={{ marginBottom: '20px' }}>
                <label style={fieldLabel}>Biological profile</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['female', 'male'] as BiologicalProfile[]).map(bp => (
                    <button
                      key={bp}
                      type="button"
                      onClick={() => setEditBioProfile(bp)}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: '10px',
                        border: editBioProfile === bp ? '1px solid rgba(45,212,191,0.78)' : `1px solid ${colors.cardBorder}`,
                        background: editBioProfile === bp ? 'rgba(45,212,191,0.10)' : colors.inputBg,
                        color: editBioProfile === bp ? colors.teal : colors.textSoft,
                        fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                        fontFamily: fonts.ui, letterSpacing: '-0.01em',
                        transition: 'all 160ms ease',
                      }}
                    >
                      {BIO_MAP[bp]}
                    </button>
                  ))}
                </div>
                <p style={fieldHint}>Used for accurate reference ranges. Not your identity.</p>
              </div>

              <SaveFeedback status={saveStatus} />
              <EditActions onCancel={cancelEdit} onSave={saveIdentity} saving={saving} saveLabel="Save changes" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <IdentityRow label="Display name"      value={profile.preferred_name || profile.full_name || '—'} />
              <IdentityRow label="Email"             value={userEmail} />
              <IdentityRow label="Biological profile" value={profile.biological_profile ? BIO_MAP[profile.biological_profile] : '—'} />
              {profile.birth_date && (
                <IdentityRow label="Date of birth" value={profile.birth_date} />
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════ HEALTH FOCUS CARD ══ */}
        <div style={cardStyle}>
          <div style={cardHeaderRow}>
            <span style={cardLabel}>Health Focus</span>
            {editingSection !== 'focus' && (
              <SmallButton onClick={startEditFocus}>Adjust</SmallButton>
            )}
          </div>

          {editingSection === 'focus' ? (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: colors.textSoft, lineHeight: 1.6 }}>
                Your health focus shapes how Meridian interprets your results and prioritizes insights.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {ALL_GOALS.map(goal => {
                  const isSelected = editUserProfile === goal
                  const info = GOAL_MAP[goal]
                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => setEditUserProfile(goal)}
                      style={{
                        textAlign: 'left', padding: '12px 14px', borderRadius: '12px',
                        border: isSelected ? '1px solid rgba(45,212,191,0.75)' : `1px solid ${colors.cardBorder}`,
                        background: isSelected ? 'rgba(45,212,191,0.09)' : colors.inputBg,
                        cursor: 'pointer', fontFamily: fonts.ui,
                        transition: 'all 160ms ease',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: isSelected ? colors.teal : colors.text, marginBottom: '3px', letterSpacing: '-0.01em' }}>
                        {info.label}
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', color: isSelected ? '#9EEFE4' : colors.textMuted, lineHeight: 1.45 }}>
                        {info.description.slice(0, 72)}…
                      </span>
                    </button>
                  )
                })}
              </div>
              <SaveFeedback status={saveStatus} />
              <EditActions onCancel={cancelEdit} onSave={saveFocus} saving={saving} saveLabel="Save focus" disabled={!editUserProfile} />
            </div>
          ) : (
            <div>
              {profile.user_profile && GOAL_MAP[profile.user_profile] ? (
                <>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '5px 12px',
                    background: 'rgba(45,212,191,0.07)',
                    border: '1px solid rgba(45,212,191,0.2)',
                    borderRadius: '10px',
                    marginBottom: '12px',
                  }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.8)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: colors.teal, letterSpacing: '-0.01em' }}>
                      {GOAL_MAP[profile.user_profile].label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: colors.textSoft, lineHeight: 1.65 }}>
                    {GOAL_MAP[profile.user_profile].description}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted, lineHeight: 1.6 }}>
                  No health focus set. Tap Adjust to configure how Meridian personalizes your insights.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════ DATA SOURCES CARD ══ */}
        <div style={cardStyle}>
          <span style={{ ...cardLabel, display: 'block', marginBottom: '18px' }}>Connected Sources</span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SourceRow
              name="Lab Results"
              description="Blood panels, metabolic markers, CBC"
              status={hasLabs ? 'connected' : 'disconnected'}
            />
            <SourceRow
              name="Wearables"
              description="Continuous vitals, HRV, sleep data"
              status="soon"
            />
            <SourceRow
              name="Genetic Data"
              description="SNP analysis, pharmacogenomics"
              status="soon"
            />
          </div>
        </div>

        {/* ═══════════════════════════════════ ACCOUNT CARD ══ */}
        <div style={cardStyle}>
          <span style={{ ...cardLabel, display: 'block', marginBottom: '18px' }}>Account</span>

          <div>
            {/* App preferences — placeholder */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 0',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <span style={{ fontSize: '14px', color: colors.textMuted, fontWeight: 600 }}>App preferences</span>
              <span style={{
                fontSize: '10px', color: colors.textMuted, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                background: 'rgba(95,142,133,0.10)',
                border: '1px solid rgba(95,142,133,0.18)',
                borderRadius: '6px', padding: '2px 8px',
              }}>
                Soon
              </span>
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              style={{
                width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 0',
                background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: fonts.ui,
              }}
            >
              <span style={{ fontSize: '14px', color: '#F87171', fontWeight: 600 }}>Sign out</span>
              <span style={{ fontSize: '14px', color: colors.textMuted }}>›</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: '11px', color: colors.textMuted, marginTop: '12px', opacity: 0.4, letterSpacing: '0.04em' }}>
          Meridian · Health Intelligence System
        </p>

      </div>

      <NavBar />
    </div>
  )
}

// ═══════════════════════════════════════ SHARED STYLES ══

const cardStyle: React.CSSProperties = {
  background: colors.cardBg,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: '20px',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  padding: '22px',
  marginBottom: '10px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const cardHeaderRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: '18px',
}

const cardLabel: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  color: colors.textMuted,
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: colors.inputBg,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: '10px',
  padding: '11px 14px',
  color: colors.text,
  fontSize: '14px',
  fontFamily: fonts.ui,
  outline: 'none',
  colorScheme: 'dark',
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '11px', fontWeight: 700,
  color: colors.textMuted,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  marginBottom: '7px',
}

const fieldHint: React.CSSProperties = {
  margin: '5px 0 0',
  fontSize: '11px', color: colors.textMuted, lineHeight: 1.45,
}

// ═══════════════════════════════════════ SUB-COMPONENTS ══

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'rgba(45,212,191,0.07)',
        border: '1px solid rgba(45,212,191,0.20)',
        borderRadius: '8px',
        color: colors.teal,
        fontSize: '11px', fontWeight: 700,
        cursor: 'pointer',
        padding: '4px 11px',
        fontFamily: fonts.ui,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </button>
  )
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>
        {label}
      </span>
      <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: colors.text, letterSpacing: '-0.01em' }}>
        {value}
      </span>
    </div>
  )
}

function SourceRow({ name, description, status }: {
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'soon'
}) {
  const cfg = {
    connected:    { label: 'Connected',     color: '#2DD4BF', bg: 'rgba(45,212,191,0.08)',  border: 'rgba(45,212,191,0.22)',  dot: true  },
    disconnected: { label: 'Not connected', color: '#5F8E85', bg: 'rgba(95,142,133,0.07)',  border: 'rgba(95,142,133,0.18)', dot: false },
    soon:         { label: 'Coming soon',   color: '#5F8E85', bg: 'rgba(95,142,133,0.07)',  border: 'rgba(95,142,133,0.18)', dot: false },
  }[status]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px',
      background: 'rgba(232,248,245,0.025)',
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '12px', gap: '12px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: '2px' }}>{name}</span>
        <span style={{ display: 'block', fontSize: '11px', color: colors.textMuted, lineHeight: 1.4 }}>{description}</span>
      </div>
      <div style={{
        flexShrink: 0, padding: '3px 9px', borderRadius: '7px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', gap: '5px',
      }}>
        {cfg.dot && (
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.color, boxShadow: '0 0 5px rgba(45,212,191,0.8)' }} />
        )}
        <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

function SaveFeedback({ status }: { status: 'idle' | 'success' | 'error' }) {
  if (status === 'idle') return null
  return (
    <p style={{ margin: '0 0 12px', fontSize: '12px', lineHeight: 1.4, color: status === 'success' ? colors.teal : '#F87171' }}>
      {status === 'success' ? 'Saved.' : 'Something went wrong. Please try again.'}
    </p>
  )
}

function EditActions({ onCancel, onSave, saving, saveLabel, disabled }: {
  onCancel: () => void
  onSave: () => void
  saving: boolean
  saveLabel: string
  disabled?: boolean
}) {
  const inactive = saving || disabled
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        type="button"
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
        type="button"
        onClick={onSave}
        disabled={!!inactive}
        style={{
          flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
          background: inactive ? 'rgba(45,212,191,0.22)' : 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)',
          color: '#061316', fontSize: '13px', fontWeight: 700,
          cursor: inactive ? 'not-allowed' : 'pointer',
          fontFamily: fonts.ui,
          boxShadow: inactive ? 'none' : '0 0 18px rgba(45,212,191,0.28)',
        }}
      >
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  )
}
