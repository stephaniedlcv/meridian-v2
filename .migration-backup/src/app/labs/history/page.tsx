'use client'

import { useState, useEffect } from 'react'
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
  optimalBorder: 'rgba(45,212,191,0.5)',
  watch: 'rgba(250,204,21,0.15)',
  watchBorder: 'rgba(250,204,21,0.5)',
  attention: 'rgba(251,146,60,0.15)',
  attentionBorder: 'rgba(251,146,60,0.5)',
  critical: 'rgba(248,113,113,0.15)',
  criticalBorder: 'rgba(248,113,113,0.5)',
  error: '#EF4444',
}

const fonts = {
  heading: '"Fraunces", serif',
  ui: '"Plus Jakarta Sans", sans-serif',
}

// ── Data interface ─────────────────────────────────────────────────────────────
interface BiomarkerRow {
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
  created_at: string
  flag_error: boolean
}

// ── Panel inference ────────────────────────────────────────────────────────────
// Maps marker slugs → SOURCE PANEL (Phase 1 default History view).
// Biological system grouping is preserved in canonical-dictionary.ts for the
// intelligence layer; this map is ONLY for the History presentation layer.
// Fallback: biological grouping → 'Other' (last resort).
const SLUG_TO_PANEL: Record<string, string> = {
  // ── Thyroid Panel ───────────────────────────────────────────────────────────
  tsh: 'Thyroid Panel',
  free_t4: 'Thyroid Panel',
  free_t3: 'Thyroid Panel',
  total_t3: 'Thyroid Panel',

  // ── CBC (Complete Blood Count) ──────────────────────────────────────────────
  wbc: 'CBC',
  rbc: 'CBC',
  hemoglobin: 'CBC',
  hematocrit: 'CBC',
  mcv: 'CBC',
  mch: 'CBC',
  mchc: 'CBC',
  rdw: 'CBC',
  // Platelet slugs — canonical dict uses 'platelets' and 'mpv'; keep legacy
  // aliases 'platelet_count' / 'platelet_count_abs' for backward compatibility
  platelets: 'CBC',
  platelet_count: 'CBC',
  platelet_count_abs: 'CBC',
  mpv: 'CBC',
  neutrophils_pct: 'CBC',
  neutrophils_abs: 'CBC',
  lymphocytes_pct: 'CBC',
  lymphocytes_abs: 'CBC',
  monocytes_pct: 'CBC',
  monocytes_abs: 'CBC',
  eosinophils_pct: 'CBC',
  eosinophils_abs: 'CBC',
  basophils_pct: 'CBC',
  basophils_abs: 'CBC',
  immature_granulocytes_pct: 'CBC',
  immature_granulocytes_abs: 'CBC',

  // ── Lipid Panel ─────────────────────────────────────────────────────────────
  total_cholesterol: 'Lipid Panel',
  hdl: 'Lipid Panel',
  ldl: 'Lipid Panel',
  vldl: 'Lipid Panel',
  triglycerides: 'Lipid Panel',
  non_hdl: 'Lipid Panel',
  ldl_hdl_ratio: 'Lipid Panel',
  chol_hdl_ratio: 'Lipid Panel',

  // ── CMP (Comprehensive Metabolic Panel) ─────────────────────────────────────
  // All CMP sub-components (kidney, liver, electrolytes, proteins, glycemic)
  // are consolidated here. Biological sub-grouping (Liver, Kidney, etc.) is
  // preserved in canonical-dictionary.ts for the intelligence layer only.
  //
  // Kidney / Renal sub-markers
  creatinine: 'CMP',
  bun: 'CMP',
  bun_creatinine_ratio: 'CMP',
  egfr: 'CMP',
  egfr_african_american: 'CMP',
  egfr_non_african_american: 'CMP',
  // Liver sub-markers
  ast: 'CMP',
  alt: 'CMP',
  alkaline_phosphatase: 'CMP',
  bilirubin_total: 'CMP',
  albumin: 'CMP',
  globulin: 'CMP',
  ag_ratio: 'CMP',
  total_protein: 'CMP',
  // Electrolytes & metabolic
  glucose_fasting: 'CMP',
  sodium: 'CMP',
  potassium: 'CMP',
  chloride: 'CMP',
  co2: 'CMP',
  calcium: 'CMP',
  anion_gap: 'CMP',

  // ── Hemoglobin A1c (source panel label matches lab PDF) ─────────────────────
  // Biological category is 'Glycemic' (preserved in canonical-dictionary.ts).
  // Phase 1 History source panel view uses the clinical source test name.
  hba1c: 'Hemoglobin A1c',

  // ── Glycemic (other standalone metabolic tests) ──────────────────────────────
  insulin_fasting: 'Glycemic',

  // ── Hormones ────────────────────────────────────────────────────────────────
  testosterone_total: 'Hormones',
  cortisol_am: 'Hormones',
  dhea_s: 'Hormones',

  // ── Inflammation / Cardiac Risk ─────────────────────────────────────────────
  crp_hs: 'Inflammation / Cardiac Risk',
  homocysteine: 'Inflammation / Cardiac Risk',

  // ── Vitamins & Nutrients ────────────────────────────────────────────────────
  vitamin_d: 'Vitamins & Nutrients',
  vitamin_b12: 'Vitamins & Nutrients',
  folate: 'Vitamins & Nutrients',
  magnesium: 'Vitamins & Nutrients',
  ferritin: 'Vitamins & Nutrients',
}

function inferPanel(slug: string): string {
  return SLUG_TO_PANEL[slug] ?? 'Other'
}

// Fixed panel display order within a date group (source panel view)
const PANEL_DISPLAY_ORDER = [
  'CBC',
  'Lipid Panel',
  'CMP',
  'Thyroid Panel',
  'Hemoglobin A1c',
  'Glycemic',
  'Vitamins & Nutrients',
  'Hormones',
  'Inflammation / Cardiac Risk',
  'Other',
]

function panelSortIndex(name: string): number {
  const i = PANEL_DISPLAY_ORDER.indexOf(name)
  return i === -1 ? PANEL_DISPLAY_ORDER.length : i
}

// ── Marker display names ───────────────────────────────────────────────────────
// Overrides for slugs that don't format cleanly from underscore-splitting
const NAME_OVERRIDES: Record<string, string> = {
  egfr: 'eGFR',
  egfr_african_american: 'eGFR (African American)',
  egfr_non_african_american: 'eGFR (Non-African American)',
  ldl_hdl_ratio: 'LDL/HDL Ratio',
  chol_hdl_ratio: 'Cholesterol/HDL Ratio',
  non_hdl: 'Non-HDL Cholesterol',
  hba1c: 'Hemoglobin A1c',
  crp_hs: 'hs-CRP',
  dhea_s: 'DHEA-S',
  bun: 'BUN',
  bun_creatinine_ratio: 'BUN/Creatinine Ratio',
  wbc: 'WBC',
  rbc: 'RBC',
  mcv: 'MCV',
  mch: 'MCH',
  mchc: 'MCHC',
  rdw: 'RDW',
  co2: 'CO₂ (Bicarbonate)',
  ast: 'AST',
  alt: 'ALT',
  tsh: 'TSH',
  ag_ratio: 'A/G Ratio',
  free_t4: 'Free T4',
  free_t3: 'Free T3',
  total_t3: 'Total T3',
  anion_gap: 'Anion Gap',
  cortisol_am: 'Cortisol AM',
  testosterone_total: 'Total Testosterone',
  insulin_fasting: 'Fasting Insulin',
  glucose_fasting: 'Fasting Glucose',
  vitamin_d: 'Vitamin D',
  vitamin_b12: 'Vitamin B12',
  alkaline_phosphatase: 'Alkaline Phosphatase',
  bilirubin_total: 'Total Bilirubin',
  total_protein: 'Total Protein',
  total_cholesterol: 'Total Cholesterol',
  hdl: 'HDL Cholesterol',
  ldl: 'LDL Cholesterol',
  vldl: 'VLDL Cholesterol',
}

function formatMarkerDisplayName(slug: string): string {
  if (NAME_OVERRIDES[slug]) return NAME_OVERRIDES[slug]
  return slug
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ── Date / time helpers ────────────────────────────────────────────────────────
function utcDateKey(isoString: string): string {
  return isoString.split('T')[0]
}

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' })
}

// ── Grouping types & logic ─────────────────────────────────────────────────────
interface PanelGroup {
  panel: string
  items: BiomarkerRow[]
  stateCounts: { Optimal: number; Watch: number; Attention: number; Critical: number }
}

interface DateGroup {
  dateKey: string
  label: string
  total: number
  panelCount: number
  panels: PanelGroup[]
}

interface MonthGroup {
  monthKey: string
  label: string
  dates: DateGroup[]
}

interface YearGroup {
  year: string
  months: MonthGroup[]
}

function groupRows(rows: BiomarkerRow[]): YearGroup[] {
  // Build: year → month → date → panel → items
  const yearMap = new Map<string, Map<string, Map<string, Map<string, BiomarkerRow[]>>>>()

  for (const row of rows) {
    const dateKey = utcDateKey(row.collected_at)
    const [y, m] = dateKey.split('-')
    const year = y
    const monthKey = `${y}-${m}`
    const panel = inferPanel(row.marker_name)

    if (!yearMap.has(year)) yearMap.set(year, new Map())
    const monthMap = yearMap.get(year)!
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map())
    const dateMap = monthMap.get(monthKey)!
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Map())
    const panelMap = dateMap.get(dateKey)!
    if (!panelMap.has(panel)) panelMap.set(panel, [])
    panelMap.get(panel)!.push(row)
  }

  // Convert to sorted arrays (all descending)
  return Array.from(yearMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, monthMap]) => ({
      year,
      months: Array.from(monthMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([monthKey, dateMap]) => ({
          monthKey,
          label: formatMonthLabel(monthKey),
          dates: Array.from(dateMap.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([dateKey, panelMap]) => {
              const panels: PanelGroup[] = Array.from(panelMap.entries())
                .sort(([a], [b]) => panelSortIndex(a) - panelSortIndex(b))
                .map(([panel, items]) => ({
                  panel,
                  items,
                  stateCounts: {
                    Optimal: items.filter(i => i.state === 'Optimal').length,
                    Watch: items.filter(i => i.state === 'Watch').length,
                    Attention: items.filter(i => i.state === 'Attention').length,
                    Critical: items.filter(i => i.state === 'Critical').length,
                  },
                }))
              return {
                dateKey,
                label: formatDateLabel(dateKey),
                total: Array.from(panelMap.values()).reduce((s, m) => s + m.length, 0),
                panelCount: panelMap.size,
                panels,
              }
            }),
        })),
    }))
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

// ── State badge helper ─────────────────────────────────────────────────────────
function getStateStyle(state: string | null) {
  switch (state) {
    case 'Optimal':   return { bg: colors.optimal,   border: colors.optimalBorder,   dot: '#2DD4BF', label: 'Optimal' }
    case 'Watch':     return { bg: colors.watch,     border: colors.watchBorder,     dot: '#FCD34D', label: 'Watch' }
    case 'Attention': return { bg: colors.attention, border: colors.attentionBorder, dot: '#FB923C', label: 'Attention' }
    case 'Critical':  return { bg: colors.critical,  border: colors.criticalBorder,  dot: '#F87171', label: 'Critical' }
    default:          return { bg: colors.cardBg,    border: colors.cardBorder,      dot: colors.textMuted, label: '—' }
  }
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
  biomarker: BiomarkerRow
  allBiomarkers: BiomarkerRow[]
  onClose: () => void
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const displayName = formatMarkerDisplayName(biomarker.marker_name)
  const panel       = SLUG_TO_PANEL[biomarker.marker_name] ?? null
  const s           = getStateStyle(biomarker.state)
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
export default function LabsHistoryPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [biomarkers, setBiomarkers] = useState<BiomarkerRow[]>([])
  // Tracks which panel cards are expanded: key = `${dateKey}::${panel}`
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set())
  const [selectedBiomarker, setSelectedBiomarker] = useState<BiomarkerRow | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/onboarding/welcome')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('biomarkers_static')
        .select('id, marker_name, value, unit, state, reference_range_min, reference_range_max, optimal_range_min, optimal_range_max, collected_at, created_at, flag_error')
        .eq('user_id', user.id)
        .order('collected_at', { ascending: false })
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('[Meridian] Lab history fetch error:', fetchError)
        setError('Could not load your lab history. Please try again.')
      } else {
        setBiomarkers(data || [])
      }

      setLoading(false)
    }
    load()
  }, [router, supabase])

  function togglePanel(dateKey: string, panel: string) {
    const key = `${dateKey}::${panel}`
    setExpandedPanels(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const yearGroups = groupRows(biomarkers)

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        fontFamily: fonts.ui,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '36px', height: '36px',
          border: `3px solid rgba(103,232,249,0.2)`,
          borderTopColor: colors.teal,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────────
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
          allBiomarkers={biomarkers}
          onClose={() => setSelectedBiomarker(null)}
        />
      )}

      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}18 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}18 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* ── Page header ── */}
        <h1 style={{
          fontFamily: fonts.heading,
          fontSize: 'clamp(24px, 5vw, 30px)',
          fontWeight: 700,
          color: colors.text,
          marginBottom: '6px',
          lineHeight: 1.2,
        }}>
          Lab History
        </h1>
        <p style={{ fontSize: '15px', color: colors.textSoft, marginBottom: '32px', lineHeight: 1.6 }}>
          All confirmed labs, organised by date and panel.
        </p>

        {/* ── Error state ── */}
        {error && (
          <div style={{
            padding: '20px 24px',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '14px',
            marginBottom: '24px',
          }}>
            <p style={{ fontSize: '14px', color: colors.error, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!error && yearGroups.length === 0 && (
          <div style={{
            padding: '56px 24px',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '16px',
            textAlign: 'center',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🧬</div>
            <p style={{ fontSize: '16px', color: colors.textSoft, marginBottom: '6px', fontWeight: 600 }}>
              No saved labs yet.
            </p>
            <p style={{ fontSize: '13px', color: colors.textMuted }}>
              Upload a lab PDF to see your biomarkers here.
            </p>
          </div>
        )}

        {/* ── Year sections ── */}
        {yearGroups.map(yearGroup => (
          <div key={yearGroup.year} style={{ marginBottom: '40px' }}>

            {/* Year header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
            }}>
              <span style={{
                fontFamily: fonts.heading,
                fontSize: '22px',
                fontWeight: 700,
                color: colors.text,
                letterSpacing: '-0.02em',
              }}>
                {yearGroup.year}
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: colors.cardBorder }} />
            </div>

            {/* ── Month sections ── */}
            {yearGroup.months.map(monthGroup => (
              <div key={monthGroup.monthKey} style={{ marginBottom: '28px' }}>

                {/* Month label */}
                <p style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '12px',
                }}>
                  {monthGroup.label}
                </p>

                {/* ── Date groups ── */}
                {monthGroup.dates.map(dateGroup => (
                  <div key={dateGroup.dateKey} style={{ marginBottom: '16px' }}>

                    {/* Date header row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '8px',
                      paddingLeft: '4px',
                    }}>
                      {/* Teal dot */}
                      <div style={{
                        width: '8px', height: '8px',
                        borderRadius: '50%',
                        backgroundColor: colors.teal,
                        flexShrink: 0,
                        boxShadow: `0 0 6px ${colors.teal}80`,
                      }} />
                      {/* Date label */}
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: colors.teal,
                        letterSpacing: '0.02em',
                      }}>
                        {dateGroup.label}
                      </span>
                      {/* Counts */}
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>
                        {dateGroup.total} {dateGroup.total === 1 ? 'biomarker' : 'biomarkers'}
                        {' · '}
                        {dateGroup.panelCount} {dateGroup.panelCount === 1 ? 'panel' : 'panels'}
                      </span>
                    </div>

                    {/* ── Panel cards ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {dateGroup.panels.map(panelGroup => {
                        const panelKey = `${dateGroup.dateKey}::${panelGroup.panel}`
                        const isOpen = expandedPanels.has(panelKey)
                        const sc = panelGroup.stateCounts

                        return (
                          <div
                            key={panelGroup.panel}
                            style={{
                              backgroundColor: colors.cardBg,
                              border: `1px solid ${colors.cardBorder}`,
                              borderRadius: '14px',
                              backdropFilter: 'blur(24px)',
                              WebkitBackdropFilter: 'blur(24px)',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Panel header — always visible, click to toggle */}
                            <button
                              onClick={() => togglePanel(dateGroup.dateKey, panelGroup.panel)}
                              style={{
                                width: '100%',
                                padding: '14px 18px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              {/* Panel name */}
                              <span style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: colors.text,
                                flex: 1,
                                minWidth: 0,
                              }}>
                                {panelGroup.panel}
                              </span>

                              {/* Biomarker count */}
                              <span style={{
                                fontSize: '12px',
                                color: colors.textMuted,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}>
                                {panelGroup.items.length} {panelGroup.items.length === 1 ? 'marker' : 'markers'}
                              </span>

                              {/* State summary dots */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                {sc.Optimal > 0 && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#2DD4BF' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2DD4BF', display: 'inline-block' }} />
                                    {sc.Optimal}
                                  </span>
                                )}
                                {sc.Watch > 0 && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#FCD34D' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FCD34D', display: 'inline-block' }} />
                                    {sc.Watch}
                                  </span>
                                )}
                                {sc.Attention > 0 && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#FB923C' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FB923C', display: 'inline-block' }} />
                                    {sc.Attention}
                                  </span>
                                )}
                                {sc.Critical > 0 && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#F87171' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F87171', display: 'inline-block' }} />
                                    {sc.Critical}
                                  </span>
                                )}
                              </div>

                              {/* Chevron */}
                              <svg
                                width="16" height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                style={{
                                  flexShrink: 0,
                                  transition: 'transform 0.2s ease',
                                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                }}
                              >
                                <path d="M4 6l4 4 4-4" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>

                            {/* Expanded biomarker rows */}
                            {isOpen && (
                              <div style={{
                                borderTop: `1px solid ${colors.cardBorder}`,
                                padding: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}>
                                {panelGroup.items.map((b) => {
                                  const s = getStateStyle(b.state)
                                  const showBar = !b.flag_error && isUsableRange(b.reference_range_min, b.reference_range_max)

                                  if (showBar) {
                                    return (
                                      <div key={b.id} style={{
                                        backgroundColor: 'rgba(232,248,245,0.055)',
                                        border: `1px solid ${s.dot}30`,
                                        borderRadius: '10px',
                                        padding: '12px 14px',
                                        cursor: 'pointer',
                                      }} onClick={() => setSelectedBiomarker(b)}>
                                        {/* Name + badge */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                                          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, flex: 1, minWidth: 0 }}>
                                            {formatMarkerDisplayName(b.marker_name)}
                                          </span>
                                          {b.state && (
                                            <span style={{
                                              padding: '2px 8px',
                                              backgroundColor: s.bg,
                                              border: `1px solid ${s.border}`,
                                              borderRadius: '5px',
                                              fontSize: '10px',
                                              fontWeight: 700,
                                              color: s.dot,
                                              letterSpacing: '0.04em',
                                              flexShrink: 0,
                                            }}>
                                              {s.label}
                                            </span>
                                          )}
                                        </div>
                                        {/* Value */}
                                        <div style={{ marginBottom: '4px' }}>
                                          <span style={{ fontSize: '22px', fontWeight: 800, color: colors.text, lineHeight: '1' }}>
                                            {b.value}
                                          </span>
                                          {b.unit && (
                                            <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: '5px' }}>
                                              {b.unit}
                                            </span>
                                          )}
                                        </div>
                                        {/* Range bar */}
                                        <BiomarkerRangeBar
                                          value={b.value}
                                          refMin={b.reference_range_min!}
                                          refMax={b.reference_range_max!}
                                          state={b.state}
                                        />
                                      </div>
                                    )
                                  }

                                  return (
                                    <div key={b.id} style={{
                                      padding: '10px 14px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '8px',
                                      flexWrap: 'wrap',
                                      backgroundColor: b.flag_error ? 'rgba(248,113,113,0.06)' : 'rgba(232,248,245,0.03)',
                                      border: `1px solid ${colors.cardBorder}`,
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                    }} onClick={() => setSelectedBiomarker(b)}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, minWidth: '130px' }}>
                                        <div style={{
                                          width: '6px', height: '6px',
                                          borderRadius: '50%',
                                          backgroundColor: b.flag_error ? colors.error : s.dot,
                                          flexShrink: 0,
                                        }} />
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>
                                          {formatMarkerDisplayName(b.marker_name)}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <span style={{ fontSize: '15px', fontWeight: 700, color: colors.text }}>{b.value}</span>
                                        {b.unit && <span style={{ fontSize: '11px', color: colors.textMuted }}>{b.unit}</span>}
                                        {b.flag_error ? (
                                          <span style={{
                                            padding: '2px 7px',
                                            backgroundColor: colors.critical,
                                            border: `1px solid ${colors.criticalBorder}`,
                                            borderRadius: '5px',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: '#F87171',
                                            letterSpacing: '0.04em',
                                          }}>
                                            FLAGGED
                                          </span>
                                        ) : b.state && (
                                          <span style={{
                                            padding: '2px 7px',
                                            backgroundColor: s.bg,
                                            border: `1px solid ${s.border}`,
                                            borderRadius: '5px',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: s.dot,
                                            letterSpacing: '0.04em',
                                          }}>
                                            {s.label}
                                          </span>
                                        )}
                                        <span style={{ fontSize: '14px', color: colors.textMuted, opacity: 0.45, lineHeight: 1 }}>›</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        {/* ── Footer summary ── */}
        {yearGroups.length > 0 && (
          <p style={{
            fontSize: '12px',
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: '8px',
          }}>
            {biomarkers.length} total biomarkers · {yearGroups.length} {yearGroups.length === 1 ? 'year' : 'years'} of data
          </p>
        )}

      </div>
      <NavBar />
    </div>
  )
}
