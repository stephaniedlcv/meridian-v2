'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LandingExperience, BackgroundTheme, AmbientMode } from '@/types/experience'
import {
  BACKGROUND_THEME_OPTIONS, AMBIENT_MODE_OPTIONS,
  FALLBACK_CONFIG, THEME_BG, THEME_ORBS,
} from '@/types/experience'

const C = {
  bg:         '#061316',
  teal:       '#2DD4BF',
  text:       '#EAFBF7',
  textSoft:   '#9ACBC1',
  textMuted:  '#5F8E85',
  cardBg:     'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  error:      '#F87171',
  warn:       '#FCD34D',
}
const F = { heading: 'var(--font-fraunces), serif', ui: 'var(--font-plus-jakarta), "Plus Jakarta Sans", sans-serif' }

const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: F.ui, fontSize: '13px', color: C.text,
  backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${C.cardBorder}`,
  borderRadius: '8px', padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

// ── Primitives ─────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: F.ui, fontSize: '10px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.textMuted, marginBottom: '16px' }}>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <label style={{ fontFamily: F.ui, fontSize: '12px', fontWeight: 600, color: C.textSoft, flexShrink: 0 }}>
          {label}
        </label>
        {hint && (
          <span style={{ fontFamily: F.ui, fontSize: '11px', color: C.textMuted, fontStyle: 'italic' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Media upload field — URL input + file upload button ────────────
function MediaUploadField({
  label, hint, value, onChange, accept, fieldKey,
}: {
  label:    string
  hint?:    string
  value:    string | null
  onChange: (url: string | null) => void
  accept:   string
  fieldKey: string
}) {
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isImage = accept.includes('image')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `experience/${fieldKey}-${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('meridian-assets')
        .upload(path, file, { upsert: true })

      if (upErr) {
        const msg = upErr.message.includes('Bucket not found')
          ? 'Storage bucket "meridian-assets" not found — create a public bucket with that name in Supabase Dashboard → Storage.'
          : upErr.message
        setUploadError(msg)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('meridian-assets')
        .getPublicUrl(path)

      onChange(publicUrl)
    } catch {
      setUploadError('Upload failed — check storage bucket permissions and that you are logged in.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Field label={label} hint={hint}>
      {/* Manual URL input */}
      <input
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        placeholder="https://… or upload a file below"
        style={inputStyle}
      />

      {/* Upload row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            fontFamily: F.ui, fontSize: '11px', fontWeight: 600,
            color: uploading ? C.textMuted : C.textSoft,
            backgroundColor: 'rgba(103,232,249,0.06)',
            border: `1px solid ${C.cardBorder}`,
            borderRadius: '6px', padding: '5px 11px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {uploading ? 'Uploading…' : '↑ Upload file'}
        </button>

        {value && (
          <button
            onClick={() => { onChange(null); setUploadError(null) }}
            style={{
              fontFamily: F.ui, fontSize: '11px', color: C.textMuted,
              background: 'none', border: `1px solid ${C.cardBorder}`,
              borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}

        {/* Inline image thumbnail */}
        {value && isImage && (
          <div style={{ width: '30px', height: '30px', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${C.cardBorder}`, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* URL host pill */}
        {value && !isImage && (
          <span style={{ fontFamily: F.ui, fontSize: '10px', color: C.teal, backgroundColor: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.18)', borderRadius: '20px', padding: '2px 8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(() => { try { return new URL(value).hostname } catch { return value.slice(0, 30) } })()}
          </span>
        )}
      </div>

      {uploadError && (
        <p style={{ margin: '4px 0 0', fontFamily: F.ui, fontSize: '11px', color: C.error, lineHeight: 1.5 }}>
          {uploadError}
        </p>
      )}
    </Field>
  )
}

// ── Mini landing preview ───────────────────────────────────────────
function LandingPreview({ draft }: { draft: LandingExperience }) {
  const bg   = THEME_BG[draft.background_theme] ?? '#061316'
  const orbs = THEME_ORBS[draft.background_theme] ?? THEME_ORBS.deep_teal

  return (
    <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${C.cardBorder}`, aspectRatio: '16/9', backgroundColor: bg }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '55%', height: '80%', background: `radial-gradient(circle, ${orbs.primary} 0%, transparent 70%)`, filter: 'blur(28px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '55%', height: '80%', background: `radial-gradient(circle, ${orbs.secondary} 0%, transparent 70%)`, filter: 'blur(28px)', pointerEvents: 'none' }} />

      {draft.hero_video_url && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 7px', borderRadius: '20px', backgroundColor: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)', fontFamily: F.ui, fontSize: '9px', fontWeight: 700, color: C.teal, letterSpacing: '0.06em', zIndex: 2 }}>
          VIDEO
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '14px', zIndex: 1 }}>
        <div style={{ position: 'relative', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1px' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(103,232,249,0.12)' }} />
          <span style={{ fontFamily: F.heading, fontSize: '16px', fontWeight: 700, background: 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>M</span>
        </div>
        <div style={{ fontFamily: F.heading, fontSize: '11px', fontWeight: 700, color: C.text, letterSpacing: '-0.04em' }}>Meridian</div>
        <div style={{ fontFamily: F.ui, fontSize: '6px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textMuted }}>Biological Intelligence System</div>
        <div style={{ height: '6px' }} />
        <div style={{ fontFamily: F.heading, fontSize: '9px', fontWeight: 300, color: C.text, textAlign: 'center', letterSpacing: '-0.03em', maxWidth: '130px', lineHeight: 1.3 }}>
          {draft.headline || FALLBACK_CONFIG.headline}
        </div>
        <div style={{ fontFamily: F.ui, fontSize: '7px', color: C.textSoft, textAlign: 'center', maxWidth: '110px', lineHeight: 1.4 }}>
          {draft.subcopy || FALLBACK_CONFIG.subcopy}
        </div>
        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
          <div style={{ padding: '3px 8px', borderRadius: '4px', background: 'linear-gradient(135deg, #2DD4BF, #67E8F9)', fontFamily: F.ui, fontSize: '6px', fontWeight: 700, color: '#061316', whiteSpace: 'nowrap' }}>
            {draft.primary_cta_label || 'Get Started'}
          </div>
          <div style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(232,248,245,0.06)', border: '1px solid rgba(103,232,249,0.2)', fontFamily: F.ui, fontSize: '6px', fontWeight: 600, color: C.textSoft, whiteSpace: 'nowrap' }}>
            {draft.secondary_cta_label || 'Log In'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Version card ───────────────────────────────────────────────────
function VersionCard({
  config, onActivate, onDelete, activating, deleting,
}: {
  config:     LandingExperience
  onActivate: () => void
  onDelete:   () => void
  activating: boolean
  deleting:   boolean
}) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: '10px', backgroundColor: C.cardBg,
      border: `1px solid ${config.is_active ? 'rgba(45,212,191,0.25)' : C.cardBorder}`,
      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px', flexWrap: 'wrap' }}>
          {config.is_active && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 7px', borderRadius: '20px', backgroundColor: 'rgba(45,212,191,0.10)', border: '1px solid rgba(45,212,191,0.22)', fontSize: '9px', fontFamily: F.ui, fontWeight: 700, color: C.teal, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: C.teal, boxShadow: '0 0 4px rgba(45,212,191,0.8)' }} />
              Live
            </span>
          )}
          <span style={{ fontFamily: F.ui, fontSize: '12px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {config.headline}
          </span>
        </div>
        <div style={{ fontFamily: F.ui, fontSize: '11px', color: C.textMuted }}>
          {config.background_theme} · {config.ambient_mode}
          {config.hero_video_url ? ' · video' : ''}
          <span style={{ marginLeft: '8px', opacity: 0.7 }}>
            {config.created_at ? new Date(config.created_at).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>
      {!config.is_active && (
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={onActivate}
            disabled={activating}
            style={{ fontFamily: F.ui, fontSize: '11px', fontWeight: 700, color: '#061316', backgroundColor: activating ? 'rgba(45,212,191,0.5)' : C.teal, border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: activating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', minHeight: '36px', touchAction: 'manipulation' }}
          >
            {activating ? 'Activating…' : 'Set Live'}
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            style={{ fontFamily: F.ui, fontSize: '11px', color: C.textMuted, background: 'none', border: `1px solid ${C.cardBorder}`, borderRadius: '6px', padding: '6px 10px', cursor: deleting ? 'not-allowed' : 'pointer', minHeight: '36px', touchAction: 'manipulation' }}
          >
            {deleting ? '…' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function AdminExperiencePage() {
  const [configs,    setConfigs]    = useState<LandingExperience[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState<string | null>(null)
  const [tableReady, setTableReady] = useState<boolean | null>(null) // null = unknown
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const [saved,      setSaved]      = useState(false)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [draft,      setDraft]      = useState<LandingExperience>(FALLBACK_CONFIG)
  const [isNarrow,   setIsNarrow]   = useState(false)

  // Responsive layout detection
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/experience')
      const data = await res.json() as {
        configs?: LandingExperience[]
        error?: string
        tableReady?: boolean
      }

      if (!res.ok) {
        setLoadError(data.error ?? `Server error (${res.status})`)
        setTableReady(false)
        return
      }

      const list = data.configs ?? []
      setConfigs(list)
      setTableReady(data.tableReady ?? list.length > 0)

      // Seed draft from active config or first config or fallback
      const active = list.find(c => c.is_active) ?? list[0]
      if (active) setDraft({ ...active })
    } catch {
      setLoadError('Network error — could not reach the API.')
    } finally {
      setLoading(false)
    }
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
        // First-time: create and immediately activate
        const res  = await fetch('/api/admin/experience', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        })
        const data = await res.json() as { config?: LandingExperience; error?: string }
        if (!res.ok) { setSaveError(data.error ?? 'Failed to create configuration'); return }

        // Activate the newly created config
        const patchRes = await fetch('/api/admin/experience', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.config!.id, activate: true }),
        })
        if (!patchRes.ok) {
          const pd = await patchRes.json() as { error?: string }
          setSaveError(pd.error ?? 'Created but failed to activate')
          return
        }
      } else {
        // Update existing
        const res = await fetch('/api/admin/experience', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...draft, id: draft.id }),
        })
        const data = await res.json() as { error?: string }
        if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return }
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await load()
    } catch {
      setSaveError('Network error — changes not saved')
    } finally {
      setSaving(false)
    }
  }

  async function activateVersion(id: string) {
    setActivating(id)
    try {
      const res = await fetch('/api/admin/experience', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activate: true }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setSaveError(d.error ?? 'Failed to activate')
      } else {
        await load()
      }
    } finally { setActivating(null) }
  }

  async function deleteVersion(id: string) {
    setDeleting(id)
    try {
      const res = await fetch('/api/admin/experience', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setSaveError(d.error ?? 'Failed to delete')
      } else {
        await load()
      }
    } finally { setDeleting(null) }
  }

  async function duplicateActive() {
    const active = configs.find(c => c.is_active)
    if (!active) return
    const { id: _id, is_active: _ia, created_at: _ca, updated_at: _ua, ...fields } = active
    const res = await fetch('/api/admin/experience', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setSaveError(d.error ?? 'Failed to duplicate')
    } else {
      await load()
    }
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

  // ── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '32px 24px', fontFamily: F.ui, fontSize: '13px', color: C.textMuted }}>
        Loading…
      </div>
    )
  }

  // ── Persistent banners ─────────────────────────────────────────────
  const migrationBanner = tableReady === false && (
    <div style={{
      marginBottom: '20px', padding: '14px 18px',
      backgroundColor: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.20)',
      borderRadius: '10px', fontFamily: F.ui, fontSize: '12px', color: C.warn, lineHeight: 1.6,
    }}>
      <strong style={{ display: 'block', marginBottom: '4px' }}>
        SQL migration required
      </strong>
      The <code style={{ fontFamily: 'monospace', backgroundColor: 'rgba(252,211,77,0.10)', padding: '1px 5px', borderRadius: '4px' }}>landing_experience</code> table does not exist yet.{' '}
      Run <strong>src/db/migrations/landing_experience.sql</strong> in Supabase SQL Editor, then refresh this page.
      <br />
      You can still edit the form — changes will save once the migration is applied.
    </div>
  )

  const loadErrorBanner = loadError && (
    <div style={{ marginBottom: '20px', padding: '10px 14px', backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.20)', borderRadius: '8px', fontFamily: F.ui, fontSize: '12px', color: C.error, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <span>{loadError}</span>
      <button onClick={load} style={{ background: 'none', border: `1px solid ${C.cardBorder}`, borderRadius: '6px', color: C.textSoft, fontFamily: F.ui, fontSize: '11px', padding: '4px 10px', cursor: 'pointer' }}>Retry</button>
    </div>
  )

  const saveErrorBanner = saveError && (
    <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.20)', borderRadius: '8px', fontFamily: F.ui, fontSize: '12px', color: C.error, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{saveError}</span>
      <button onClick={() => setSaveError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.error, fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>×</button>
    </div>
  )

  return (
    <div style={{ padding: isNarrow ? '20px 16px' : '32px 36px', maxWidth: '940px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: F.heading, fontSize: isNarrow ? '22px' : '26px', fontWeight: 700, color: C.text, margin: 0, marginBottom: '5px' }}>
            Experience Manager
          </h1>
          <p style={{ fontFamily: F.ui, fontSize: '13px', color: C.textMuted, margin: 0 }}>
            Messaging · media · atmosphere — no code changes needed.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.open('/', '_blank')}
            style={{ fontFamily: F.ui, fontSize: '13px', fontWeight: 600, color: C.textSoft, backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: '10px', padding: '11px 16px', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: '44px', touchAction: 'manipulation' }}
          >
            Preview →
          </button>
          <button
            onClick={saveChanges}
            disabled={saving || !draftChanged}
            style={{ fontFamily: F.ui, fontSize: '13px', fontWeight: 700, color: saved ? C.teal : '#061316', backgroundColor: saved ? 'rgba(45,212,191,0.12)' : saving || !draftChanged ? 'rgba(45,212,191,0.35)' : C.teal, border: saved ? '1px solid rgba(45,212,191,0.3)' : 'none', borderRadius: '10px', padding: '11px 20px', cursor: saving || !draftChanged ? 'not-allowed' : 'pointer', boxShadow: saved || !draftChanged ? 'none' : '0 0 18px rgba(45,212,191,0.25)', whiteSpace: 'nowrap', minHeight: '44px', touchAction: 'manipulation', transition: 'all 0.2s ease' }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {migrationBanner}
      {loadErrorBanner}
      {saveErrorBanner}

      {/* ── Main layout: form + sidebar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr' : '1fr 308px',
        gap: '20px',
        alignItems: 'start',
      }}>

        {/* ── Left: form sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Status chip — on mobile comes first above the form */}
          {isNarrow && <StatusChip draftChanged={draftChanged} configs={configs} />}

          {/* Content */}
          <FormCard>
            <SectionLabel>Content</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field label="Headline" hint="positioning statement — shown large below the wordmark">
                <textarea
                  value={draft.headline}
                  onChange={e => updateDraft('headline', e.target.value)}
                  placeholder="Understand your biology, in full context."
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </Field>

              <Field label="Subcopy" hint="calm supporting sentence below the headline">
                <textarea
                  value={draft.subcopy}
                  onChange={e => updateDraft('subcopy', e.target.value)}
                  placeholder="A calmer, more intelligent way to understand what your body is adapting to."
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
          </FormCard>

          {/* Media */}
          <FormCard>
            <SectionLabel>Media</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <MediaUploadField
                label="Hero Video"
                hint="autoplay · muted · loop — leave empty for ambient orbs"
                value={draft.hero_video_url}
                onChange={v => updateDraft('hero_video_url', v)}
                accept="video/mp4,video/webm,video/ogg"
                fieldKey="hero-video"
              />
              <MediaUploadField
                label="Mobile Video"
                hint="optional — smaller file served on narrow viewports"
                value={draft.mobile_video_url}
                onChange={v => updateDraft('mobile_video_url', v)}
                accept="video/mp4,video/webm"
                fieldKey="mobile-video"
              />
              <MediaUploadField
                label="Poster / Fallback Image"
                hint="shown while video loads or if autoplay is blocked"
                value={draft.poster_image_url}
                onChange={v => updateDraft('poster_image_url', v)}
                accept="image/jpeg,image/png,image/webp"
                fieldKey="poster"
              />
              <MediaUploadField
                label="Logo Variant"
                hint="custom M asset — leave empty for default gradient glyph"
                value={draft.logo_variant_url}
                onChange={v => updateDraft('logo_variant_url', v)}
                accept="image/svg+xml,image/png,image/webp"
                fieldKey="logo"
              />

              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(103,232,249,0.04)', border: `1px solid ${C.cardBorder}`, fontFamily: F.ui, fontSize: '11px', color: C.textMuted, lineHeight: 1.6 }}>
                <strong style={{ color: C.textSoft }}>Uploads</strong> go to the <code style={{ fontFamily: 'monospace', backgroundColor: 'rgba(103,232,249,0.08)', padding: '1px 4px', borderRadius: '3px' }}>meridian-assets</code> Supabase Storage bucket.
                Create a <strong>public</strong> bucket with that name in Supabase Dashboard → Storage if uploads fail.
              </div>
            </div>
          </FormCard>

          {/* Atmosphere */}
          <FormCard>
            <SectionLabel>Atmosphere</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Background Theme">
                  <select value={draft.background_theme} onChange={e => updateDraft('background_theme', e.target.value as BackgroundTheme)} style={selectStyle}>
                    {BACKGROUND_THEME_OPTIONS.map(o => (
                      <option key={o.value} value={o.value} style={{ backgroundColor: '#061316' }}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Ambient Mode" hint="orb intensity">
                  <select value={draft.ambient_mode} onChange={e => updateDraft('ambient_mode', e.target.value as AmbientMode)} style={selectStyle}>
                    {AMBIENT_MODE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value} style={{ backgroundColor: '#061316' }}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field
                label="Video Overlay Opacity"
                hint={`${Math.round(draft.overlay_opacity * 100)}% — darkens video for text legibility`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={draft.overlay_opacity}
                    onChange={e => updateDraft('overlay_opacity', parseFloat(e.target.value))}
                    disabled={!draft.hero_video_url}
                    style={{ flex: 1, accentColor: C.teal, cursor: draft.hero_video_url ? 'pointer' : 'not-allowed', opacity: draft.hero_video_url ? 1 : 0.35 }}
                  />
                  <span style={{ fontFamily: F.ui, fontSize: '12px', fontWeight: 600, color: C.textSoft, minWidth: '36px', textAlign: 'right' }}>
                    {Math.round(draft.overlay_opacity * 100)}%
                  </span>
                </div>
                {!draft.hero_video_url && (
                  <p style={{ margin: '2px 0 0', fontFamily: F.ui, fontSize: '11px', color: C.textMuted, fontStyle: 'italic' }}>
                    Set a hero video to enable this control
                  </p>
                )}
              </Field>
            </div>
          </FormCard>
        </div>

        {/* ── Right sidebar: status + preview ── */}
        {!isNarrow && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', position: 'sticky', top: '24px' }}>
            <StatusChip draftChanged={draftChanged} configs={configs} />

            <div>
              <div style={{ fontFamily: F.ui, fontSize: '10px', fontWeight: 600, color: C.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Preview
              </div>
              <LandingPreview draft={draft} />
              <p style={{ fontFamily: F.ui, fontSize: '10px', color: C.textMuted, margin: '6px 0 0', textAlign: 'center', opacity: 0.65 }}>
                Approximate · video not shown
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Preview below form on mobile */}
      {isNarrow && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontFamily: F.ui, fontSize: '10px', fontWeight: 600, color: C.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Preview
          </div>
          <LandingPreview draft={draft} />
          <p style={{ fontFamily: F.ui, fontSize: '10px', color: C.textMuted, margin: '6px 0 0', textAlign: 'center', opacity: 0.65 }}>
            Approximate · video not shown
          </p>
        </div>
      )}

      {/* ── Version history ── */}
      {configs.length > 1 && (
        <div style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontFamily: F.ui, fontSize: '10px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.textMuted }}>
              Versions ({configs.length})
            </div>
            <button onClick={duplicateActive} style={{ fontFamily: F.ui, fontSize: '11px', fontWeight: 600, color: C.textSoft, background: 'none', border: `1px solid ${C.cardBorder}`, borderRadius: '7px', padding: '5px 12px', cursor: 'pointer', touchAction: 'manipulation' }}>
              + Duplicate active
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
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

      {/* First-time setup — empty DB state */}
      {configs.length === 0 && !loadError && (
        <div style={{ marginTop: '20px', padding: '18px 20px', borderRadius: '12px', backgroundColor: 'rgba(45,212,191,0.04)', border: '1px solid rgba(45,212,191,0.14)', fontFamily: F.ui, fontSize: '13px', color: C.textSoft, lineHeight: 1.65 }}>
          <strong style={{ display: 'block', color: C.text, marginBottom: '6px' }}>
            No configurations yet
          </strong>
          Edit the form above and click <strong>Save Changes</strong> to create your first live configuration.
          The landing page uses built-in defaults until a configuration is saved.
        </div>
      )}
    </div>
  )
}

// ── Shared status chip ─────────────────────────────────────────────
function StatusChip({
  draftChanged, configs,
}: { draftChanged: boolean; configs: LandingExperience[] }) {
  const active    = configs.find(c => c.is_active)
  const lastSaved = active?.updated_at

  return (
    <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: draftChanged ? '#FCD34D' : C.teal, boxShadow: draftChanged ? '0 0 6px rgba(252,211,77,0.7)' : '0 0 6px rgba(45,212,191,0.7)', flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: F.ui, fontSize: '12px', fontWeight: 700, color: C.text }}>
          {draftChanged ? 'Unsaved changes' : 'Live'}
        </div>
        <div style={{ fontFamily: F.ui, fontSize: '10px', color: C.textMuted, marginTop: '1px' }}>
          {draftChanged
            ? 'Save to publish to landing page'
            : lastSaved
              ? `Updated ${new Date(lastSaved).toLocaleString()}`
              : 'No saved configuration yet'
          }
        </div>
      </div>
    </div>
  )
}

// ── Card wrapper ───────────────────────────────────────────────────
function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: '16px', padding: '22px 20px' }}>
      {children}
    </div>
  )
}
