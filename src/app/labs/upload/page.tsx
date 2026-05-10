'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  optimal: 'rgba(45,212,191,0.15)',
  optimalBorder: 'rgba(45,212,191,0.6)',
  watch: 'rgba(250,204,21,0.15)',
  watchBorder: 'rgba(250,204,21,0.6)',
  attention: 'rgba(251,146,60,0.15)',
  attentionBorder: 'rgba(251,146,60,0.6)',
  critical: 'rgba(248,113,113,0.15)',
  criticalBorder: 'rgba(248,113,113,0.6)',
  error: '#EF4444',
}

const fonts = {
  heading: '"Fraunces", serif',
  ui: '"Plus Jakarta Sans", sans-serif',
}

interface StagedBiomarker {
  slug: string
  name: string
  value: number
  unit: string
  original_value: number
  original_unit: string
  converted: boolean
  reference_range_min: number | null
  reference_range_max: number | null
  optimal_range_min: number | null
  optimal_range_max: number | null
  state: 'Optimal' | 'Watch' | 'Attention' | 'Critical'
  flag_error: boolean
  error_reason: string | null
  matched: boolean
}

interface UnmatchedMarker {
  name: string
  value: number
  unit: string
}

function getStateStyles(state: string) {
  switch (state) {
    case 'Optimal': return { bg: colors.optimal, border: colors.optimalBorder, label: 'Optimal', dot: '#2DD4BF' }
    case 'Watch': return { bg: colors.watch, border: colors.watchBorder, label: 'Watch', dot: '#FACC15' }
    case 'Attention': return { bg: colors.attention, border: colors.attentionBorder, label: 'Attention', dot: '#FB923C' }
    case 'Critical': return { bg: colors.critical, border: colors.criticalBorder, label: 'Critical', dot: '#F87171' }
    default: return { bg: colors.cardBg, border: colors.cardBorder, label: 'Unknown', dot: colors.textMuted }
  }
}

export default function LabsUploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [userId, setUserId] = useState<string | null>(null)
  const [bioProfile, setBioProfile] = useState<string>('female')
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [staged, setStaged] = useState<StagedBiomarker[] | null>(null)
  const [unmatched, setUnmatched] = useState<UnmatchedMarker[]>([])
  const [stats, setStats] = useState<{ extracted: number; matched: number; errors: number } | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [labDate, setLabDate] = useState<string>('')

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/onboarding/welcome')
        return
      }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('biological_profile')
        .eq('id', user.id)
        .single()

      if (profile?.biological_profile) {
        setBioProfile(profile.biological_profile)
      }
    }
    checkAuth()
  }, [router, supabase])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.')
      return
    }

    setFileName(file.name)
    setError(null)
    setStaged(null)
    setConfirmed(false)
    setUploading(true)

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]

        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdf_base64: base64,
            user_id: userId,
            biological_profile: bioProfile,
          }),
        })

        const data = await response.json()

        if (!data.success) {
          setError(data.error || 'Failed to process PDF')
          setUploading(false)
          return
        }

        setStaged(data.staged_biomarkers)
        setUnmatched(data.unmatched || [])
        setStats({
          extracted: data.total_extracted,
          matched: data.total_matched,
          errors: data.total_errors,
        })
        if (data.lab_date) {
          setLabDate(data.lab_date)
        } else {
          setLabDate(new Date().toISOString().split('T')[0])
        }
        setUploading(false)
      }

      reader.readAsDataURL(file)
    } catch {
      setError('Failed to read file')
      setUploading(false)
    }
  }

  async function handleConfirm() {
    if (!staged || !userId) return
    setConfirming(true)
    setError(null)

    try {
      const response = await fetch('/api/ocr/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          biomarkers: staged,
          collected_at: labDate ? new Date(labDate).toISOString() : new Date().toISOString(),
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Failed to save biomarkers')
        setConfirming(false)
        return
      }

      setSavedCount(data.saved_count)
      setConfirmed(true)
      setConfirming(false)
    } catch {
      setError('Failed to save biomarkers')
      setConfirming(false)
    }
  }

  function handleReset() {
    setStaged(null)
    setUnmatched([])
    setStats(null)
    setFileName(null)
    setError(null)
    setConfirmed(false)
    setSavedCount(0)
    setLabDate('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        fontFamily: fonts.ui,
        position: 'relative',
        overflow: 'hidden',
        padding: '24px',
      }}
    >
      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '720px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 style={{ fontFamily: fonts.heading, fontSize: '32px', fontWeight: 400, color: colors.text, marginBottom: '8px' }}>
            Upload your labs
          </h1>
          <p style={{ fontSize: '16px', color: colors.textSoft, marginBottom: '32px', lineHeight: 1.6 }}>
            Upload a PDF from your lab provider. Meridian will extract your biomarkers automatically.
          </p>
        </motion.div>

        {/* Upload Area */}
        {!staged && !uploading && !confirmed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                padding: '60px 24px',
                backgroundColor: colors.cardBg,
                border: `2px dashed ${colors.cardBorder}`,
                borderRadius: '16px',
                cursor: 'pointer',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                transition: 'border-color 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.teal }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.cardBorder }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={colors.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="12" y2="12" />
                <line x1="15" y1="15" x2="12" y2="12" />
              </svg>
              <span style={{ fontSize: '16px', fontWeight: 600, color: colors.text }}>
                Choose PDF file
              </span>
              <span style={{ fontSize: '14px', color: colors.textMuted }}>
                Max 10MB · PDF only
              </span>
            </button>
          </motion.div>
        )}

        {/* Loading State */}
        {uploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: '60px 24px',
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: '16px',
              backdropFilter: 'blur(24px)',
              textAlign: 'center',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ width: '48px', height: '48px', margin: '0 auto 16px', border: `3px solid ${colors.cardBorder}`, borderTopColor: colors.teal, borderRadius: '50%' }}
            />
            <p style={{ fontSize: '18px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>
              Analyzing {fileName}...
            </p>
            <p style={{ fontSize: '14px', color: colors.textMuted }}>
              Extracting biomarkers with Claude AI
            </p>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: colors.error, fontSize: '14px', textAlign: 'center', marginTop: '16px' }}
          >
            {error}
          </motion.p>
        )}

        {/* Staging Modal */}
        <AnimatePresence>
          {staged && !confirmed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {/* Stats bar */}
              <div style={{
                display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap',
              }}>
                <div style={{ padding: '12px 20px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '12px', backdropFilter: 'blur(24px)' }}>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: colors.teal }}>{stats?.matched}</span>
                  <span style={{ fontSize: '13px', color: colors.textMuted, marginLeft: '8px' }}>markers found</span>
                </div>
                {(stats?.errors ?? 0) > 0 && (
                  <div style={{ padding: '12px 20px', backgroundColor: colors.critical, border: `1px solid ${colors.criticalBorder}`, borderRadius: '12px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: '#F87171' }}>{stats?.errors}</span>
                    <span style={{ fontSize: '13px', color: '#FCA5A5', marginLeft: '8px' }}>flagged</span>
                  </div>
                )}
                {unmatched.length > 0 && (
                  <div style={{ padding: '12px 20px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '12px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: colors.textMuted }}>{unmatched.length}</span>
                    <span style={{ fontSize: '13px', color: colors.textMuted, marginLeft: '8px' }}>not recognized</span>
                  </div>
                )}
              </div>

              <p style={{ fontSize: '14px', color: colors.textSoft, marginBottom: '20px' }}>
                Review your extracted biomarkers below. Click confirm to save them.
              </p>

              {/* Lab Date */}
              <div style={{
                padding: '16px 20px',
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: '12px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}>
                <div>
                  <span style={{ fontSize: '13px', color: colors.textMuted, display: 'block', marginBottom: '4px' }}>Collection Date</span>
                  <span style={{ fontSize: '15px', color: colors.text, fontWeight: 600 }}>
                    {labDate ? new Date(labDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not detected'}
                  </span>
                </div>
                <input
                  type="date"
                  value={labDate}
                  onChange={(e) => setLabDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'rgba(6,19,22,0.5)',
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '8px',
                    color: colors.text,
                    fontFamily: fonts.ui,
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Biomarker cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {staged.map((b, i) => {
                  const s = getStateStyles(b.state)
                  return (
                    <motion.div
                      key={b.slug + i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      style={{
                        padding: '16px 20px',
                        backgroundColor: b.flag_error ? colors.critical : s.bg,
                        border: `1px solid ${b.flag_error ? colors.criticalBorder : s.border}`,
                        borderRadius: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: b.flag_error ? colors.error : s.dot }} />
                          <span style={{ fontSize: '15px', fontWeight: 600, color: colors.text }}>{b.name}</span>
                        </div>
                        {b.converted && (
                          <span style={{ fontSize: '12px', color: colors.textMuted }}>
                            Converted from {b.original_value} {b.original_unit}
                          </span>
                        )}
                        {b.flag_error && (
                          <span style={{ fontSize: '12px', color: '#FCA5A5' }}>
                            {b.error_reason}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '20px', fontWeight: 700, color: colors.text }}>
                          {b.value}
                        </span>
                        <span style={{ fontSize: '13px', color: colors.textMuted, marginLeft: '4px' }}>
                          {b.unit}
                        </span>
                        <div style={{ fontSize: '12px', color: s.dot, fontWeight: 600, marginTop: '2px' }}>
                          {b.flag_error ? 'ERROR' : s.label}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Unmatched markers */}
              {unmatched.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <p style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '8px' }}>
                    Not recognized (not saved):
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {unmatched.map((u, i) => (
                      <span key={i} style={{
                        padding: '6px 12px',
                        backgroundColor: colors.cardBg,
                        border: `1px solid ${colors.cardBorder}`,
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: colors.textMuted,
                      }}>
                        {u.name}: {u.value} {u.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <motion.button
                  onClick={handleConfirm}
                  disabled={confirming || !labDate}
                  whileHover={confirming || !labDate ? {} : { scale: 1.02 }}
                  whileTap={confirming || !labDate ? {} : { scale: 0.98 }}
                  style={{
                    flex: 1,
                    padding: '16px 24px',
                    background: confirming || !labDate ? `${colors.teal}60` : `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`,
                    border: 'none',
                    borderRadius: '12px',
                    color: colors.background,
                    fontFamily: fonts.ui,
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: confirming || !labDate ? 'not-allowed' : 'pointer',
                  }}
                >
                  {confirming ? 'Saving...' : `Confirm ${staged.filter(b => !b.flag_error).length} markers`}
                </motion.button>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '16px 24px',
                    backgroundColor: colors.cardBg,
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '12px',
                    color: colors.textMuted,
                    fontFamily: fonts.ui,
                    fontSize: '16px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmation success */}
        {confirmed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              padding: '48px 24px',
              backgroundColor: colors.optimal,
              border: `1px solid ${colors.optimalBorder}`,
              borderRadius: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <h2 style={{ fontFamily: fonts.heading, fontSize: '24px', color: colors.text, marginBottom: '8px' }}>
              {savedCount} biomarkers saved
            </h2>
            <p style={{ fontSize: '14px', color: colors.textSoft, marginBottom: '24px' }}>
              Your lab results are now part of your health intelligence.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <motion.button
                onClick={handleReset}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: '12px 24px',
                  background: `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`,
                  border: 'none',
                  borderRadius: '12px',
                  color: colors.background,
                  fontFamily: fonts.ui,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Upload another PDF
              </motion.button>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '12px',
                  color: colors.textSoft,
                  fontFamily: fonts.ui,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Back to home
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
  
