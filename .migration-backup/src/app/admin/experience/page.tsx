'use client'

import { useState, useEffect, useCallback } from 'react'
import type { LandingExperience, BackgroundTheme, AmbientMode } from '@/types/experience'
import {
  BACKGROUND_THEME_OPTIONS, AMBIENT_MODE_OPTIONS,
  FALLBACK_CONFIG, THEME_BG, THEME_ORBS,
} from '@/types/experience'

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

// ── Section label ─────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily:    fonts.ui,
      fontSize:      '10px',
      fontWeight:    700,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      color:         colors.textMuted,
      marginBottom:  '16px',
    }}>
      {children}
    </div>
  )
}

// ── Field row ─────────────────────────────────────────────────────
function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <label style={{
          fontFamily:  fonts.ui,
          fontSize:    '12px',
          fontWeight:  600,
          color:       colors.textSoft,
          flexShrink:  0,
        }}>
          {label}
        </label>
        {hint && (
          <span style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted, fontStyle: 'italic' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

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

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

// ── Mini landing preview ──────────────────────────────────────────
function LandingPreview({ draft }: { draft: LandingExperience }) {
  const bg    = THEME_BG[draft.background_theme] ?? '#061316'
  const orbs  = THEME_ORBS[draft.background_theme] ?? THEME_ORBS.deep_teal
  const hasVideo = !!draft.hero_video_url

  return (
    <div style={{
      position:    'relative',
      borderRadius:'14px',
      overflow:    'hidden',
      border:      `1px solid ${colors.cardBorder}`,
      aspectRatio: '16/9',
      backgroundColor: bg,
    }}>
      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '55%', height: '80%', background: `radial-gradient(circle, ${orbs.primary} 0%, transparent 70%)`, filter: 'blur(30px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '55%', height: '80%', background: `radial-gradient(circle, ${orbs.secondary} 0%, transparent 70%)`, filter: 'blur(30px)', pointerEvents: 'none' }} />

      {/* Video indicator */}
      {hasVideo && (
        <div style={{
          position:        'absolute',
          top:             '8px',
          right:           '8px',
          padding:         '3px 7px',
          borderRadius:    '20px',
          backgroundColor: 'rgba(45,212,191,0.12)',
          border:          '1px solid rgba(45,212,191,0.25)',
          fontFamily:      fonts.ui,
          fontSize:        '9px',
          fontWeight:      700,
          color:           colors.teal,
          letterSpacing:   '0.06em',
          zIndex:          2,
        }}>
          VIDEO
        </div>
      )}

      {/* Content preview */}
      <div style={{
        position:       'absolute',
        inset:          0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '6px',
        padding:        '16px',
        zIndex:         1,
      }}>
        {/* Logo halo */}
        <div style={{
          position:       'relative',
          width:          '38px',
          height:         '38px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          marginBottom:   '2px',
        }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(103,232,249,0.12)' }} />
          <span style={{
            fontFamily:           fonts.heading,
            fontSize:             '18px',
            fontWeight:           700,
            background:           'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor:  'transparent',
          }}>M</span>
        </div>

        <div style={{
          fontFamily:    fonts.heading,
          fontSize:      '13px',
          fontWeight:    700,
          color:         colors.text,
          letterSpacing: '-0.04em',
        }}>
          {draft.headline || 'Meridian'}
        </div>

        <div style={{
          fontSize:      '7px',
          fontWeight:    700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:         colors.textMuted,
        }}>
          {draft.subcopy || 'Biological Intelligence System'}
        </div>

        <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
          <div style={{
            padding:         '4px 10px',
            borderRadius:    '5px',
            background:      'linear-gradient(135deg, #2DD4BF, #67E8F9)',
            fontFamily:      fonts.ui,
            fontSize:        '7px',
            fontWeight:      700,
            color:           '#061316',
            whiteSpace:      'nowrap',
          }}>
            {draft.primary_cta_label || 'Get Started'}
          </div>
          <div style={{
            padding:         '4px 10px',
            borderRadius:    '5px',
            background:      'rgba(232,248,245,0.06)',
            border:          '1px solid rgba(103,232,249,0.2)',
            fontFamily:      fonts.ui,
            fontSize:        '7px',
            fontWeight:      600,
            color:           colors.textSoft,
            whiteSpace:      'nowrap',
          }}>
            {draft.secondary_cta_label || 'Log In'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Version card ──────────────────────────────────────────────────
function VersionCard({
  config, onActivate, onDelete, activating, deleting,
}: {
  config:    LandingExperience
  onActivate: () => void
  onDelete:   () => void
  activating: boolean
  deleting:   boolean
}) {
  return (
    <div style={{
      padding:         '14px 16px',
      borderRadius:    '10px',
      backgroundColor: colors.cardBg,
      border:          `1px solid ${config.is_active ? 'rgba(45,212,191,0.25)' : colors.cardBorder}`,
      display:         'flex',
      alignItems:      'center',
      gap:             '12px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          {config.is_active && (
            <span style={{
              display:         'inline-flex',
              alignItems:      'center',
              gap:             '4px',
              padding:         '1px 7px',
              borderRadius:    '20px',
              backgroundColor: 'rgba(45,212,191,0.10)',
              border:          '1px solid rgba(45,212,191,0.22)',
              fontSize:        '9px',
              fontFamily:      fonts.ui,
              fontWeight:      700,
              color:           colors.teal,
              letterSpacing:   '0.06em',
              textTransform:   'uppercase',
              flexShrink:      0,
            }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: colors.teal, boxShadow: '0 0 4px rgba(45,212,191,0.8)' }} />
              Live
            </span>
          )}
          <span style={{ fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {config.headline}
          </span>
        </div>
        <div style={{ fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted }}>
          {config.background_theme} · {config.ambient_mode} · {config.primary_cta_label} / {config.secondary_cta_label}
          {config.hero_video_url && ' · video'}
          <span style={{ marginLeft: '8px', opacity: 0.7 }}>
            {new Date(config.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {!config.is_active && (
          <>
            <button
              onClick={onActivate}
              disabled={activating}
              style={{
                fontFamily:      fonts.ui,
                fontSize:        '11px',
                fontWeight:      700,
                color:           '#061316',
                backgroundColor: activating ? 'rgba(45,212,191,0.5)' : colors.teal,
                border:          'none',
                borderRadius:    '6px',
                padding:         '6px 12px',
                cursor:          activating ? 'not-allowed' : 'pointer',
                touchAction:     'manipulation',
                whiteSpace:      'nowrap',
              }}
            >
              {activating ? 'Activating…' : 'Set Live'}
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{
                fontFamily:  fonts.ui,
                fontSize:    '11px',
                color:       colors.textMuted,
                background:  'none',
                border:      `1px solid ${colors.cardBorder}`,
                borderRadius:'6px',
                padding:     '6px 10px',
                cursor:      deleting ? 'not-allowed' : 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {deleting ? '…' : 'Delete'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function AdminExperiencePage() {
  const [configs,   setConfigs]   = useState<LandingExperience[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved,     setSaved]     = useState(false)

  const [activating, setActivating] = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)

  // Local draft — derived from active config, edited in-place
  const [draft, setDraft] = useState<LandingExperience>(FALLBACK_CONFIG)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/experience')
      const data = await res.json() as { configs: LandingExperience[] }
      const list = data.configs ?? []
      setConfigs(list)
      const active = list.find(c => c.is_active) ?? list[0] ?? FALLBACK_CONFIG
      setDraft({ ...active })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function updateDraft<K extends keyof LandingExperience>(key: K, value: LandingExperience[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
    setSaved(false)
    setSaveError(null)
  }

  async function saveChanges() {
    setSaving(true)
    setSaveError(null)
    try {
      const isNew = draft.id === 'fallback' || !configs.find(c => c.id === draft.id)

      if (isNew) {
        // Create new config (activated immediately)
        const res  = await fetch('/api/admin/experience', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(draft),
        })
        const data = await res.json()
        if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return }
        // Activate it
        await fetch('/api/admin/experience', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ id: data.config.id, activate: true }),
        })
      } else {
        // Update existing active config
        const res = await fetch('/api/admin/experience', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ...draft, id: draft.id }),
        })
        const data = await res.json()
        if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return }
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await load()
    } catch {
      setSaveError('Network error — changes not saved')
    } finally { setSaving(false) }
  }

  async function activateVersion(id: string) {
    setActivating(id)
    try {
      const res = await fetch('/api/admin/experience', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, activate: true }),
      })
      if (!res.ok) return
      await load()
    } finally { setActivating(null) }
  }

  async function deleteVersion(id: string) {
    setDeleting(id)
    try {
      const res = await fetch('/api/admin/experience', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      })
      if (!res.ok) return
      await load()
    } finally { setDeleting(null) }
  }

  async function duplicateActive() {
    const active = configs.find(c => c.is_active)
    if (!active) return
    const { id: _id, is_active: _ia, created_at: _ca, updated_at: _ua, ...fields } = active
    await fetch('/api/admin/experience', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    })
    await load()
  }

  if (loading) {
    return (
      <div style={{ padding: '32px 36px', fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted }}>
        Loading…
      </div>
    )
  }

  const draftChanged = (() => {
    const active = configs.find(c => c.is_active)
    if (!active) return true
    const fields: (keyof LandingExperience)[] = [
      'hero_video_url', 'mobile_video_url', 'poster_image_url',
      'headline', 'subcopy', 'primary_cta_label', 'secondary_cta_label',
      'logo_variant_url', 'background_theme', 'overlay_opacity', 'ambient_mode',
    ]
    return fields.some(f => draft[f] !== active[f])
  })()

  return (
    <div style={{ padding: '32px 36px', maxWidth: '920px' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, margin: 0, marginBottom: '6px' }}>
            Experience Manager
          </h1>
          <p style={{ fontFamily: fonts.ui, fontSize: '13px', color: colors.textMuted, margin: 0 }}>
            Control the landing page — messaging, media, atmosphere — without touching code.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={() => window.open('/', '_blank')}
            style={{
              fontFamily:      fonts.ui,
              fontSize:        '13px',
              fontWeight:      600,
              color:           colors.textSoft,
              backgroundColor: colors.cardBg,
              border:          `1px solid ${colors.cardBorder}`,
              borderRadius:    '10px',
              padding:         '11px 18px',
              cursor:          'pointer',
              touchAction:     'manipulation',
              whiteSpace:      'nowrap',
              minHeight:       '44px',
            }}
          >
            Preview Live →
          </button>
          <button
            onClick={saveChanges}
            disabled={saving || !draftChanged}
            style={{
              fontFamily:      fonts.ui,
              fontSize:        '13px',
              fontWeight:      700,
              color:           saved ? colors.teal : '#061316',
              backgroundColor: saved
                ? 'rgba(45,212,191,0.12)'
                : saving || !draftChanged
                  ? 'rgba(45,212,191,0.35)'
                  : colors.teal,
              border:          saved ? `1px solid rgba(45,212,191,0.3)` : 'none',
              borderRadius:    '10px',
              padding:         '11px 22px',
              cursor:          saving || !draftChanged ? 'not-allowed' : 'pointer',
              touchAction:     'manipulation',
              boxShadow:       saved || !draftChanged ? 'none' : '0 0 20px rgba(45,212,191,0.25)',
              whiteSpace:      'nowrap',
              minHeight:       '44px',
              transition:      'all 0.2s ease',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div style={{
          marginBottom:    '20px',
          padding:         '10px 14px',
          backgroundColor: 'rgba(248,113,113,0.07)',
          border:          '1px solid rgba(248,113,113,0.2)',
          borderRadius:    '8px',
          fontFamily:      fonts.ui,
          fontSize:        '12px',
          color:           '#F87171',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
        }}>
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>

        {/* ── Left: form ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Content section */}
          <div style={{
            backgroundColor: colors.cardBg,
            border:          `1px solid ${colors.cardBorder}`,
            borderRadius:    '16px',
            padding:         '24px',
          }}>
            <SectionLabel>Content</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              <Field label="Headline">
                <input
                  value={draft.headline}
                  onChange={e => updateDraft('headline', e.target.value)}
                  placeholder="Meridian"
                  style={inputStyle}
                />
              </Field>

              <Field label="Subcopy" hint="shown below headline">
                <input
                  value={draft.subcopy}
                  onChange={e => updateDraft('subcopy', e.target.value)}
                  placeholder="Biological Intelligence System"
                  style={inputStyle}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Field label="Primary CTA">
                  <input
                    value={draft.primary_cta_label}
                    onChange={e => updateDraft('primary_cta_label', e.target.value)}
                    placeholder="Get Started"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Secondary CTA">
                  <input
                    value={draft.secondary_cta_label}
                    onChange={e => updateDraft('secondary_cta_label', e.target.value)}
                    placeholder="Log In"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Media section */}
          <div style={{
            backgroundColor: colors.cardBg,
            border:          `1px solid ${colors.cardBorder}`,
            borderRadius:    '16px',
            padding:         '24px',
          }}>
            <SectionLabel>Media</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              <Field label="Hero Video URL" hint="autoplay · muted · loop · leave empty for ambient orbs">
                <input
                  value={draft.hero_video_url ?? ''}
                  onChange={e => updateDraft('hero_video_url', e.target.value || null)}
                  placeholder="https://…/hero.mp4"
                  style={inputStyle}
                />
              </Field>

              <Field label="Mobile Video URL" hint="optional — smaller file for mobile">
                <input
                  value={draft.mobile_video_url ?? ''}
                  onChange={e => updateDraft('mobile_video_url', e.target.value || null)}
                  placeholder="https://…/hero-mobile.mp4"
                  style={inputStyle}
                />
              </Field>

              <Field label="Poster / Fallback Image" hint="shown while video loads or if autoplay blocked">
                <input
                  value={draft.poster_image_url ?? ''}
                  onChange={e => updateDraft('poster_image_url', e.target.value || null)}
                  placeholder="https://…/poster.jpg"
                  style={inputStyle}
                />
              </Field>

              <Field label="Logo Variant URL" hint="custom M asset — leave empty for default glyph">
                <input
                  value={draft.logo_variant_url ?? ''}
                  onChange={e => updateDraft('logo_variant_url', e.target.value || null)}
                  placeholder="https://…/logo.svg"
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          {/* Atmosphere section */}
          <div style={{
            backgroundColor: colors.cardBg,
            border:          `1px solid ${colors.cardBorder}`,
            borderRadius:    '16px',
            padding:         '24px',
          }}>
            <SectionLabel>Atmosphere</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Field label="Background Theme">
                  <select
                    value={draft.background_theme}
                    onChange={e => updateDraft('background_theme', e.target.value as BackgroundTheme)}
                    style={selectStyle}
                  >
                    {BACKGROUND_THEME_OPTIONS.map(o => (
                      <option key={o.value} value={o.value} style={{ backgroundColor: '#061316' }}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ambient Mode" hint="orb intensity">
                  <select
                    value={draft.ambient_mode}
                    onChange={e => updateDraft('ambient_mode', e.target.value as AmbientMode)}
                    style={selectStyle}
                  >
                    {AMBIENT_MODE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value} style={{ backgroundColor: '#061316' }}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field
                label="Video Overlay Opacity"
                hint={`${Math.round(draft.overlay_opacity * 100)}% — darkens the video for text legibility`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={draft.overlay_opacity}
                    onChange={e => updateDraft('overlay_opacity', parseFloat(e.target.value))}
                    disabled={!draft.hero_video_url}
                    style={{
                      flex:       1,
                      accentColor: colors.teal,
                      cursor:     draft.hero_video_url ? 'pointer' : 'not-allowed',
                      opacity:    draft.hero_video_url ? 1 : 0.35,
                    }}
                  />
                  <span style={{ fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600, color: colors.textSoft, minWidth: '36px', textAlign: 'right' }}>
                    {Math.round(draft.overlay_opacity * 100)}%
                  </span>
                </div>
                {!draft.hero_video_url && (
                  <p style={{ margin: 0, fontFamily: fonts.ui, fontSize: '11px', color: colors.textMuted, fontStyle: 'italic' }}>
                    Set a hero video URL to enable this control
                  </p>
                )}
              </Field>
            </div>
          </div>
        </div>

        {/* ── Right: preview + status ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '24px' }}>

          {/* Status chip */}
          <div style={{
            padding:         '12px 16px',
            borderRadius:    '12px',
            backgroundColor: colors.cardBg,
            border:          `1px solid ${colors.cardBorder}`,
            display:         'flex',
            alignItems:      'center',
            gap:             '10px',
          }}>
            <div style={{
              width:        '8px',
              height:       '8px',
              borderRadius: '50%',
              backgroundColor: draftChanged ? '#FCD34D' : colors.teal,
              boxShadow:    draftChanged ? '0 0 6px rgba(252,211,77,0.7)' : '0 0 6px rgba(45,212,191,0.7)',
              flexShrink:   0,
            }} />
            <div>
              <div style={{ fontFamily: fonts.ui, fontSize: '12px', fontWeight: 700, color: colors.text }}>
                {draftChanged ? 'Unsaved changes' : 'Live'}
              </div>
              <div style={{ fontFamily: fonts.ui, fontSize: '10px', color: colors.textMuted, marginTop: '1px' }}>
                {draftChanged
                  ? 'Save to publish to landing page'
                  : `Last saved ${configs.find(c => c.is_active)?.updated_at
                      ? new Date(configs.find(c => c.is_active)!.updated_at).toLocaleString()
                      : '—'}`
                }
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div>
            <div style={{ fontFamily: fonts.ui, fontSize: '11px', fontWeight: 600, color: colors.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Preview
            </div>
            <LandingPreview draft={draft} />
            <p style={{ fontFamily: fonts.ui, fontSize: '10px', color: colors.textMuted, margin: '8px 0 0', textAlign: 'center', opacity: 0.7 }}>
              Approximate preview — video not shown
            </p>
          </div>
        </div>
      </div>

      {/* ── Version history ── */}
      {configs.length > 1 && (
        <div style={{ marginTop: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ fontFamily: fonts.ui, fontSize: '10px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: colors.textMuted }}>
              Versions ({configs.length})
            </div>
            <button
              onClick={duplicateActive}
              style={{
                fontFamily:  fonts.ui,
                fontSize:    '11px',
                fontWeight:  600,
                color:       colors.textSoft,
                background:  'none',
                border:      `1px solid ${colors.cardBorder}`,
                borderRadius:'7px',
                padding:     '5px 12px',
                cursor:      'pointer',
                touchAction: 'manipulation',
              }}
            >
              + Duplicate active
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {configs.map(c => (
              <VersionCard
                key={c.id}
                config={c}
                onActivate={() => activateVersion(c.id)}
                onDelete={()   => deleteVersion(c.id)}
                activating={activating === c.id}
                deleting={deleting     === c.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* First-time setup: no configs in DB */}
      {configs.length === 0 && (
        <div style={{
          marginTop:   '24px',
          padding:     '20px',
          borderRadius:'12px',
          backgroundColor: 'rgba(252,211,77,0.04)',
          border:      '1px solid rgba(252,211,77,0.15)',
          fontFamily:  fonts.ui,
          fontSize:    '13px',
          color:       '#FCD34D',
          lineHeight:  1.6,
        }}>
          <strong>First-time setup:</strong> No configurations exist in the database yet.
          Fill in the form above and click <strong>Save Changes</strong> to create the first live configuration.
          <br />
          <span style={{ fontSize: '11px', color: colors.textMuted, fontStyle: 'italic' }}>
            Make sure you've run the <code>landing_experience</code> SQL migration first.
          </span>
        </div>
      )}
    </div>
  )
}
