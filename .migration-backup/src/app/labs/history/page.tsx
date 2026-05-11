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
  collected_at: string
  created_at: string
  flag_error: boolean
}

// ── Panel inference ────────────────────────────────────────────────────────────
// Maps marker slugs → panel category. First matching panel wins.
// Order here does not affect priority; SLUG_TO_PANEL is a flat lookup.
const SLUG_TO_PANEL: Record<string, string> = {
  // Thyroid
  tsh: 'Thyroid',
  free_t4: 'Thyroid',
  free_t3: 'Thyroid',
  total_t3: 'Thyroid',

  // CBC — blood cell counts
  wbc: 'CBC',
  rbc: 'CBC',
  hemoglobin: 'CBC',
  hematocrit: 'CBC',
  mcv: 'CBC',
  mch: 'CBC',
  mchc: 'CBC',
  rdw: 'CBC',
  platelet_count: 'CBC',
  platelet_count_abs: 'CBC',
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

  // Glycemic — metabolic glucose markers
  hba1c: 'Glycemic',
  insulin_fasting: 'Glycemic',

  // Lipid Panel
  total_cholesterol: 'Lipid Panel',
  hdl: 'Lipid Panel',
  ldl: 'Lipid Panel',
  vldl: 'Lipid Panel',
  triglycerides: 'Lipid Panel',
  non_hdl: 'Lipid Panel',
  ldl_hdl_ratio: 'Lipid Panel',
  chol_hdl_ratio: 'Lipid Panel',

  // Hormones
  testosterone_total: 'Hormones',
  cortisol_am: 'Hormones',
  dhea_s: 'Hormones',

  // Inflammation / Cardiac Risk
  crp_hs: 'Inflammation / Cardiac Risk',
  homocysteine: 'Inflammation / Cardiac Risk',

  // Vitamins & Nutrients
  vitamin_d: 'Vitamins & Nutrients',
  vitamin_b12: 'Vitamins & Nutrients',
  folate: 'Vitamins & Nutrients',
  magnesium: 'Vitamins & Nutrients',
  ferritin: 'Vitamins & Nutrients',

  // Kidney / Renal — deduplicated from CMP
  creatinine: 'Kidney / Renal',
  bun: 'Kidney / Renal',
  bun_creatinine_ratio: 'Kidney / Renal',
  egfr: 'Kidney / Renal',
  egfr_african_american: 'Kidney / Renal',
  egfr_non_african_american: 'Kidney / Renal',

  // Liver — deduplicated from CMP
  ast: 'Liver',
  alt: 'Liver',
  alkaline_phosphatase: 'Liver',
  bilirubin_total: 'Liver',
  albumin: 'Liver',
  globulin: 'Liver',
  ag_ratio: 'Liver',
  total_protein: 'Liver',

  // CMP — remaining electrolytes & metabolic markers
  glucose_fasting: 'CMP',
  sodium: 'CMP',
  potassium: 'CMP',
  chloride: 'CMP',
  co2: 'CMP',
  calcium: 'CMP',
  anion_gap: 'CMP',
}

function inferPanel(slug: string): string {
  return SLUG_TO_PANEL[slug] ?? 'Other'
}

// Fixed panel display order within a date group
const PANEL_DISPLAY_ORDER = [
  'CBC',
  'Lipid Panel',
  'CMP',
  'Kidney / Renal',
  'Liver',
  'Glycemic',
  'Thyroid',
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
    case 'Optimal':   return '#2DD4BF'
    case 'Watch':     return '#FACC15'
    case 'Attention': return '#FB923C'
    case 'Critical':  return '#F87171'
    default:          return '#67E8F9'
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
  const span   = refMax - refMin
  const buffer = span * 0.25
  const visMin = refMin - buffer
  const visMax = refMax + buffer
  const visSp  = visMax - visMin

  const refStartPct = ((refMin - visMin) / visSp) * 100
  const refEndPct   = ((refMax - visMin) / visSp) * 100
  const rawPct      = ((value  - visMin) / visSp) * 100
  const dotPct      = Math.max(0, Math.min(100, rawPct))
  const dotColor    = getStateColor(state)

  return (
    <div style={{ width: '100%', paddingTop: '8px', paddingBottom: '2px' }}>
      <div style={{ position: 'relative', height: '6px', backgroundColor: 'rgba(103,232,249,0.07)', borderRadius: '4px', width: '100%' }}>
        {/* Reference range band */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${refStartPct}%`,
          width: `${refEndPct - refStartPct}%`,
          backgroundColor: 'rgba(103,232,249,0.20)',
          borderRadius: '2px',
        }} />
        {/* Value dot */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: `${dotPct}%`,
          transform: 'translate(-50%, -50%)',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: dotColor,
          boxShadow: `0 0 5px ${dotColor}90`,
          zIndex: 1,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
        <span style={{ fontSize: '9px', color: 'rgba(95,142,133,0.65)', letterSpacing: '0.04em' }}>Low</span>
        <span style={{ fontSize: '9px', color: 'rgba(95,142,133,0.65)', letterSpacing: '0.04em' }}>High</span>
      </div>
    </div>
  )
}

// ── State badge helper ─────────────────────────────────────────────────────────
function getStateStyle(state: string | null) {
  switch (state) {
    case 'Optimal':   return { bg: colors.optimal,   border: colors.optimalBorder,   dot: '#2DD4BF', label: 'Optimal' }
    case 'Watch':     return { bg: colors.watch,     border: colors.watchBorder,     dot: '#FACC15', label: 'Watch' }
    case 'Attention': return { bg: colors.attention, border: colors.attentionBorder, dot: '#FB923C', label: 'Attention' }
    case 'Critical':  return { bg: colors.critical,  border: colors.criticalBorder,  dot: '#F87171', label: 'Critical' }
    default:          return { bg: colors.cardBg,    border: colors.cardBorder,      dot: colors.textMuted, label: '—' }
  }
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/onboarding/welcome')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('biomarkers_static')
        .select('id, marker_name, value, unit, state, reference_range_min, reference_range_max, collected_at, created_at, flag_error')
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
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#FACC15' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FACC15', display: 'inline-block' }} />
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
                              <div style={{ borderTop: `1px solid ${colors.cardBorder}` }}>
                                {panelGroup.items.map((b, idx) => {
                                  const s = getStateStyle(b.state)
                                  const isLast = idx === panelGroup.items.length - 1
                                  const hasRef = b.reference_range_min !== null && b.reference_range_max !== null

                                  const showBar = !b.flag_error && isUsableRange(b.reference_range_min, b.reference_range_max)

                                  return (
                                    <div
                                      key={b.id}
                                      style={{
                                        padding: '12px 18px',
                                        borderBottom: isLast ? 'none' : `1px solid ${colors.cardBorder}`,
                                        backgroundColor: b.flag_error ? 'rgba(248,113,113,0.06)' : 'transparent',
                                      }}
                                    >
                                      {/* Name + value row */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                        {/* Left: name + ref range */}
                                        <div style={{ flex: 1, minWidth: '130px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
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
                                          {hasRef && (
                                            <span style={{
                                              fontSize: '11px',
                                              color: colors.textMuted,
                                              paddingLeft: '13px',
                                              display: 'block',
                                              marginTop: '2px',
                                            }}>
                                              Ref {b.reference_range_min}–{b.reference_range_max} {b.unit}
                                            </span>
                                          )}
                                        </div>

                                        {/* Right: value + unit + state badge */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                          <span style={{ fontSize: '16px', fontWeight: 700, color: colors.text }}>
                                            {b.value}
                                          </span>
                                          {b.unit && (
                                            <span style={{ fontSize: '11px', color: colors.textMuted }}>
                                              {b.unit}
                                            </span>
                                          )}
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
                                        </div>
                                      </div>

                                      {/* Range bar */}
                                      {showBar && (
                                        <BiomarkerRangeBar
                                          value={b.value}
                                          refMin={b.reference_range_min!}
                                          refMax={b.reference_range_max!}
                                          state={b.state}
                                        />
                                      )}
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
