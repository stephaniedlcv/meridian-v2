'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar from '@/components/NavBar'

// ── Design tokens ──────────────────────────────────────────────────────────────
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

// ── Upload-flow interfaces (unchanged) ────────────────────────────────────────
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

// ── Recent-snapshot interface ──────────────────────────────────────────────────
interface RecentBiomarker {
  id: string
  marker_name: string
  value: number
  unit: string
  state: string | null
  reference_range_min: number | null
  reference_range_max: number | null
  optimal_range_min: number | null
  optimal_range_max: number | null
  collected_at: string
  flag_error: boolean
}

// ── Panel inference (local, not imported from history) ─────────────────────────
const SLUG_TO_PANEL: Record<string, string> = {
  tsh: 'Thyroid', free_t4: 'Thyroid', free_t3: 'Thyroid', total_t3: 'Thyroid',
  wbc: 'CBC', rbc: 'CBC', hemoglobin: 'CBC', hematocrit: 'CBC',
  mcv: 'CBC', mch: 'CBC', mchc: 'CBC', rdw: 'CBC',
  platelet_count: 'CBC', platelet_count_abs: 'CBC',
  neutrophils_pct: 'CBC', neutrophils_abs: 'CBC',
  lymphocytes_pct: 'CBC', lymphocytes_abs: 'CBC',
  monocytes_pct: 'CBC', monocytes_abs: 'CBC',
  eosinophils_pct: 'CBC', eosinophils_abs: 'CBC',
  basophils_pct: 'CBC', basophils_abs: 'CBC',
  immature_granulocytes_pct: 'CBC', immature_granulocytes_abs: 'CBC',
  hba1c: 'Glycemic', insulin_fasting: 'Glycemic',
  total_cholesterol: 'Lipid Panel', hdl: 'Lipid Panel', ldl: 'Lipid Panel',
  vldl: 'Lipid Panel', triglycerides: 'Lipid Panel', non_hdl: 'Lipid Panel',
  ldl_hdl_ratio: 'Lipid Panel', chol_hdl_ratio: 'Lipid Panel',
  testosterone_total: 'Hormones', cortisol_am: 'Hormones', dhea_s: 'Hormones',
  crp_hs: 'Inflammation / Cardiac Risk', homocysteine: 'Inflammation / Cardiac Risk',
  vitamin_d: 'Vitamins & Nutrients', vitamin_b12: 'Vitamins & Nutrients',
  folate: 'Vitamins & Nutrients', magnesium: 'Vitamins & Nutrients', ferritin: 'Vitamins & Nutrients',
  creatinine: 'Kidney / Renal', bun: 'Kidney / Renal', bun_creatinine_ratio: 'Kidney / Renal',
  egfr: 'Kidney / Renal', egfr_african_american: 'Kidney / Renal', egfr_non_african_american: 'Kidney / Renal',
  ast: 'Liver', alt: 'Liver', alkaline_phosphatase: 'Liver',
  bilirubin_total: 'Liver', albumin: 'Liver', globulin: 'Liver',
  ag_ratio: 'Liver', total_protein: 'Liver',
  glucose_fasting: 'CMP', sodium: 'CMP', potassium: 'CMP',
  chloride: 'CMP', co2: 'CMP', calcium: 'CMP', anion_gap: 'CMP',
}

function inferPanel(slug: string): string {
  return SLUG_TO_PANEL[slug] ?? 'Other'
}

const PANEL_ORDER = [
  'CBC', 'Lipid Panel', 'CMP', 'Kidney / Renal', 'Liver',
  'Glycemic', 'Thyroid', 'Vitamins & Nutrients',
  'Hormones', 'Inflammation / Cardiac Risk', 'Other',
]

const PANEL_EDUCATION: Record<string, string> = {
  'CBC':                      'This panel helps Meridian understand blood cell patterns, oxygen-carrying capacity, and immune cell context.',
  'CMP':                      'This panel gives context on metabolism, electrolytes, kidney markers, liver enzymes, and protein balance.',
  'Lipid Panel':              'This panel helps Meridian understand cholesterol transport and cardiovascular risk signals over time.',
  'Thyroid':                  'This panel gives context on thyroid signaling, metabolism, energy, and recovery patterns.',
  'Glycemic':                 'This panel helps Meridian understand blood sugar regulation and longer-term glucose trends.',
  'Kidney / Renal':           'This panel gives context on filtration, hydration balance, and kidney-related markers.',
  'Liver':                    'This panel helps Meridian understand liver enzyme patterns and protein metabolism context.',
  'Urinalysis':               'This panel adds context on hydration, kidney/urinary markers, and qualitative urine findings.',
  'Vitamins & Nutrients':     'This panel helps Meridian understand nutrient status and possible support needs over time.',
  'Hormones':                 'This panel gives context on hormonal signals that may relate to energy, recovery, cycle patterns, and stress.',
  'Inflammation / Cardiac Risk': 'This panel helps Meridian understand inflammation and cardiovascular signal context.',
  'Other':                    'This panel adds context to your broader biological profile.',
}

interface PanelSummary {
  panel: string
  count: number
  latestDate: string
  latestDateLabel: string
  stateCounts: { Optimal: number; Watch: number; Attention: number; Critical: number }
}

function buildPanelSummaries(rows: RecentBiomarker[]): PanelSummary[] {
  const map = new Map<string, { items: RecentBiomarker[]; latestDate: string }>()
  for (const row of rows) {
    const panel = inferPanel(row.marker_name)
    if (!map.has(panel)) map.set(panel, { items: [], latestDate: row.collected_at })
    const entry = map.get(panel)!
    entry.items.push(row)
    if (row.collected_at > entry.latestDate) entry.latestDate = row.collected_at
  }
  return Array.from(map.entries())
    .map(([panel, { items, latestDate }]) => ({
      panel,
      count: items.length,
      latestDate,
      latestDateLabel: formatDateShort(latestDate),
      stateCounts: {
        Optimal: items.filter(i => i.state === 'Optimal').length,
        Watch: items.filter(i => i.state === 'Watch').length,
        Attention: items.filter(i => i.state === 'Attention').length,
        Critical: items.filter(i => i.state === 'Critical').length,
      },
    }))
    .sort((a, b) => {
      const ai = PANEL_ORDER.indexOf(a.panel)
      const bi = PANEL_ORDER.indexOf(b.panel)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
}

function deduplicateByMarker(rows: RecentBiomarker[]): RecentBiomarker[] {
  // Rows are already ordered collected_at DESC, created_at DESC.
  // First occurrence of each marker_name is the most recent result.
  const seen = new Set<string>()
  return rows.filter(row => {
    if (seen.has(row.marker_name)) return false
    seen.add(row.marker_name)
    return true
  })
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

// ── Range bar helpers ──────────────────────────────────────────────────────────
function getStateColor(state: string | null): string {
  switch (state) {
    case 'Optimal':   return '#2DD4BF'  // teal
    case 'Watch':     return '#FCD34D'  // amber-yellow
    case 'Attention': return '#FB923C'  // orange
    case 'Critical':  return '#F87171'  // red
    default:          return '#67E8F9'  // cyan fallback
  }
}

function isUsableRange(min: number | null, max: number | null): boolean {
  return (
    min !== null && max !== null &&
    typeof min === 'number' && typeof max === 'number' &&
    !isNaN(min) && !isNaN(max) &&
    isFinite(min) && isFinite(max) &&
    min < max
  )
}

interface RangeBarProps {
  value: number
  refMin: number
  refMax: number
  state: string | null
}

function BiomarkerRangeBar({ value, refMin, refMax, state }: RangeBarProps) {
  // Spec formula: 0% = at/below refMin (Low), 100% = at/above refMax (High)
  const rawPct   = ((value - refMin) / (refMax - refMin)) * 100
  const dotPct   = Math.max(0, Math.min(100, rawPct))
  const dotColor = getStateColor(state)

  return (
    <div style={{ width: '100%', paddingTop: '6px' }}>
      {/* Track — gradient communicates Low → Optimal → High */}
      <div style={{
        position: 'relative',
        height: '8px',
        borderRadius: '6px',
        width: '100%',
        background: 'linear-gradient(to right, rgba(248,113,113,0.40) 0%, rgba(251,146,60,0.30) 22%, rgba(45,212,191,0.50) 50%, rgba(251,146,60,0.30) 78%, rgba(248,113,113,0.40) 100%)',
        overflow: 'visible',
      }}>
        {/* Value dot — state-colored ring, dark center */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: `${dotPct}%`,
          transform: 'translate(-50%, -50%)',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: 'rgba(6,19,22,0.92)',
          border: `3px solid ${dotColor}`,
          boxShadow: `0 0 10px ${dotColor}BB, 0 0 4px ${dotColor}60`,
          zIndex: 2,
        }} />
      </div>
      {/* Low · reference range pill · High */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
        <span style={{ fontSize: '9px', color: 'rgba(95,142,133,0.7)', letterSpacing: '0.04em' }}>Low</span>
        <span style={{
          fontSize: '9px',
          color: 'rgba(154,203,193,0.65)',
          backgroundColor: 'rgba(103,232,249,0.05)',
          border: '1px solid rgba(103,232,249,0.10)',
          borderRadius: '20px',
          padding: '1px 7px',
          letterSpacing: '0.02em',
        }}>
          Ref {refMin}–{refMax}
        </span>
        <span style={{ fontSize: '9px', color: 'rgba(95,142,133,0.7)', letterSpacing: '0.04em' }}>High</span>
      </div>
    </div>
  )
}

// ── State style helpers ────────────────────────────────────────────────────────
function getStateStyles(state: string) {
  switch (state) {
    case 'Optimal':   return { bg: colors.optimal,   border: colors.optimalBorder,   label: 'Optimal',   dot: '#2DD4BF' }
    case 'Watch':     return { bg: colors.watch,      border: colors.watchBorder,     label: 'Watch',     dot: '#FCD34D' }
    case 'Attention': return { bg: colors.attention,  border: colors.attentionBorder, label: 'Attention', dot: '#FB923C' }
    case 'Critical':  return { bg: colors.critical,   border: colors.criticalBorder,  label: 'Critical',  dot: '#F87171' }
    default:          return { bg: colors.cardBg,     border: colors.cardBorder,      label: 'Unknown',   dot: colors.textMuted }
  }
}

// ── Marker display names ───────────────────────────────────────────────────────
const NAME_OVERRIDES: Record<string, string> = {
  egfr: 'eGFR', egfr_african_american: 'eGFR (African American)', egfr_non_african_american: 'eGFR (Non-African American)',
  ldl_hdl_ratio: 'LDL/HDL Ratio', chol_hdl_ratio: 'Cholesterol/HDL Ratio', non_hdl: 'Non-HDL Cholesterol',
  hba1c: 'Hemoglobin A1c', crp_hs: 'hs-CRP', dhea_s: 'DHEA-S', bun: 'BUN',
  bun_creatinine_ratio: 'BUN/Creatinine Ratio', wbc: 'WBC', rbc: 'RBC',
  mcv: 'MCV', mch: 'MCH', mchc: 'MCHC', rdw: 'RDW',
  co2: 'CO₂ (Bicarbonate)', ast: 'AST', alt: 'ALT', tsh: 'TSH',
  ag_ratio: 'A/G Ratio', free_t4: 'Free T4', free_t3: 'Free T3', total_t3: 'Total T3',
  cortisol_am: 'Cortisol AM', testosterone_total: 'Total Testosterone',
  insulin_fasting: 'Fasting Insulin', glucose_fasting: 'Fasting Glucose',
  vitamin_d: 'Vitamin D', vitamin_b12: 'Vitamin B12',
  alkaline_phosphatase: 'Alkaline Phosphatase', bilirubin_total: 'Total Bilirubin',
  total_protein: 'Total Protein', total_cholesterol: 'Total Cholesterol',
  hdl: 'HDL Cholesterol', ldl: 'LDL Cholesterol', vldl: 'VLDL Cholesterol',
}

function markerDisplayName(slug: string): string {
  return NAME_OVERRIDES[slug] ?? slug.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── Interpretation copy ────────────────────────────────────────────────────────
const INTERPRETATIONS: Record<string, string> = {
  hdl:                'HDL helps transport cholesterol away from arteries. Patterns over time can provide context for cardiovascular health.',
  ldl:                'LDL is one of the cholesterol transport markers Meridian tracks over time as part of lipid and cardiovascular context.',
  triglycerides:      'Triglycerides reflect circulating blood fats and can provide context for metabolism and cardiovascular patterns.',
  glucose_fasting:    'Glucose provides context on blood sugar regulation at the time of collection.',
  hba1c:              'A1c gives context on longer-term glucose patterns over approximately the past few months.',
  tsh:                'TSH gives context on thyroid signaling and metabolic regulation.',
  egfr:               'eGFR gives context on kidney filtration patterns.',
  creatinine:         'Creatinine provides context for kidney filtration and muscle-related metabolism.',
  vitamin_b12:        'Vitamin B12 provides context for nutrient status, energy metabolism, and nervous system support.',
  vitamin_d:          'Vitamin D provides context for immune function, bone health, and metabolic signaling.',
  ferritin:           'Ferritin reflects stored iron levels and can provide context for energy and oxygen transport.',
  hemoglobin:         'Hemoglobin carries oxygen through the blood and can provide context for energy and circulation.',
  crp_hs:             'High-sensitivity CRP provides context for systemic inflammatory patterns over time.',
  cortisol_am:        'Cortisol provides context on adrenal function and the body\'s stress response signaling.',
  testosterone_total: 'Testosterone provides context for hormonal and metabolic signaling patterns.',
}

function getInterpretation(slug: string): string {
  return INTERPRETATIONS[slug] ?? 'This biomarker adds context to your saved lab profile.'
}

// ── Biomarker Detail Sheet ─────────────────────────────────────────────────────
function BiomarkerDetailSheet({
  biomarker,
  allBiomarkers,
  onClose,
}: {
  biomarker: RecentBiomarker
  allBiomarkers: RecentBiomarker[]
  onClose: () => void
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const displayName = markerDisplayName(biomarker.marker_name)
  const panel       = SLUG_TO_PANEL[biomarker.marker_name] ?? null
  const s           = getStateStyles(biomarker.state ?? '')
  const dotColor    = getStateColor(biomarker.state)
  const hasRange    = isUsableRange(biomarker.reference_range_min, biomarker.reference_range_max)
  const hasOptimal  = isUsableRange(biomarker.optimal_range_min, biomarker.optimal_range_max)
  const interp      = getInterpretation(biomarker.marker_name)

  const prev = allBiomarkers
    .filter(b =>
      b.marker_name === biomarker.marker_name &&
      b.id !== biomarker.id &&
      new Date(b.collected_at).getTime() <= new Date(biomarker.collected_at).getTime()
    )
    .sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime())[0] ?? null

  const delta = prev !== null ? Number((biomarker.value - prev.value).toFixed(2)) : null

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  }

  const cardStyle = {
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: '14px' as const,
    padding: '14px 16px',
    marginBottom: '10px',
  }
  const labelStyle = {
    fontSize: '10px' as const,
    color: colors.textMuted,
    fontWeight: 700 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '8px',
    marginTop: 0 as const,
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          backgroundColor: 'rgba(6,19,22,0.78)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />
      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
        maxHeight: '88vh', overflowY: 'auto',
        backgroundColor: '#081A1E',
        border: `1px solid ${dotColor}40`,
        borderBottom: 'none',
        borderRadius: '20px 20px 0 0',
        fontFamily: fonts.ui,
      }}>
        {/* Handle */}
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(103,232,249,0.2)', margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {panel && (
              <p style={{ fontSize: '11px', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>
                {panel}
              </p>
            )}
            <h2 style={{ fontFamily: fonts.heading, fontSize: '22px', fontWeight: 700, color: colors.text, lineHeight: 1.2, margin: 0 }}>
              {displayName}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingTop: '4px' }}>
            {biomarker.state && (
              <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.dot, letterSpacing: '0.04em' }}>
                {s.label}
              </span>
            )}
            <button onClick={onClose} aria-label="Close" style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(103,232,249,0.07)', border: '1px solid rgba(103,232,249,0.15)', color: colors.textMuted, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.ui, lineHeight: '1' }}>
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 20px 52px' }}>

          {/* Value card */}
          <div style={{ ...cardStyle, textAlign: 'center', padding: '20px 16px' }}>
            <div>
              <span style={{ fontFamily: fonts.heading, fontSize: '46px', fontWeight: 800, color: colors.text, lineHeight: 1 }}>
                {biomarker.value}
              </span>
              {biomarker.unit && (
                <span style={{ fontSize: '16px', color: colors.textMuted, marginLeft: '6px', fontWeight: 500 }}>
                  {biomarker.unit}
                </span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: colors.textMuted, marginTop: '6px', marginBottom: 0 }}>
              Collected {fmtDate(biomarker.collected_at)}
            </p>
          </div>

          {/* Range card — always rendered */}
          <div style={cardStyle}>
            <p style={labelStyle}>Range</p>
            {(hasRange || hasOptimal) ? (
              <>
                {hasRange && (
                  <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 4px' }}>
                    Clinical: <span style={{ fontWeight: 600, color: colors.text }}>{biomarker.reference_range_min} – {biomarker.reference_range_max}</span>
                    {biomarker.unit ? ` ${biomarker.unit}` : ''}
                  </p>
                )}
                {hasOptimal && (
                  <p style={{ fontSize: '13px', color: colors.teal, margin: '0 0 8px' }}>
                    Optimal: <span style={{ fontWeight: 600 }}>{biomarker.optimal_range_min} – {biomarker.optimal_range_max}</span>
                    {biomarker.unit ? ` ${biomarker.unit}` : ''}
                  </p>
                )}
                {hasRange && (
                  <BiomarkerRangeBar
                    value={biomarker.value}
                    refMin={biomarker.reference_range_min!}
                    refMax={biomarker.reference_range_max!}
                    state={biomarker.state}
                  />
                )}
              </>
            ) : (
              <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>Range data not available for this result.</p>
            )}
          </div>

          {/* Trend card */}
          <div style={cardStyle}>
            <p style={labelStyle}>Trend</p>
            {prev ? (
              <div>
                <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 4px' }}>
                  Previous: <span style={{ fontWeight: 700, color: colors.text }}>{prev.value}{prev.unit ? ` ${prev.unit}` : ''}</span>
                  <span style={{ color: colors.textMuted }}>{' '}on {fmtDate(prev.collected_at)}</span>
                </p>
                {delta !== null && (
                  <p style={{ fontSize: '13px', margin: 0, fontWeight: 600, color: delta > 0 ? '#FB923C' : delta < 0 ? '#2DD4BF' : colors.textMuted }}>
                    {delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : ''}{delta} from previous
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>No previous result yet.</p>
            )}
          </div>

          {/* About this marker */}
          <div style={cardStyle}>
            <p style={labelStyle}>About this marker</p>
            <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.6, margin: 0 }}>{interp}</p>
          </div>

          {/* Context */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <p style={labelStyle}>Context</p>
            <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6, margin: '0 0 5px' }}>Meridian uses this marker as one part of your broader biological context.</p>
            <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6, margin: '0 0 5px' }}>Trends over time are usually more useful than one isolated result.</p>
            <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>This is educational context only, not a diagnosis.</p>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Page component ─────────────────────────────────────────────────────────────
export default function LabsUploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── Existing upload-flow state (unchanged) ───────────────────────────────────
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
  const [duplicateWarning, setDuplicateWarning] = useState<{ count: number; slugs: string[] } | null>(null)

  // ── Recent snapshot state ────────────────────────────────────────────────────
  const [recentBiomarkers, setRecentBiomarkers] = useState<RecentBiomarker[]>([])
  const [hasAnyLabs, setHasAnyLabs] = useState(false)
  const [snapshotLoading, setSnapshotLoading] = useState(true)
  const [selectedBiomarker, setSelectedBiomarker] = useState<RecentBiomarker | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  // ── Auth + data fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/onboarding/welcome')
        return
      }
      setUserId(user.id)

      // Biological profile (unchanged)
      const { data: profile } = await supabase
        .from('profiles')
        .select('biological_profile')
        .eq('id', user.id)
        .single()
      if (profile?.biological_profile) setBioProfile(profile.biological_profile)

      // Recent labs: last 12 months
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      const { data: recent } = await supabase
        .from('biomarkers_static')
        .select('id, marker_name, value, unit, state, reference_range_min, reference_range_max, optimal_range_min, optimal_range_max, collected_at, flag_error')
        .eq('user_id', user.id)
        .gte('collected_at', oneYearAgo.toISOString())
        .order('collected_at', { ascending: false })
        .order('created_at', { ascending: false })

      const recentRows = recent || []
      setRecentBiomarkers(recentRows)

      if (recentRows.length > 0) {
        setHasAnyLabs(true)
      } else {
        // Check if any labs exist at all (for the "older labs" empty state)
        const { count } = await supabase
          .from('biomarkers_static')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        setHasAnyLabs((count ?? 0) > 0)
      }

      setSnapshotLoading(false)
    }
    checkAuth()
  }, [router, supabase])

  // ── Upload handlers (all unchanged) ─────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file'); return }
    if (file.size > 10 * 1024 * 1024) { setError('File too large. Maximum 10MB.'); return }

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
          body: JSON.stringify({ pdf_base64: base64, user_id: userId, biological_profile: bioProfile }),
        })
        const data = await response.json()
        if (!data.success) { setError(data.error || 'Failed to process PDF'); setUploading(false); return }
        setStaged(data.staged_biomarkers)
        setUnmatched(data.unmatched || [])
        setStats({ extracted: data.total_extracted, matched: data.total_matched, errors: data.total_errors })
        setLabDate(data.lab_date || new Date().toISOString().split('T')[0])
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setError('Failed to read file')
      setUploading(false)
    }
  }

  async function doSave() {
    if (!staged || !userId) return
    setConfirming(true)
    setError(null)
    setDuplicateWarning(null)
    try {
      const collectedAt = labDate ? new Date(labDate).toISOString() : new Date().toISOString()
      const response = await fetch('/api/ocr/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, biomarkers: staged, collected_at: collectedAt }),
      })
      const data = await response.json()
      if (!data.success) { setError(data.error || 'Failed to save biomarkers'); setConfirming(false); return }
      setSavedCount(data.saved_count)
      setConfirmed(true)
      setConfirming(false)
    } catch {
      setError('Failed to save biomarkers')
      setConfirming(false)
    }
  }

  async function handleConfirm(force = false) {
    if (!staged || !userId) return
    setError(null)

    // ── Collection date validation ────────────────────────────────────────────
    if (!labDate) { setError('Please set a collection date before saving.'); return }
    const dateVal = new Date(labDate)
    const today = new Date()
    if (isNaN(dateVal.getTime())) { setError('Please enter a valid collection date.'); return }
    if (dateVal > today) { setError('Collection date cannot be in the future.'); return }
    if (dateVal.getFullYear() < 1900) { setError('Please enter a valid collection date (after 1900).'); return }

    // ── Duplicate detection ───────────────────────────────────────────────────
    if (!force) {
      const nextDay = new Date(labDate + 'T00:00:00Z')
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      const { data: existing } = await supabase
        .from('biomarkers_static')
        .select('marker_name')
        .eq('user_id', userId)
        .gte('collected_at', `${labDate}T00:00:00.000Z`)
        .lt('collected_at', nextDay.toISOString())
      if (existing && existing.length > 0) {
        const existingSet = new Set(existing.map((r: { marker_name: string }) => r.marker_name))
        const overlapping = staged.filter(b => !b.flag_error && existingSet.has(b.slug)).map(b => b.slug)
        if (overlapping.length > 0) {
          setDuplicateWarning({ count: overlapping.length, slugs: overlapping })
          return
        }
      }
    }

    await doSave()
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

  // ── Derived snapshot data ────────────────────────────────────────────────────
  // Deduplicate — rows ordered collected_at DESC so first occurrence = most recent
  const snapshotBiomarkers = deduplicateByMarker(recentBiomarkers)
  const hasRecentLabs = snapshotBiomarkers.length > 0
  const panelSummaries = hasRecentLabs ? buildPanelSummaries(snapshotBiomarkers) : []
  const latestDate = hasRecentLabs ? snapshotBiomarkers[0].collected_at : null
  const totalStateCounts = {
    Optimal:   snapshotBiomarkers.filter(b => b.state === 'Optimal').length,
    Watch:     snapshotBiomarkers.filter(b => b.state === 'Watch').length,
    Attention: snapshotBiomarkers.filter(b => b.state === 'Attention').length,
    Critical:  snapshotBiomarkers.filter(b => b.state === 'Critical').length,
  }
  const SEVERITY: Record<string, number> = { Critical: 0, Attention: 1, Watch: 2 }
  const attentionMarkers = snapshotBiomarkers
    .filter(b => b.state === 'Critical' || b.state === 'Attention' || b.state === 'Watch')
    .sort((a, b) => (SEVERITY[a.state ?? ''] ?? 9) - (SEVERITY[b.state ?? ''] ?? 9))
  const filteredBiomarkers = activeFilter
    ? snapshotBiomarkers.filter(b => b.state === activeFilter)
    : snapshotBiomarkers

  // Whether the active upload flow is in progress
  const inUploadFlow = uploading || !!staged || confirmed

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      fontFamily: fonts.ui,
      position: 'relative',
      overflow: 'hidden',
      padding: '24px 20px 120px',
    }}>
      {/* Detail sheet */}
      {selectedBiomarker && (
        <BiomarkerDetailSheet
          biomarker={selectedBiomarker}
          allBiomarkers={recentBiomarkers}
          onClose={() => setSelectedBiomarker(null)}
        />
      )}

      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* ── Page header ── */}
        {!inUploadFlow && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 style={{
              fontFamily: fonts.heading,
              fontSize: 'clamp(26px, 5vw, 32px)',
              fontWeight: 400,
              color: colors.text,
              marginBottom: '6px',
              lineHeight: 1.2,
            }}>
              {hasRecentLabs ? 'Labs' : 'Upload your labs'}
            </h1>
            <p style={{ fontSize: '15px', color: colors.textSoft, marginBottom: '28px', lineHeight: 1.6 }}>
              {hasRecentLabs
                ? 'Meridian is tracking your most recent lab signals here.'
                : 'Upload a PDF from your lab provider. Meridian will extract your biomarkers automatically.'}
            </p>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ACTIVE UPLOAD FLOW (unchanged — loading / staging / success)
            ════════════════════════════════════════════════════════════════════ */}

        {/* Upload header shown during flow */}
        {inUploadFlow && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 400, color: colors.text, marginBottom: '8px' }}>
              Upload your labs
            </h1>
            <p style={{ fontSize: '15px', color: colors.textSoft, marginBottom: '28px', lineHeight: 1.6 }}>
              Upload a PDF from your lab provider. Meridian will extract your biomarkers automatically.
            </p>
          </motion.div>
        )}

        {/* Loading State */}
        {uploading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
            padding: '60px 24px',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '16px',
            backdropFilter: 'blur(24px)',
            textAlign: 'center',
          }}>
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
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ color: colors.error, fontSize: '14px', textAlign: 'center', marginTop: '16px' }}>
            {error}
          </motion.p>
        )}

        {/* Staging review */}
        <AnimatePresence>
          {staged && !confirmed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {/* Stats bar */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
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
                padding: '16px 20px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
                borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
              }}>
                <div>
                  <span style={{ fontSize: '13px', color: colors.textMuted, display: 'block', marginBottom: '4px' }}>Collection Date — correct if needed</span>
                  <span style={{ fontSize: '15px', color: colors.text, fontWeight: 600 }}>
                    {labDate ? new Date(labDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not detected'}
                  </span>
                </div>
                <input
                  type="date"
                  value={labDate}
                  onChange={(e) => setLabDate(e.target.value)}
                  style={{
                    padding: '8px 12px', backgroundColor: 'rgba(6,19,22,0.5)',
                    border: `1px solid ${colors.cardBorder}`, borderRadius: '8px',
                    color: colors.text, fontFamily: fonts.ui, fontSize: '14px', outline: 'none',
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
                        borderRadius: '12px', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', flexWrap: 'wrap', gap: '8px',
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
                          <span style={{ fontSize: '12px', color: '#FCA5A5' }}>{b.error_reason}</span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '20px', fontWeight: 700, color: colors.text }}>{b.value}</span>
                        <span style={{ fontSize: '13px', color: colors.textMuted, marginLeft: '4px' }}>{b.unit}</span>
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
                        padding: '6px 12px', backgroundColor: colors.cardBg,
                        border: `1px solid ${colors.cardBorder}`, borderRadius: '8px',
                        fontSize: '12px', color: colors.textMuted,
                      }}>
                        {u.name}: {u.value} {u.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicate warning */}
              {duplicateWarning && (
                <div style={{
                  padding: '16px 20px',
                  backgroundColor: 'rgba(250,204,21,0.07)',
                  border: '1px solid rgba(250,204,21,0.28)',
                  borderRadius: '12px',
                  marginBottom: '16px',
                }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#FCD34D', margin: '0 0 6px' }}>
                    Possible duplicate detected
                  </p>
                  <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 14px', lineHeight: 1.5 }}>
                    {duplicateWarning.count} {duplicateWarning.count === 1 ? 'biomarker' : 'biomarkers'} from this date may already exist in your history. You can cancel or save anyway.
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setDuplicateWarning(null)}
                      style={{
                        padding: '8px 16px', borderRadius: '8px',
                        border: '1px solid rgba(250,204,21,0.3)',
                        backgroundColor: 'transparent', color: '#FCD34D',
                        fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleConfirm(true)}
                      style={{
                        padding: '8px 16px', borderRadius: '8px',
                        border: '1px solid rgba(250,204,21,0.3)',
                        backgroundColor: 'rgba(250,204,21,0.1)', color: '#FCD34D',
                        fontFamily: fonts.ui, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Save anyway
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <motion.button
                  onClick={() => handleConfirm()}
                  disabled={confirming || !labDate}
                  whileHover={confirming || !labDate ? {} : { scale: 1.02 }}
                  whileTap={confirming || !labDate ? {} : { scale: 0.98 }}
                  style={{
                    flex: 1, padding: '16px 24px',
                    background: confirming || !labDate ? `${colors.teal}60` : `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`,
                    border: 'none', borderRadius: '12px', color: colors.background,
                    fontFamily: fonts.ui, fontSize: '16px', fontWeight: 600,
                    cursor: confirming || !labDate ? 'not-allowed' : 'pointer',
                  }}
                >
                  {confirming ? 'Saving...' : `Confirm ${staged.filter(b => !b.flag_error).length} markers`}
                </motion.button>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '16px 24px', backgroundColor: colors.cardBg,
                    border: `1px solid ${colors.cardBorder}`, borderRadius: '12px',
                    color: colors.textMuted, fontFamily: fonts.ui, fontSize: '16px', cursor: 'pointer',
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
              padding: '48px 24px', backgroundColor: colors.optimal,
              border: `1px solid ${colors.optimalBorder}`, borderRadius: '16px', textAlign: 'center',
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
                  border: 'none', borderRadius: '12px', color: colors.background,
                  fontFamily: fonts.ui, fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Upload another PDF
              </motion.button>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  padding: '12px 24px', backgroundColor: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`, borderRadius: '12px',
                  color: colors.textSoft, fontFamily: fonts.ui, fontSize: '14px', cursor: 'pointer',
                }}
              >
                Back to home
              </button>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            RECENT LAB SNAPSHOT — only shown when not in an upload flow
            ════════════════════════════════════════════════════════════════════ */}
        {!inUploadFlow && !snapshotLoading && (
          <>
            {/* ── Has recent labs ── */}
            {hasRecentLabs && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                style={{ marginBottom: '32px' }}
              >
                {/* Section chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em',
                    color: colors.teal, textTransform: 'uppercase',
                    padding: '4px 10px',
                    backgroundColor: `${colors.teal}18`,
                    border: `1px solid ${colors.teal}40`,
                    borderRadius: '20px',
                  }}>
                    Recent Lab Snapshot
                  </span>
                  <span style={{ fontSize: '12px', color: colors.textMuted }}>
                    Last 12 months
                  </span>
                </div>

                {/* Summary bar */}
                <div style={{
                  padding: '16px 20px',
                  backgroundColor: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '14px',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  marginBottom: '12px',
                  display: 'flex',
                  gap: '20px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: colors.textMuted, display: 'block', marginBottom: '2px' }}>Latest collection</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>
                      {latestDate ? formatDateLong(latestDate) : '—'}
                    </span>
                  </div>
                  <div style={{ width: '1px', height: '32px', backgroundColor: colors.cardBorder, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: '11px', color: colors.textMuted, display: 'block', marginBottom: '2px' }}>Biomarkers</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>{snapshotBiomarkers.length}</span>
                  </div>
                  <div style={{ width: '1px', height: '32px', backgroundColor: colors.cardBorder, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: '11px', color: colors.textMuted, display: 'block', marginBottom: '2px' }}>Panels</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>{panelSummaries.length}</span>
                  </div>
                </div>

                {/* Status filter chips — tap to filter, tap again to clear */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '16px',
                }}>
                  {totalStateCounts.Optimal > 0 && (
                    <button
                      onClick={() => setActiveFilter(prev => prev === 'Optimal' ? null : 'Optimal')}
                      style={{
                        padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: activeFilter === 'Optimal' ? 'rgba(45,212,191,0.22)' : colors.optimal,
                        border: `1px solid ${activeFilter === 'Optimal' ? 'rgba(45,212,191,0.75)' : colors.optimalBorder}`,
                        color: '#2DD4BF',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        cursor: 'pointer', fontFamily: fonts.ui,
                        boxShadow: activeFilter === 'Optimal' ? '0 0 8px rgba(45,212,191,0.28)' : 'none',
                        outline: 'none',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2DD4BF', display: 'inline-block' }} />
                      {totalStateCounts.Optimal} Optimal
                    </button>
                  )}
                  {totalStateCounts.Watch > 0 && (
                    <button
                      onClick={() => setActiveFilter(prev => prev === 'Watch' ? null : 'Watch')}
                      style={{
                        padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: activeFilter === 'Watch' ? 'rgba(250,204,21,0.18)' : colors.watch,
                        border: `1px solid ${activeFilter === 'Watch' ? 'rgba(250,204,21,0.75)' : colors.watchBorder}`,
                        color: '#FCD34D',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        cursor: 'pointer', fontFamily: fonts.ui,
                        boxShadow: activeFilter === 'Watch' ? '0 0 8px rgba(250,204,21,0.22)' : 'none',
                        outline: 'none',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FCD34D', display: 'inline-block' }} />
                      {totalStateCounts.Watch} Watch
                    </button>
                  )}
                  {totalStateCounts.Attention > 0 && (
                    <button
                      onClick={() => setActiveFilter(prev => prev === 'Attention' ? null : 'Attention')}
                      style={{
                        padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: activeFilter === 'Attention' ? 'rgba(251,146,60,0.18)' : colors.attention,
                        border: `1px solid ${activeFilter === 'Attention' ? 'rgba(251,146,60,0.75)' : colors.attentionBorder}`,
                        color: '#FB923C',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        cursor: 'pointer', fontFamily: fonts.ui,
                        boxShadow: activeFilter === 'Attention' ? '0 0 8px rgba(251,146,60,0.22)' : 'none',
                        outline: 'none',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FB923C', display: 'inline-block' }} />
                      {totalStateCounts.Attention} Attention
                    </button>
                  )}
                  {totalStateCounts.Critical > 0 && (
                    <button
                      onClick={() => setActiveFilter(prev => prev === 'Critical' ? null : 'Critical')}
                      style={{
                        padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: activeFilter === 'Critical' ? 'rgba(248,113,113,0.18)' : colors.critical,
                        border: `1px solid ${activeFilter === 'Critical' ? 'rgba(248,113,113,0.75)' : colors.criticalBorder}`,
                        color: '#F87171',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        cursor: 'pointer', fontFamily: fonts.ui,
                        boxShadow: activeFilter === 'Critical' ? '0 0 8px rgba(248,113,113,0.22)' : 'none',
                        outline: 'none',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F87171', display: 'inline-block' }} />
                      {totalStateCounts.Critical} Critical
                    </button>
                  )}
                </div>

                {/* Filtered view OR default (Needs Attention + Panel summary) */}
                {activeFilter ? (

                  /* ── Status-filtered list ── */
                  <div style={{ marginBottom: '8px' }}>
                    <p style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      {activeFilter} Biomarkers
                    </p>
                    {filteredBiomarkers.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {filteredBiomarkers.map(b => {
                          const s = getStateStyles(b.state ?? '')
                          const showBar = isUsableRange(b.reference_range_min, b.reference_range_max)
                          return (
                            <div key={b.id} style={{
                              padding: '12px 14px',
                              backgroundColor: 'rgba(232,248,245,0.055)',
                              border: `1px solid ${s.dot}30`,
                              borderRadius: '10px',
                              cursor: 'pointer',
                            }} onClick={() => setSelectedBiomarker(b)}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, flex: 1, minWidth: 0 }}>
                                  {markerDisplayName(b.marker_name)}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                  <span style={{ padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 700, backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.dot, letterSpacing: '0.04em' }}>
                                    {s.label}
                                  </span>
                                  <span style={{ fontSize: '14px', color: colors.textMuted, opacity: 0.45, lineHeight: 1 }}>›</span>
                                </div>
                              </div>
                              <div style={{ marginBottom: showBar ? '4px' : '0' }}>
                                <span style={{ fontSize: '22px', fontWeight: 800, color: colors.text, lineHeight: '1' }}>{b.value}</span>
                                {b.unit && <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: '5px' }}>{b.unit}</span>}
                              </div>
                              {showBar ? (
                                <BiomarkerRangeBar value={b.value} refMin={b.reference_range_min!} refMax={b.reference_range_max!} state={b.state} />
                              ) : (
                                <p style={{ fontSize: '12px', color: colors.textMuted, margin: '4px 0 0' }}>No range data available.</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ padding: '20px 16px', textAlign: 'center', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '10px' }}>
                        <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>
                          No biomarkers in this status for your recent snapshot.
                        </p>
                      </div>
                    )}
                  </div>

                ) : (
                  <>
                    {/* ── Needs Attention (Critical → Attention → Watch) ── */}
                    {attentionMarkers.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                          Needs attention
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {attentionMarkers.map(b => {
                            const s = getStateStyles(b.state ?? '')
                            const showBar = isUsableRange(b.reference_range_min, b.reference_range_max)
                            return (
                              <div key={b.id} style={{
                                padding: '12px 14px',
                                backgroundColor: 'rgba(232,248,245,0.055)',
                                border: `1px solid ${s.dot}30`,
                                borderRadius: '10px',
                                cursor: 'pointer',
                              }} onClick={() => setSelectedBiomarker(b)}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, flex: 1, minWidth: 0 }}>
                                    {markerDisplayName(b.marker_name)}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 700, backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.dot, letterSpacing: '0.04em' }}>
                                      {s.label}
                                    </span>
                                    <span style={{ fontSize: '14px', color: colors.textMuted, opacity: 0.45, lineHeight: 1 }}>›</span>
                                  </div>
                                </div>
                                <div style={{ marginBottom: showBar ? '4px' : '0' }}>
                                  <span style={{ fontSize: '22px', fontWeight: 800, color: colors.text, lineHeight: '1' }}>{b.value}</span>
                                  {b.unit && <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: '5px' }}>{b.unit}</span>}
                                </div>
                                {showBar && (
                                  <BiomarkerRangeBar value={b.value} refMin={b.reference_range_min!} refMax={b.reference_range_max!} state={b.state} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Panel summary cards ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {panelSummaries.map(ps => {
                        const sc = ps.stateCounts
                        return (
                          <div key={ps.panel} style={{
                            padding: '12px 16px',
                            backgroundColor: colors.cardBg,
                            border: `1px solid ${colors.cardBorder}`,
                            borderRadius: '12px',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                          }}>
                            <div style={{ flex: 1, minWidth: '160px' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text }}>{ps.panel}</span>
                                <span style={{ fontSize: '11px', color: colors.textMuted }}>
                                  {ps.count} {ps.count === 1 ? 'marker' : 'markers'}
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.45, display: 'block', marginTop: '3px' }}>
                                {PANEL_EDUCATION[ps.panel] ?? 'This panel adds context to your saved lab profile.'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {sc.Optimal > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#2DD4BF' }}>
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#2DD4BF', display: 'inline-block' }} />{sc.Optimal}
                                </span>
                              )}
                              {sc.Watch > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#FACC15' }}>
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FACC15', display: 'inline-block' }} />{sc.Watch}
                                </span>
                              )}
                              {sc.Attention > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#FB923C' }}>
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FB923C', display: 'inline-block' }} />{sc.Attention}
                                </span>
                              )}
                              {sc.Critical > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#F87171' }}>
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#F87171', display: 'inline-block' }} />{sc.Critical}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '11px', color: colors.textMuted, flexShrink: 0 }}>
                              {ps.latestDateLabel}
                            </span>
                            <button
                              onClick={() => router.push('/labs/history')}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: 'transparent',
                                border: `1px solid ${colors.cardBorder}`,
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: colors.textSoft,
                                fontFamily: fonts.ui,
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              History →
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ── No recent labs, but older labs exist ── */}
            {!hasRecentLabs && hasAnyLabs && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                style={{
                  padding: '20px 20px',
                  backgroundColor: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '14px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: colors.textSoft, marginBottom: '2px' }}>
                    No recent labs in the last 12 months.
                  </p>
                  <p style={{ fontSize: '12px', color: colors.textMuted }}>
                    Your older results are saved in Lab History.
                  </p>
                </div>
                <button
                  onClick={() => router.push('/labs/history')}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.textSoft,
                    fontFamily: fonts.ui,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  View History →
                </button>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                UPLOAD AREA — always shown when not in active upload flow
                ════════════════════════════════════════════════════════════════ */}

            {/* Upload section heading (only shown when recent labs exist, to distinguish the CTA) */}
            {hasRecentLabs && (
              <p style={{
                fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em',
                color: colors.textMuted, textTransform: 'uppercase', marginBottom: '10px',
              }}>
                Upload New Lab
              </p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: hasRecentLabs ? 0.2 : 0.15 }}
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
                  padding: hasRecentLabs ? '28px 24px' : '60px 24px',
                  backgroundColor: colors.cardBg,
                  border: `2px dashed ${colors.cardBorder}`,
                  borderRadius: '16px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  display: 'flex',
                  flexDirection: hasRecentLabs ? 'row' : 'column',
                  alignItems: 'center',
                  justifyContent: hasRecentLabs ? 'center' : 'center',
                  gap: '14px',
                  transition: 'border-color 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.teal }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.cardBorder }}
              >
                <svg width={hasRecentLabs ? 24 : 48} height={hasRecentLabs ? 24 : 48} viewBox="0 0 24 24" fill="none" stroke={colors.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="12" y2="12" />
                  <line x1="15" y1="15" x2="12" y2="12" />
                </svg>
                <div style={{ textAlign: hasRecentLabs ? 'left' : 'center' }}>
                  <span style={{ fontSize: hasRecentLabs ? '14px' : '16px', fontWeight: 600, color: colors.text, display: 'block' }}>
                    {hasRecentLabs ? 'Upload another lab PDF' : 'Choose PDF file'}
                  </span>
                  <span style={{ fontSize: '13px', color: colors.textMuted, display: 'block', marginTop: '2px' }}>
                    Max 10MB · PDF only
                  </span>
                </div>
              </button>
            </motion.div>
          </>
        )}

      </div>
      <NavBar />
    </div>
  )
}
