'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar from '@/components/NavBar'
import { getSafetyStatusForBiomarker } from '@/lib/safety-engine'
import { getNextOnboardingStep } from '@/lib/onboarding'

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
  reference_range?: string
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
  // Phase 1 hardening: harmonized with history page ('Thyroid Panel' not 'Thyroid')
  tsh: 'Thyroid Panel', free_t4: 'Thyroid Panel', free_t3: 'Thyroid Panel', total_t3: 'Thyroid Panel',
  wbc: 'CBC', rbc: 'CBC', hemoglobin: 'CBC', hematocrit: 'CBC',
  mcv: 'CBC', mch: 'CBC', mchc: 'CBC', rdw: 'CBC',
  // Phase 1 hardening: added canonical 'platelets' + 'mpv' slugs alongside legacy aliases
  platelets: 'CBC', platelet_count: 'CBC', platelet_count_abs: 'CBC',
  mpv: 'CBC',
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
  'Glycemic', 'Thyroid Panel', 'Vitamins & Nutrients',
  'Hormones', 'Inflammation / Cardiac Risk', 'Other',
]

// ── Snapshot view mode ────────────────────────────────────────────────────────
type SnapshotViewMode = 'clinical_panels' | 'signal_map'

// How many Optimal markers to show before progressive disclosure
const OPTIMAL_SHOW_LIMIT = 5

// Marker state sort priority (Critical first)
const SNAPSHOT_STATE_SORT: Record<string, number> = { Critical: 0, Attention: 1, Watch: 2, Optimal: 3 }

// ── Clinical Panels mapping ───────────────────────────────────────────────────
const CLINICAL_SLUG_TO_PANEL: Record<string, string> = {
  // CBC
  wbc: 'CBC', rbc: 'CBC', hemoglobin: 'CBC', hematocrit: 'CBC',
  mcv: 'CBC', mch: 'CBC', mchc: 'CBC', rdw: 'CBC',
  platelets: 'CBC', platelet_count: 'CBC', platelet_count_abs: 'CBC', mpv: 'CBC',
  neutrophils_pct: 'CBC', neutrophils_abs: 'CBC',
  lymphocytes_pct: 'CBC', lymphocytes_abs: 'CBC',
  monocytes_pct: 'CBC', monocytes_abs: 'CBC',
  eosinophils_pct: 'CBC', eosinophils_abs: 'CBC',
  basophils_pct: 'CBC', basophils_abs: 'CBC',
  immature_granulocytes_pct: 'CBC', immature_granulocytes_abs: 'CBC',
  // Comprehensive Metabolic Panel
  bun: 'Comprehensive Metabolic Panel', creatinine: 'Comprehensive Metabolic Panel',
  egfr: 'Comprehensive Metabolic Panel', egfr_african_american: 'Comprehensive Metabolic Panel',
  egfr_non_african_american: 'Comprehensive Metabolic Panel',
  bun_creatinine_ratio: 'Comprehensive Metabolic Panel',
  sodium: 'Comprehensive Metabolic Panel', potassium: 'Comprehensive Metabolic Panel',
  chloride: 'Comprehensive Metabolic Panel', co2: 'Comprehensive Metabolic Panel',
  calcium: 'Comprehensive Metabolic Panel', total_protein: 'Comprehensive Metabolic Panel',
  albumin: 'Comprehensive Metabolic Panel', globulin: 'Comprehensive Metabolic Panel',
  ag_ratio: 'Comprehensive Metabolic Panel', bilirubin_total: 'Comprehensive Metabolic Panel',
  alkaline_phosphatase: 'Comprehensive Metabolic Panel',
  ast: 'Comprehensive Metabolic Panel', alt: 'Comprehensive Metabolic Panel',
  glucose_fasting: 'Comprehensive Metabolic Panel',
  // Lipid Panel
  total_cholesterol: 'Lipid Panel', hdl: 'Lipid Panel', ldl: 'Lipid Panel',
  vldl: 'Lipid Panel', non_hdl: 'Lipid Panel', triglycerides: 'Lipid Panel',
  ldl_hdl_ratio: 'Lipid Panel', chol_hdl_ratio: 'Lipid Panel',
  // Glycemic Panel
  hba1c: 'Glycemic Panel', insulin_fasting: 'Glycemic Panel',
  // Thyroid Panel
  tsh: 'Thyroid Panel', free_t4: 'Thyroid Panel', free_t3: 'Thyroid Panel', total_t3: 'Thyroid Panel',
  tpo_antibodies: 'Thyroid Panel',
  // Vitamin & Nutrient Panel
  vitamin_d: 'Vitamin & Nutrient Panel', vitamin_b12: 'Vitamin & Nutrient Panel',
  folate: 'Vitamin & Nutrient Panel', magnesium: 'Vitamin & Nutrient Panel',
  // Iron Panel
  ferritin: 'Iron Panel',
  // Hormone Panel
  testosterone_total: 'Hormone Panel', dhea_s: 'Hormone Panel', cortisol_am: 'Hormone Panel',
  acth: 'Hormone Panel',
  // Inflammation Markers
  crp_hs: 'Inflammation Markers', homocysteine: 'Inflammation Markers',
}

const CLINICAL_PANEL_ORDER = [
  'CBC', 'Comprehensive Metabolic Panel', 'Lipid Panel', 'Glycemic Panel',
  'Thyroid Panel', 'Vitamin & Nutrient Panel', 'Iron Panel', 'Hormone Panel',
  'Inflammation Markers', 'Other',
]

const CLINICAL_PANEL_EDUCATION: Record<string, string> = {
  'CBC':                           'Complete blood count — cell counts and indices that reflect immune health, oxygen transport, and clotting.',
  'Comprehensive Metabolic Panel': 'Metabolic, kidney, liver, and electrolyte markers that map your body\'s chemical balance.',
  'Lipid Panel':                   'Cholesterol transport and cardiovascular risk signals over time.',
  'Glycemic Panel':                'Blood sugar regulation and longer-term glucose control patterns.',
  'Thyroid Panel':                 'Thyroid hormone signaling that influences metabolism, energy, and recovery.',
  'Vitamin & Nutrient Panel':      'Micronutrient status and possible support needs over time.',
  'Iron Panel':                    'Iron storage and supply markers relevant to energy and blood health.',
  'Hormone Panel':                 'Hormonal signals related to energy, recovery, cycle patterns, and stress.',
  'Inflammation Markers':          'Inflammation signals relevant to cardiovascular and systemic risk context.',
  'Other':                         'Additional markers that add context to your biological profile.',
}

// ── Signal Map mapping ────────────────────────────────────────────────────────
const SIGNAL_SLUG_TO_LAYER: Record<string, string> = {
  // Cardiovascular
  total_cholesterol: 'Cardiovascular', hdl: 'Cardiovascular', ldl: 'Cardiovascular',
  vldl: 'Cardiovascular', non_hdl: 'Cardiovascular', triglycerides: 'Cardiovascular',
  ldl_hdl_ratio: 'Cardiovascular', chol_hdl_ratio: 'Cardiovascular', homocysteine: 'Cardiovascular',
  // Metabolic
  glucose_fasting: 'Metabolic', hba1c: 'Metabolic', insulin_fasting: 'Metabolic',
  sodium: 'Metabolic', potassium: 'Metabolic', chloride: 'Metabolic', co2: 'Metabolic', calcium: 'Metabolic',
  // Renal / Filtration
  egfr: 'Renal / Filtration', egfr_african_american: 'Renal / Filtration',
  egfr_non_african_american: 'Renal / Filtration',
  creatinine: 'Renal / Filtration', bun: 'Renal / Filtration', bun_creatinine_ratio: 'Renal / Filtration',
  // Liver
  ast: 'Liver', alt: 'Liver', alkaline_phosphatase: 'Liver',
  bilirubin_total: 'Liver', albumin: 'Liver', total_protein: 'Liver',
  globulin: 'Liver', ag_ratio: 'Liver',
  // Thyroid / Energy
  tsh: 'Thyroid / Energy', free_t4: 'Thyroid / Energy', free_t3: 'Thyroid / Energy', total_t3: 'Thyroid / Energy',
  // Blood / Oxygen
  hemoglobin: 'Blood / Oxygen', hematocrit: 'Blood / Oxygen', rbc: 'Blood / Oxygen',
  mcv: 'Blood / Oxygen', mch: 'Blood / Oxygen', mchc: 'Blood / Oxygen', rdw: 'Blood / Oxygen',
  platelets: 'Blood / Oxygen', platelet_count: 'Blood / Oxygen', platelet_count_abs: 'Blood / Oxygen', mpv: 'Blood / Oxygen',
  // Immune
  wbc: 'Immune',
  neutrophils_pct: 'Immune', neutrophils_abs: 'Immune',
  lymphocytes_pct: 'Immune', lymphocytes_abs: 'Immune',
  monocytes_pct: 'Immune', monocytes_abs: 'Immune',
  eosinophils_pct: 'Immune', eosinophils_abs: 'Immune',
  basophils_pct: 'Immune', basophils_abs: 'Immune',
  immature_granulocytes_pct: 'Immune', immature_granulocytes_abs: 'Immune',
  // Vitamins & Nutrients
  vitamin_d: 'Vitamins & Nutrients', vitamin_b12: 'Vitamins & Nutrients',
  folate: 'Vitamins & Nutrients', magnesium: 'Vitamins & Nutrients', ferritin: 'Vitamins & Nutrients',
  // Hormones
  testosterone_total: 'Hormones', dhea_s: 'Hormones', cortisol_am: 'Hormones',
  // Inflammation
  crp_hs: 'Inflammation',
}

const SIGNAL_LAYER_ORDER = [
  'Cardiovascular', 'Metabolic', 'Renal / Filtration', 'Liver', 'Thyroid / Energy',
  'Blood / Oxygen', 'Immune', 'Vitamins & Nutrients', 'Hormones', 'Inflammation', 'Urinary', 'Other',
]

const SIGNAL_LAYER_EDUCATION: Record<string, string> = {
  'Cardiovascular':       'Lipid transport, vascular risk signals, and cardiovascular context.',
  'Metabolic':            'Blood sugar regulation, electrolyte balance, and energy metabolism.',
  'Renal / Filtration':   'Kidney filtration capacity and waste-clearance markers.',
  'Liver':                'Liver enzyme patterns and protein metabolism context.',
  'Thyroid / Energy':     'Thyroid hormone signaling for metabolism, energy, and recovery.',
  'Blood / Oxygen':       'Red cell indices, oxygen transport, and platelet markers.',
  'Immune':               'White cell counts and immune cell distribution patterns.',
  'Vitamins & Nutrients': 'Micronutrient status and possible support needs over time.',
  'Hormones':             'Hormonal signals related to energy, recovery, and stress.',
  'Inflammation':         'Systemic inflammation signals and cardiovascular risk context.',
  'Urinary':              'Kidney and urinary tract markers.',
  'Other':                'Additional markers that add context to your biological profile.',
}

const PANEL_EDUCATION: Record<string, string> = {
  'CBC':                      'This panel helps Meridian understand blood cell patterns, oxygen-carrying capacity, and immune cell context.',
  'CMP':                      'This panel gives context on metabolism, electrolytes, kidney markers, liver enzymes, and protein balance.',
  'Lipid Panel':              'This panel helps Meridian understand cholesterol transport and cardiovascular risk signals over time.',
  'Thyroid Panel':            'This panel gives context on thyroid signaling, metabolism, energy, and recovery patterns.',
  'Glycemic':                 'This panel helps Meridian understand blood sugar regulation and longer-term glucose trends.',
  'Kidney / Renal':           'This panel gives context on filtration, hydration balance, and kidney-related markers.',
  'Liver':                    'This panel helps Meridian understand liver enzyme patterns and protein metabolism context.',
  'Urinalysis':               'This panel adds context on hydration, kidney/urinary markers, and qualitative urine findings.',
  'Vitamins & Nutrients':     'This panel helps Meridian understand nutrient status and possible support needs over time.',
  'Hormones':                 'This panel gives context on hormonal signals that may relate to energy, recovery, cycle patterns, and stress.',
  'Inflammation / Cardiac Risk': 'This panel helps Meridian understand inflammation and cardiovascular signal context.',
  'Other':                    'This panel adds context to your broader biological profile.',
}

// ── OCR artifact / worksheet code detection ────────────────────────────────────
// Patterns like "A1C-W2", "HB-W2" are PDF layout codes or OCR artifacts,
// not clinical biomarker names. They should not appear as pending biomarkers.
function isOcrArtifact(name: string): boolean {
  const t = name.trim()
  // Short alphanumeric prefix + hyphen + letter + 1–3 digits (e.g. "A1C-W2", "HB-W2")
  if (/^[A-Za-z0-9]{1,8}-[A-Za-z][0-9]{1,3}$/.test(t)) return true
  // Bare codes: single letter + 1–2 digits only (e.g. "W2", "R3", "N1")
  if (/^[A-Z][0-9]{1,2}$/.test(t)) return true
  return false
}

// ── Urinalysis qualitative marker detection ───────────────────────────────────
// Qualitative/dipstick urine markers should not be treated as numeric serum
// biomarkers in the upload review. This prevents scary "Value null..." errors
// and stops non-numeric values from being saved to biomarkers_static.
// Conservative matching: unambiguous urinalysis markers only.
// WBC/RBC alone are NOT matched here (ambiguous: serum vs. urine sediment).
function isLikelyQualitativeUrinalysis(name: string): boolean {
  const lower = name.toLowerCase().trim()
  const exact = new Set([
    'color', 'colour', 'appearance', 'clarity', 'turbidity',
    'nitrite', 'nitrites', 'leukocyte esterase',
    'urobilinogen', 'epithelial cells', 'squamous epithelial cells',
    'bacteria', 'mucus', 'crystals', 'casts', 'ketones', 'acetone',
    // pH — urinalysis only (bare "ph" is safe; serum pH is rare and not in standard panels)
    'ph', 'urine ph',
    'urine glucose', 'urine protein', 'urine blood',
    'urine nitrite', 'urine bilirubin', 'urine urobilinogen',
    'glucose, urine', 'protein, urine', 'bilirubin, urine', 'blood, urine',
    'rbc, urine', 'wbc, urine', 'rbc/hpf', 'wbc/hpf',
    'red blood cells, urine', 'white blood cells, urine',
    'specific gravity', 'urine specific gravity',
  ])
  if (exact.has(lower)) return true
  const unambiguous = [
    'specific gravity', 'leukocyte esterase', 'urobilinogen',
    'squamous epithelial', 'granular cast', 'hyaline cast', 'urine sediment',
  ]
  for (const u of unambiguous) {
    if (lower.includes(u)) return true
  }
  return false
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

// ── Phase 1 Watch guardrail: systemic / calculated markers ────────────────────
// Systemic markers are those whose clinical reference range is well-established and
// whose Watch state is frequently triggered only because the value sits outside
// Meridian's narrower optimal range — not because it is clinically out of range.
// When the value is inside the clinical reference range, we suppress Watch in the
// display layer so the marker does not surface as Needs Attention.
// Preventive/optimization markers (lipids, glycemic, vitamins, hormones, CRP, TSH)
// are intentionally excluded — Watch is meaningful for those regardless.
// No database values are changed; this is display-only.
const SYSTEMIC_MARKERS = new Set([
  'anion_gap', 'sodium', 'potassium', 'chloride', 'co2', 'calcium',
  'creatinine', 'egfr', 'bun', 'bun_creatinine_ratio',
  'ast', 'alt', 'alkaline_phosphatase', 'bilirubin_total',
  'albumin', 'globulin', 'total_protein', 'ag_ratio',
])

function effectiveSnapshotState(b: RecentBiomarker): string | null {
  if (
    b.state === 'Watch' &&
    SYSTEMIC_MARKERS.has(b.marker_name.toLowerCase().replace(/[\s-]+/g, '_')) &&
    b.reference_range_min !== null && b.reference_range_max !== null &&
    Number.isFinite(b.reference_range_min) && Number.isFinite(b.reference_range_max) &&
    b.reference_range_min < b.reference_range_max &&
    b.value >= b.reference_range_min && b.value <= b.reference_range_max
  ) {
    return 'Optimal'
  }
  return b.state
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

// ── Range direction helper ─────────────────────────────────────────────────────
// Determines the correct visual interpretation for a biomarker's range bar.
// middle_is_best: low and high edges are both unfavorable (CBC, CMP, electrolytes, thyroid)
// lower_is_better: controlled/low is favorable (LDL, triglycerides, A1c, glucose, CRP)
// higher_is_better: adequate/high is favorable (HDL, eGFR, vitamin D)
// unknown: no clear direction — suppress bar rather than show misleading gradient
type RangeDirection = 'middle_is_best' | 'lower_is_better' | 'higher_is_better' | 'unknown'

const LOWER_IS_BETTER_SLUGS = new Set([
  'ldl', 'ldl_cholesterol', 'triglycerides', 'total_cholesterol', 'non_hdl', 'non_hdl_cholesterol',
  'hba1c', 'hemoglobin_a1c',
  'glucose_fasting', 'fasting_glucose',
  'insulin_fasting', 'fasting_insulin',
  'hs_crp', 'crp_hs',
  'homocysteine',
])
const HIGHER_IS_BETTER_SLUGS = new Set([
  'hdl', 'hdl_cholesterol',
  'egfr', 'egfr_african_american', 'egfr_non_african_american',
  'vitamin_d', 'vitamin_b12',
])
const MIDDLE_IS_BEST_SLUGS = new Set([
  // Electrolytes / BMP / CMP
  'sodium', 'potassium', 'chloride', 'co2', 'calcium', 'anion_gap',
  'creatinine', 'bun', 'bun_creatinine_ratio',
  'ast', 'alt', 'alkaline_phosphatase', 'bilirubin_total',
  'albumin', 'globulin', 'total_protein', 'ag_ratio',
  // Thyroid
  'tsh', 'free_t4', 'free_t3', 'total_t3', 'tpo_antibodies',
  // CBC
  'wbc', 'rbc', 'hemoglobin', 'hematocrit', 'mcv', 'mch', 'mchc', 'rdw', 'mpv',
  'platelets', 'platelet_count', 'platelet_count_abs',
  'neutrophils_pct', 'neutrophils_abs',
  'lymphocytes_pct', 'lymphocytes_abs',
  'monocytes_pct', 'monocytes_abs',
  'eosinophils_pct', 'eosinophils_abs',
  'basophils_pct', 'basophils_abs',
  'immature_granulocytes_pct', 'immature_granulocytes_abs',
  // Hormones / adrenal (u-shaped by nature)
  'tsh', 'cortisol_am', 'dhea_s', 'testosterone_total', 'acth',
])

function getRangeDirection(slug: string): RangeDirection {
  const s = slug.toLowerCase().replace(/[\s-]+/g, '_')
  if (LOWER_IS_BETTER_SLUGS.has(s))  return 'lower_is_better'
  if (HIGHER_IS_BETTER_SLUGS.has(s)) return 'higher_is_better'
  if (MIDDLE_IS_BEST_SLUGS.has(s))   return 'middle_is_best'
  return 'unknown'
}

// Gradient definitions — each direction gets its own track color
const TRACK_MIDDLE_IS_BEST = 'linear-gradient(to right, rgba(248,113,113,0.65) 0%, rgba(251,146,60,0.50) 20%, rgba(45,212,191,0.72) 50%, rgba(251,146,60,0.50) 80%, rgba(248,113,113,0.65) 100%)'
const TRACK_LOWER_IS_BETTER = 'linear-gradient(to right, rgba(45,212,191,0.72) 0%, rgba(103,232,249,0.55) 28%, rgba(251,146,60,0.50) 68%, rgba(248,113,113,0.65) 100%)'
const TRACK_HIGHER_IS_BETTER = 'linear-gradient(to right, rgba(248,113,113,0.65) 0%, rgba(251,146,60,0.50) 32%, rgba(103,232,249,0.55) 72%, rgba(45,212,191,0.72) 100%)'
const TRACK_UNKNOWN = 'linear-gradient(to right, rgba(95,142,133,0.20) 0%, rgba(95,142,133,0.32) 50%, rgba(95,142,133,0.20) 100%)'

interface RangeBarProps {
  value: number
  refMin: number
  refMax: number
  state: string | null
  slug?: string
}

function BiomarkerRangeBar({ value, refMin, refMax, state, slug }: RangeBarProps) {
  const rawPct   = ((value - refMin) / (refMax - refMin)) * 100
  const dotPct   = Math.max(0, Math.min(100, rawPct))
  const dotColor = getStateColor(state)
  const dir      = slug ? getRangeDirection(slug) : 'unknown'

  const trackGradient = dir === 'lower_is_better'  ? TRACK_LOWER_IS_BETTER
                      : dir === 'higher_is_better' ? TRACK_HIGHER_IS_BETTER
                      : dir === 'middle_is_best'   ? TRACK_MIDDLE_IS_BEST
                      : TRACK_UNKNOWN

  // Label semantics differ by direction
  const labelLeft  = dir === 'lower_is_better'  ? 'Lower'
                   : dir === 'higher_is_better' ? 'Low'
                   : dir === 'middle_is_best'   ? 'Low'
                   : null
  const labelRight = dir === 'lower_is_better'  ? 'Higher'
                   : dir === 'higher_is_better' ? 'Higher'
                   : dir === 'middle_is_best'   ? 'High'
                   : null

  const labelStyle: React.CSSProperties = { fontSize: '9px', color: 'rgba(95,142,133,0.7)', letterSpacing: '0.04em' }

  return (
    <div style={{ width: '100%', paddingTop: '6px' }}>
      <div style={{
        position: 'relative', height: '8px', borderRadius: '6px', width: '100%',
        background: trackGradient,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.28)',
        overflow: 'visible',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: `${dotPct}%`,
          transform: 'translate(-50%, -50%)',
          width: '16px', height: '16px', borderRadius: '50%',
          backgroundColor: dotColor,
          border: '2px solid rgba(255,255,255,0.22)',
          boxShadow: `0 0 10px ${dotColor}88, 0 0 4px ${dotColor}48, inset 0 1px 0 rgba(255,255,255,0.24)`,
          zIndex: 2,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
        {labelLeft  ? <span style={labelStyle}>{labelLeft}</span>  : <span />}
        <span style={{
          fontSize: '9px', color: 'rgba(154,203,193,0.65)',
          backgroundColor: 'rgba(103,232,249,0.05)',
          border: '1px solid rgba(103,232,249,0.10)',
          borderRadius: '20px', padding: '1px 7px', letterSpacing: '0.02em',
        }}>
          Ref {refMin}–{refMax}
        </span>
        {labelRight ? <span style={labelStyle}>{labelRight}</span> : <span />}
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

// ── Micro-intelligence layer ───────────────────────────────────────────────────
interface BiomarkerIntel { why: string; context: string }
const BIOMARKER_CONTEXT: Record<string, BiomarkerIntel> = {
  // ── Thyroid ─────────────────────────────────────────────────────────────────
  tsh: {
    why: 'TSH helps Meridian understand thyroid signaling, metabolic rate, and the body\'s energy regulation patterns over time.',
    context: 'Meridian evaluates this alongside free T3, T4, cortisol, and metabolic markers for a fuller picture.',
  },
  free_t4: {
    why: 'Free T4 reflects the available form of thyroxine and influences metabolism, temperature regulation, and sustained energy.',
    context: 'This signal becomes more meaningful when combined with TSH and T3 trends over time.',
  },
  free_t3: {
    why: 'Free T3 is the active thyroid hormone that drives cellular energy use and metabolic adaptation.',
    context: 'Meridian tracks this alongside TSH and T4 to understand thyroid function as an integrated system.',
  },
  total_t3: {
    why: 'Total T3 reflects the overall circulating level of the primary active thyroid hormone and contributes to metabolic context.',
    context: 'Meridian evaluates thyroid markers as a cluster rather than interpreting any single value in isolation.',
  },
  // ── CBC ─────────────────────────────────────────────────────────────────────
  wbc: {
    why: 'White blood cell count helps Meridian understand immune activity and the body\'s response to physiological stress.',
    context: 'Meridian evaluates this alongside differential markers and inflammatory signals for fuller immune context.',
  },
  rbc: {
    why: 'Red blood cell count gives context on the blood\'s capacity to carry oxygen to tissues throughout the body.',
    context: 'Meridian tracks this alongside hemoglobin, hematocrit, and ferritin for a complete oxygen-transport picture.',
  },
  hemoglobin: {
    why: 'Hemoglobin carries oxygen through the bloodstream and is central to energy metabolism, endurance, and circulation.',
    context: 'Meridian evaluates this alongside RBC, hematocrit, and ferritin to understand oxygen transport patterns.',
  },
  hematocrit: {
    why: 'Hematocrit reflects the proportion of red blood cells in the blood and gives context on oxygen-carrying capacity.',
    context: 'Meridian tracks this alongside hemoglobin and RBC as part of the complete blood picture.',
  },
  mcv: {
    why: 'MCV measures average red blood cell size, which can provide context on nutrient status and cell production patterns.',
    context: 'Meridian evaluates MCV alongside B12, folate, and iron markers for nutrient-related context.',
  },
  mch: {
    why: 'MCH reflects the average amount of hemoglobin per red blood cell, giving context on cell quality and oxygen capacity.',
    context: 'Meridian evaluates MCH as part of the complete blood cell picture rather than in isolation.',
  },
  mchc: {
    why: 'MCHC reflects the concentration of hemoglobin within red blood cells, adding context on red cell quality.',
    context: 'Meridian tracks MCHC alongside other CBC markers for a fuller picture of red blood cell health.',
  },
  rdw: {
    why: 'RDW measures variation in red blood cell size, which can provide context on iron status and cell production patterns.',
    context: 'Meridian evaluates RDW alongside CBC markers, ferritin, and B12 for nutrient and cell context.',
  },
  platelets: {
    why: 'Platelets are involved in clotting and vascular repair. Meridian tracks counts as part of the blood cell profile.',
    context: 'Meridian evaluates platelet count alongside other CBC and inflammatory markers for context.',
  },
  // ── Glycemic ────────────────────────────────────────────────────────────────
  hba1c: {
    why: 'A1c reflects average blood glucose exposure over approximately the past three months, helping Meridian understand glycemic patterns over time.',
    context: 'Meridian evaluates this alongside fasting glucose and insulin to build a fuller metabolic picture.',
  },
  insulin_fasting: {
    why: 'Fasting insulin provides context on how the body manages blood sugar between meals and signals metabolic efficiency.',
    context: 'Meridian tracks this alongside glucose and A1c to understand insulin sensitivity patterns over time.',
  },
  glucose_fasting: {
    why: 'Fasting glucose gives context on how the body manages blood sugar at rest and provides a metabolic baseline.',
    context: 'Meridian evaluates this alongside A1c and insulin to understand glycemic patterns over time.',
  },
  // ── Lipid Panel ─────────────────────────────────────────────────────────────
  total_cholesterol: {
    why: 'Total cholesterol reflects the sum of all cholesterol in the blood and provides baseline context for cardiovascular patterns.',
    context: 'Meridian evaluates total cholesterol alongside HDL, LDL, and triglycerides rather than as a standalone signal.',
  },
  hdl: {
    why: 'HDL helps transport cholesterol and is often associated with cardiovascular and metabolic health patterns over time.',
    context: 'Meridian evaluates HDL alongside LDL, triglycerides, and inflammation markers for cardiovascular context.',
  },
  ldl: {
    why: 'LDL is one of the primary cholesterol transport markers and is tracked by Meridian as a long-term cardiovascular signal.',
    context: 'Meridian evaluates LDL alongside HDL ratio, inflammation, and metabolic markers for fuller context.',
  },
  vldl: {
    why: 'VLDL carries triglycerides through the bloodstream and can provide context for metabolic and cardiovascular patterns.',
    context: 'Meridian tracks VLDL alongside triglycerides and other lipid markers as part of the broader cardiovascular picture.',
  },
  triglycerides: {
    why: 'Triglycerides reflect circulating blood fats and provide context on metabolic health, energy storage, and diet patterns.',
    context: 'Meridian evaluates triglycerides alongside HDL and insulin markers to understand metabolic context.',
  },
  non_hdl: {
    why: 'Non-HDL cholesterol captures all potentially atherogenic particles and can be a useful cardiovascular signal over time.',
    context: 'Meridian tracks this alongside LDL, triglycerides, and inflammatory markers for cardiovascular context.',
  },
  ldl_hdl_ratio: {
    why: 'The LDL/HDL ratio provides context on the balance between protective and atherogenic cholesterol carriers.',
    context: 'Meridian uses ratios as one layer of cardiovascular context alongside absolute lipid values.',
  },
  chol_hdl_ratio: {
    why: 'The total cholesterol/HDL ratio is a cardiovascular signal that reflects the balance between all cholesterol and protective HDL.',
    context: 'Meridian evaluates this ratio alongside absolute lipid values and inflammatory markers.',
  },
  // ── Hormones ────────────────────────────────────────────────────────────────
  testosterone_total: {
    why: 'Testosterone provides context on hormonal signaling patterns related to energy, recovery, muscle, and mood.',
    context: 'Meridian evaluates this alongside cortisol, DHEA-S, and metabolic markers for hormonal system context.',
  },
  cortisol_am: {
    why: 'Morning cortisol provides context on adrenal signaling and the body\'s stress response at the start of the day.',
    context: 'Meridian evaluates cortisol alongside thyroid, glucose, and inflammatory markers for a fuller stress-recovery picture.',
  },
  dhea_s: {
    why: 'DHEA-S is an adrenal precursor hormone that provides context on hormonal reserve and adrenal function over time.',
    context: 'Meridian tracks this alongside cortisol and testosterone for hormonal system context.',
  },
  // ── Inflammation / Cardiac Risk ─────────────────────────────────────────────
  crp_hs: {
    why: 'High-sensitivity CRP helps Meridian understand low-grade systemic inflammation and cardiovascular risk signals over time.',
    context: 'Meridian evaluates this alongside homocysteine, lipid, and metabolic markers for inflammation context.',
  },
  homocysteine: {
    why: 'Homocysteine provides context on cardiovascular risk, B-vitamin metabolism, and methylation patterns.',
    context: 'Meridian evaluates this alongside B12, folate, and inflammatory markers as part of cardiovascular context.',
  },
  // ── Vitamins & Nutrients ────────────────────────────────────────────────────
  vitamin_d: {
    why: 'Vitamin D influences immune signaling, recovery, mood regulation, and long-term musculoskeletal resilience.',
    context: 'Meridian evaluates this alongside inflammatory markers and hormonal signals for broader context.',
  },
  vitamin_b12: {
    why: 'Vitamin B12 supports nerve function, red blood cell formation, and energy metabolism at a cellular level.',
    context: 'Meridian tracks B12 alongside folate, homocysteine, and CBC markers for nutrient context.',
  },
  folate: {
    why: 'Folate is essential for cell division, DNA synthesis, and red blood cell production.',
    context: 'Meridian evaluates folate alongside B12, homocysteine, and CBC markers for nutrient context.',
  },
  magnesium: {
    why: 'Magnesium is involved in hundreds of enzymatic reactions and provides context on muscle, nerve, and energy regulation.',
    context: 'Meridian tracks magnesium alongside electrolytes and metabolic markers for nutrient context.',
  },
  ferritin: {
    why: 'Ferritin reflects stored iron levels and provides context on energy metabolism, oxygen transport, and immune function.',
    context: 'Meridian evaluates ferritin alongside hemoglobin, RBC, and other CBC markers for iron-related context.',
  },
  // ── Kidney / Renal ──────────────────────────────────────────────────────────
  creatinine: {
    why: 'Creatinine reflects muscle metabolism and kidney filtration efficiency, and is a key marker in Meridian\'s renal context.',
    context: 'Meridian evaluates creatinine alongside BUN, eGFR, and hydration signals for kidney context.',
  },
  bun: {
    why: 'BUN reflects how well the kidneys are filtering protein waste from the blood and provides metabolic and hydration context.',
    context: 'Meridian evaluates BUN alongside creatinine and eGFR for kidney function context.',
  },
  bun_creatinine_ratio: {
    why: 'The BUN/creatinine ratio helps Meridian understand kidney function relative to muscle mass and hydration status.',
    context: 'Meridian uses this ratio as part of the broader renal and hydration picture.',
  },
  egfr: {
    why: 'eGFR estimates kidney filtration rate and is central to Meridian\'s understanding of long-term kidney health patterns.',
    context: 'Meridian tracks eGFR over time alongside creatinine and BUN for comprehensive kidney context.',
  },
  egfr_african_american: {
    why: 'This eGFR estimate accounts for biological variation in creatinine production and provides kidney filtration context.',
    context: 'Meridian evaluates this alongside creatinine and BUN for kidney function context.',
  },
  egfr_non_african_american: {
    why: 'eGFR estimates kidney filtration rate and is central to Meridian\'s understanding of long-term kidney health patterns.',
    context: 'Meridian tracks eGFR over time alongside creatinine and BUN for comprehensive kidney context.',
  },
  // ── Liver ───────────────────────────────────────────────────────────────────
  ast: {
    why: 'AST reflects cellular stress in the liver and muscle and provides context for liver and tissue health patterns over time.',
    context: 'Meridian evaluates AST alongside ALT and alkaline phosphatase for liver enzyme context.',
  },
  alt: {
    why: 'ALT is a liver-specific enzyme that helps Meridian understand liver health and cellular stress patterns over time.',
    context: 'Meridian evaluates ALT alongside AST and other liver markers for a fuller hepatic picture.',
  },
  alkaline_phosphatase: {
    why: 'Alkaline phosphatase provides context on liver, bile duct, and bone health patterns.',
    context: 'Meridian evaluates this alongside AST, ALT, and bilirubin for liver and tissue context.',
  },
  bilirubin_total: {
    why: 'Bilirubin reflects red blood cell breakdown and liver processing, providing context on hepatic function.',
    context: 'Meridian tracks bilirubin alongside liver enzymes and CBC markers for context.',
  },
  albumin: {
    why: 'Albumin is a major blood protein that provides context on nutritional status, liver function, and protein metabolism.',
    context: 'Meridian evaluates albumin alongside total protein, A/G ratio, and liver markers.',
  },
  globulin: {
    why: 'Globulin reflects immune-related proteins and provides context on liver function and immune activity.',
    context: 'Meridian evaluates globulin alongside albumin, total protein, and liver enzymes for context.',
  },
  total_protein: {
    why: 'Total protein provides context on nutritional status, liver function, and the body\'s overall protein production capacity.',
    context: 'Meridian evaluates this alongside albumin, globulin, and liver markers.',
  },
  ag_ratio: {
    why: 'The albumin/globulin ratio provides context on the balance between key blood proteins and liver health patterns.',
    context: 'Meridian evaluates this ratio alongside albumin, globulin, and liver enzyme markers.',
  },
  // ── CMP electrolytes ────────────────────────────────────────────────────────
  sodium: {
    why: 'Sodium helps Meridian understand fluid balance, electrolyte regulation, and kidney function.',
    context: 'Meridian evaluates sodium alongside potassium, chloride, and CO2 as part of electrolyte balance.',
  },
  potassium: {
    why: 'Potassium is critical for heart rhythm, muscle contraction, and cellular energy balance.',
    context: 'Meridian tracks potassium alongside sodium and other electrolytes for cardiovascular and metabolic context.',
  },
  chloride: {
    why: 'Chloride helps Meridian understand acid-base balance and electrolyte regulation.',
    context: 'Meridian evaluates chloride alongside sodium, CO2, and other CMP markers.',
  },
  co2: {
    why: 'CO2 (bicarbonate) provides context on acid-base balance and how well the body is managing metabolic waste.',
    context: 'Meridian tracks CO2 alongside chloride and electrolytes for acid-base context.',
  },
  calcium: {
    why: 'Calcium supports bone structure, muscle contraction, nerve signaling, and heart function.',
    context: 'Meridian evaluates calcium alongside vitamin D and metabolic markers for mineral context.',
  },
  anion_gap: {
    why: 'The anion gap provides context on acid-base balance and can signal metabolic shifts in the blood.',
    context: 'Meridian evaluates the anion gap alongside other CMP markers for metabolic context.',
  },
}

// ── History view — types & helpers ────────────────────────────────────────────
interface HistBiomarkerRow {
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

// Panel mapping for History view — CMP-unified (liver/kidney/electrolytes merged)
const HIST_SLUG_TO_PANEL: Record<string, string> = {
  // Thyroid
  tsh: 'Thyroid Panel', free_t4: 'Thyroid Panel', free_t3: 'Thyroid Panel', total_t3: 'Thyroid Panel',
  tpo_antibodies: 'Thyroid Panel',
  // CBC
  wbc: 'CBC', rbc: 'CBC', hemoglobin: 'CBC', hematocrit: 'CBC', mcv: 'CBC', mch: 'CBC', mchc: 'CBC', rdw: 'CBC',
  platelets: 'CBC', platelet_count: 'CBC', platelet_count_abs: 'CBC', mpv: 'CBC',
  neutrophils_pct: 'CBC', neutrophils_abs: 'CBC', lymphocytes_pct: 'CBC', lymphocytes_abs: 'CBC',
  monocytes_pct: 'CBC', monocytes_abs: 'CBC', eosinophils_pct: 'CBC', eosinophils_abs: 'CBC',
  basophils_pct: 'CBC', basophils_abs: 'CBC', immature_granulocytes_pct: 'CBC', immature_granulocytes_abs: 'CBC',
  // Lipid
  total_cholesterol: 'Lipid Panel', hdl: 'Lipid Panel', ldl: 'Lipid Panel', vldl: 'Lipid Panel',
  triglycerides: 'Lipid Panel', non_hdl: 'Lipid Panel', ldl_hdl_ratio: 'Lipid Panel', chol_hdl_ratio: 'Lipid Panel',
  // CMP (kidney, liver, electrolytes, basic metabolic)
  creatinine: 'CMP', bun: 'CMP', bun_creatinine_ratio: 'CMP', egfr: 'CMP',
  egfr_african_american: 'CMP', egfr_non_african_american: 'CMP',
  ast: 'CMP', alt: 'CMP', alkaline_phosphatase: 'CMP', bilirubin_total: 'CMP',
  albumin: 'CMP', globulin: 'CMP', ag_ratio: 'CMP', total_protein: 'CMP',
  glucose_fasting: 'CMP', sodium: 'CMP', potassium: 'CMP', chloride: 'CMP',
  co2: 'CMP', calcium: 'CMP', anion_gap: 'CMP',
  // Glycemic (dedicated panel — A1c and fasting insulin are not CMP)
  hba1c: 'Glycemic Panel',
  insulin_fasting: 'Glycemic Panel',
  // Hormone Panel
  testosterone_total: 'Hormone Panel', cortisol_am: 'Hormone Panel', dhea_s: 'Hormone Panel',
  acth: 'Hormone Panel',
  // Inflammation / Cardiac Risk
  crp_hs: 'Inflammation / Cardiac Risk', homocysteine: 'Inflammation / Cardiac Risk',
  // Vitamin & Nutrient Panel
  vitamin_d: 'Vitamin & Nutrient Panel', vitamin_b12: 'Vitamin & Nutrient Panel',
  folate: 'Vitamin & Nutrient Panel', magnesium: 'Vitamin & Nutrient Panel', ferritin: 'Vitamin & Nutrient Panel',
}
function histInferPanel(slug: string): string { return HIST_SLUG_TO_PANEL[slug] ?? 'Other' }

const HIST_PANEL_DISPLAY_ORDER = [
  'CBC', 'Lipid Panel', 'CMP', 'Glycemic Panel', 'Thyroid Panel',
  'Hormone Panel', 'Vitamin & Nutrient Panel', 'Inflammation / Cardiac Risk', 'Other',
]
function histPanelSortIndex(name: string): number {
  const i = HIST_PANEL_DISPLAY_ORDER.indexOf(name)
  return i === -1 ? HIST_PANEL_DISPLAY_ORDER.length : i
}

function histMarkerDisplayName(slug: string): string {
  const O: Record<string, string> = {
    egfr: 'eGFR', egfr_african_american: 'eGFR (African American)', egfr_non_african_american: 'eGFR (Non-African American)',
    ldl_hdl_ratio: 'LDL/HDL Ratio', chol_hdl_ratio: 'Cholesterol/HDL Ratio', non_hdl: 'Non-HDL Cholesterol',
    hba1c: 'Hemoglobin A1c', crp_hs: 'hs-CRP', dhea_s: 'DHEA-S', bun: 'BUN',
    bun_creatinine_ratio: 'BUN/Creatinine Ratio', wbc: 'WBC', rbc: 'RBC',
    mcv: 'MCV', mch: 'MCH', mchc: 'MCHC', rdw: 'RDW',
    co2: 'CO₂ (Bicarbonate)', ast: 'AST', alt: 'ALT', tsh: 'TSH',
    ag_ratio: 'A/G Ratio', free_t4: 'Free T4', free_t3: 'Free T3', total_t3: 'Total T3',
    anion_gap: 'Anion Gap', cortisol_am: 'Cortisol AM', testosterone_total: 'Total Testosterone',
    insulin_fasting: 'Fasting Insulin', glucose_fasting: 'Fasting Glucose',
    vitamin_d: 'Vitamin D', vitamin_b12: 'Vitamin B12',
    alkaline_phosphatase: 'Alkaline Phosphatase', bilirubin_total: 'Total Bilirubin',
    total_protein: 'Total Protein', total_cholesterol: 'Total Cholesterol',
    hdl: 'HDL Cholesterol', ldl: 'LDL Cholesterol', vldl: 'VLDL Cholesterol',
  }
  return O[slug] ?? slug.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function histGetStateStyle(state: string | null) {
  switch (state) {
    case 'Optimal':   return { bg: colors.optimal,   border: colors.optimalBorder,   dot: '#2DD4BF', label: 'Optimal'   }
    case 'Watch':     return { bg: colors.watch,      border: colors.watchBorder,     dot: '#FCD34D', label: 'Watch'     }
    case 'Attention': return { bg: colors.attention,  border: colors.attentionBorder, dot: '#FB923C', label: 'Attention' }
    case 'Critical':  return { bg: colors.critical,   border: colors.criticalBorder,  dot: '#F87171', label: 'Critical'  }
    default:          return { bg: colors.cardBg,     border: colors.cardBorder,      dot: colors.textMuted, label: '—' }
  }
}

const HIST_INTERPRETATIONS: Record<string, string> = {
  hdl: 'HDL helps transport cholesterol away from arteries. Patterns over time can provide context for cardiovascular health.',
  ldl: 'LDL is one of the cholesterol transport markers Meridian tracks over time as part of lipid and cardiovascular context.',
  triglycerides: 'Triglycerides reflect circulating blood fats and can provide context for metabolism and cardiovascular patterns.',
  glucose_fasting: 'Glucose provides context on blood sugar regulation at the time of collection.',
  hba1c: 'A1c gives context on longer-term glucose patterns over approximately the past few months.',
  tsh: 'TSH gives context on thyroid signaling and metabolic regulation.',
  egfr: 'eGFR gives context on kidney filtration patterns.',
  creatinine: 'Creatinine provides context for kidney filtration and muscle-related metabolism.',
  vitamin_b12: 'Vitamin B12 provides context for nutrient status, energy metabolism, and nervous system support.',
  vitamin_d: 'Vitamin D provides context for immune function, bone health, and metabolic signaling.',
  ferritin: 'Ferritin reflects stored iron levels and can provide context for energy and oxygen transport.',
  hemoglobin: 'Hemoglobin carries oxygen through the blood and can provide context for energy and circulation.',
  crp_hs: 'High-sensitivity CRP provides context for systemic inflammatory patterns over time.',
  cortisol_am: 'Cortisol provides context on adrenal function and the body\'s stress response signaling.',
  testosterone_total: 'Testosterone provides context for hormonal and metabolic signaling patterns.',
}
function histGetInterpretation(slug: string): string {
  return HIST_INTERPRETATIONS[slug] ?? 'This biomarker adds context to your saved lab profile.'
}

function histUtcDateKey(isoString: string): string { return isoString.split('T')[0] }
function histFormatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}
function histFormatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' })
}

interface HistPanelGroup { panel: string; items: HistBiomarkerRow[]; stateCounts: { Optimal: number; Watch: number; Attention: number; Critical: number } }
interface HistDateGroup  { dateKey: string; label: string; total: number; panelCount: number; panels: HistPanelGroup[] }
interface HistMonthGroup { monthKey: string; label: string; dates: HistDateGroup[] }
interface HistYearGroup  { year: string; months: HistMonthGroup[] }

function histGroupRows(rows: HistBiomarkerRow[]): HistYearGroup[] {
  const yearMap = new Map<string, Map<string, Map<string, Map<string, HistBiomarkerRow[]>>>>()
  for (const row of rows) {
    const dateKey = histUtcDateKey(row.collected_at)
    const [y, m] = dateKey.split('-')
    const monthKey = `${y}-${m}`
    const panel = histInferPanel(row.marker_name)
    if (!yearMap.has(y)) yearMap.set(y, new Map())
    const monthMap = yearMap.get(y)!
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map())
    const dateMap = monthMap.get(monthKey)!
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Map())
    const panelMap = dateMap.get(dateKey)!
    if (!panelMap.has(panel)) panelMap.set(panel, [])
    panelMap.get(panel)!.push(row)
  }
  return Array.from(yearMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, monthMap]) => ({
      year,
      months: Array.from(monthMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([monthKey, dateMap]) => ({
          monthKey,
          label: histFormatMonthLabel(monthKey),
          dates: Array.from(dateMap.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([dateKey, panelMap]) => {
              const panels: HistPanelGroup[] = Array.from(panelMap.entries())
                .sort(([a], [b]) => histPanelSortIndex(a) - histPanelSortIndex(b))
                .map(([panel, items]) => {
                  const seen = new Map<string, HistBiomarkerRow>()
                  for (const row of items) {
                    const ex = seen.get(row.marker_name)
                    if (!ex || row.created_at > ex.created_at) seen.set(row.marker_name, row)
                  }
                  const deduped = Array.from(seen.values())
                  return { panel, items: deduped, stateCounts: { Optimal: deduped.filter(i => i.state === 'Optimal').length, Watch: deduped.filter(i => i.state === 'Watch').length, Attention: deduped.filter(i => i.state === 'Attention').length, Critical: deduped.filter(i => i.state === 'Critical').length } }
                })
              return { dateKey, label: histFormatDateLabel(dateKey), total: panels.reduce((s, p) => s + p.items.length, 0), panelCount: panelMap.size, panels }
            }),
        })),
    }))
}

// ── Biomarker Detail Sheet ─────────────────────────────────────────────────────
function BiomarkerDetailSheet({
  biomarker,
  allBiomarkers,
  bioProfile,
  onClose,
}: {
  biomarker: RecentBiomarker
  allBiomarkers: RecentBiomarker[]
  bioProfile: string
  onClose: () => void
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // ── Safety Engine check ────────────────────────────────────────────────────
  // Deterministic suppression gate (Phase 1). Suppresses optimization language
  // and shows a calm Safety Note when the value meets critical thresholds.
  // Does NOT alter stored state or produce any diagnosis.
  const safetyResult = getSafetyStatusForBiomarker(
    biomarker.marker_name,
    biomarker.value,
    biomarker.unit ?? '',
    bioProfile,
  )
  const isCritical = safetyResult.status === 'critical' || biomarker.state === 'Critical'

  const displayName = markerDisplayName(biomarker.marker_name)
  const panel       = SLUG_TO_PANEL[biomarker.marker_name] ?? null
  // If safety engine flags critical, always show Critical badge regardless of stored state
  const s           = getStateStyles(isCritical ? 'Critical' : (biomarker.state ?? ''))
  const dotColor    = isCritical ? '#F87171' : getStateColor(biomarker.state)
  const hasRange    = isUsableRange(biomarker.reference_range_min, biomarker.reference_range_max)
  const hasOptimal  = isUsableRange(biomarker.optimal_range_min, biomarker.optimal_range_max)
  const intel       = BIOMARKER_CONTEXT[biomarker.marker_name]

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
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: 'rgba(6,19,22,0.78)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />
      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        maxHeight: '88vh', overflowY: 'auto',
        backgroundColor: '#081A1E',
        border: `1px solid ${dotColor}40`,
        borderBottom: 'none',
        borderRadius: '20px 20px 0 0',
        fontFamily: fonts.ui,
        boxShadow: '0 -6px 48px rgba(0,0,0,0.50), 0 -1px 0 rgba(103,232,249,0.06)',
      }}>
        {/* Handle */}
        <div style={{ width: '40px', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(103,232,249,0.28)', margin: '14px auto 0' }} />

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
        <div style={{ padding: '14px 20px max(52px, calc(env(safe-area-inset-bottom, 0px) + 32px))' }}>

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
                    slug={biomarker.marker_name}
                  />
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, transparent, ${dotColor}28)` }} />
                <span style={{ fontSize: '11px', color: colors.textMuted, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>No reference range on file</span>
                <div style={{ flex: 1, height: '1px', background: `linear-gradient(to left, transparent, ${dotColor}28)` }} />
              </div>
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

          {/* Safety Note (critical) OR Why it matters + Meridian context (normal) */}
          {isCritical ? (
            // ── Safety Engine suppression: optimization language hidden ──────
            // Safety Engine V1: non-diagnostic, output suppression only.
            // No diagnosis, no treatment advice, no medication references.
            <div style={{
              backgroundColor: 'rgba(248,113,113,0.07)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: '14px',
              padding: '14px 16px',
              marginBottom: 0,
            }}>
              <p style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: '#F87171',
                marginBottom: '8px', marginTop: 0,
              }}>
                Safety Note
              </p>
              <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: '0 0 10px' }}>
                This result may require prompt medical review. Meridian will not generate optimization guidance for this marker.
              </p>
              <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>
                Review this result with a qualified healthcare professional, especially if it is unexpected or you are experiencing symptoms.
              </p>
            </div>
          ) : (
            <>
              {/* Why it matters */}
              <div style={cardStyle}>
                <p style={labelStyle}>Why it matters</p>
                <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: 0 }}>
                  {intel?.why ?? 'This biomarker contributes to Meridian\'s understanding of your biological state.'}
                </p>
              </div>

              {/* Meridian context */}
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <p style={labelStyle}>Meridian context</p>
                <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.65, margin: 0 }}>
                  {intel?.context ?? 'Meridian evaluates this signal alongside related biomarkers and recovery patterns.'}
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}

// ── History Detail Sheet ───────────────────────────────────────────────────────
function HistoryDetailSheet({
  biomarker,
  allBiomarkers,
  bioProfile,
  onClose,
}: {
  biomarker: HistBiomarkerRow
  allBiomarkers: HistBiomarkerRow[]
  bioProfile: string
  onClose: () => void
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const safetyResult = getSafetyStatusForBiomarker(biomarker.marker_name, biomarker.value, biomarker.unit ?? '', bioProfile)
  const isCritical  = safetyResult.status === 'critical' || biomarker.state === 'Critical'
  const displayName = histMarkerDisplayName(biomarker.marker_name)
  const panel       = HIST_SLUG_TO_PANEL[biomarker.marker_name] ?? null
  const s           = histGetStateStyle(isCritical ? 'Critical' : biomarker.state)
  const dotColor    = isCritical ? '#F87171' : getStateColor(biomarker.state)
  const hasRange    = isUsableRange(biomarker.reference_range_min, biomarker.reference_range_max)
  const hasOptimal  = isUsableRange(biomarker.optimal_range_min, biomarker.optimal_range_max)
  const interp      = histGetInterpretation(biomarker.marker_name)

  const prev = allBiomarkers
    .filter(b => b.marker_name === biomarker.marker_name && b.id !== biomarker.id && new Date(b.collected_at).getTime() <= new Date(biomarker.collected_at).getTime())
    .sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime())[0] ?? null
  const delta = prev !== null ? Number((biomarker.value - prev.value).toFixed(2)) : null

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  }
  const cardStyle  = { backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px' as const, padding: '14px 16px', marginBottom: '10px' }
  const labelStyle = { fontSize: '10px' as const, color: colors.textMuted, fontWeight: 700 as const, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '8px', marginTop: 0 as const }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(6,19,22,0.78)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201, maxHeight: '88vh', overflowY: 'auto', backgroundColor: '#081A1E', border: `1px solid ${dotColor}40`, borderBottom: 'none', borderRadius: '20px 20px 0 0', fontFamily: fonts.ui, boxShadow: '0 -6px 48px rgba(0,0,0,0.50), 0 -1px 0 rgba(103,232,249,0.06)' }}>
        <div style={{ width: '40px', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(103,232,249,0.28)', margin: '14px auto 0' }} />
        <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {panel && <p style={{ fontSize: '11px', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>{panel}</p>}
            <h2 style={{ fontFamily: fonts.heading, fontSize: '22px', fontWeight: 700, color: colors.text, lineHeight: 1.2, margin: 0 }}>{displayName}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingTop: '4px' }}>
            {biomarker.state && <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.dot, letterSpacing: '0.04em' }}>{s.label}</span>}
            <button onClick={onClose} aria-label="Close" style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(103,232,249,0.07)', border: '1px solid rgba(103,232,249,0.15)', color: colors.textMuted, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.ui, lineHeight: '1' }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '14px 20px max(52px, calc(env(safe-area-inset-bottom, 0px) + 32px))' }}>
          <div style={{ ...cardStyle, textAlign: 'center', padding: '20px 16px' }}>
            <div>
              <span style={{ fontFamily: fonts.heading, fontSize: '46px', fontWeight: 800, color: colors.text, lineHeight: 1 }}>{biomarker.value}</span>
              {biomarker.unit && <span style={{ fontSize: '16px', color: colors.textMuted, marginLeft: '6px', fontWeight: 500 }}>{biomarker.unit}</span>}
            </div>
            <p style={{ fontSize: '12px', color: colors.textMuted, marginTop: '6px', marginBottom: 0 }}>Collected {fmtDate(biomarker.collected_at)}</p>
          </div>
          <div style={cardStyle}>
            <p style={labelStyle}>Range</p>
            {(hasRange || hasOptimal) ? (
              <>
                {hasRange && <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 4px' }}>Clinical: <span style={{ fontWeight: 600, color: colors.text }}>{biomarker.reference_range_min} – {biomarker.reference_range_max}</span>{biomarker.unit ? ` ${biomarker.unit}` : ''}</p>}
                {hasOptimal && <p style={{ fontSize: '13px', color: colors.teal, margin: '0 0 8px' }}>Optimal: <span style={{ fontWeight: 600 }}>{biomarker.optimal_range_min} – {biomarker.optimal_range_max}</span>{biomarker.unit ? ` ${biomarker.unit}` : ''}</p>}
                {hasRange && <BiomarkerRangeBar value={biomarker.value} refMin={biomarker.reference_range_min!} refMax={biomarker.reference_range_max!} state={biomarker.state} slug={biomarker.marker_name} />}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, transparent, ${dotColor}28)` }} />
                <span style={{ fontSize: '11px', color: colors.textMuted, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>No reference range on file</span>
                <div style={{ flex: 1, height: '1px', background: `linear-gradient(to left, transparent, ${dotColor}28)` }} />
              </div>
            )}
          </div>
          <div style={cardStyle}>
            <p style={labelStyle}>Trend</p>
            {prev ? (
              <div>
                <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 4px' }}>Previous: <span style={{ fontWeight: 700, color: colors.text }}>{prev.value}{prev.unit ? ` ${prev.unit}` : ''}</span><span style={{ color: colors.textMuted }}>{' '}on {fmtDate(prev.collected_at)}</span></p>
                {delta !== null && <p style={{ fontSize: '13px', margin: 0, fontWeight: 600, color: delta > 0 ? '#FB923C' : delta < 0 ? '#2DD4BF' : colors.textMuted }}>{delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : ''}{delta} from previous</p>}
              </div>
            ) : <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>No previous result yet.</p>}
          </div>
          {isCritical ? (
            <div style={{ backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: '14px', padding: '14px 16px', marginBottom: 0 }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F87171', marginBottom: '8px', marginTop: 0 }}>Safety Note</p>
              <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: '0 0 8px' }}>This result may require prompt medical review. Meridian will not generate optimisation guidance for this marker.</p>
              <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>Review this result with a qualified healthcare professional. This is educational context only, not a diagnosis.</p>
            </div>
          ) : (
            <>
              <div style={cardStyle}>
                <p style={labelStyle}>About this marker</p>
                <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: 0 }}>{interp}</p>
              </div>
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <p style={labelStyle}>Context</p>
                <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.65, margin: '0 0 5px' }}>Meridian uses this marker as one part of your broader biological context.</p>
                <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.65, margin: '0 0 5px' }}>Trends over time are usually more useful than one isolated result.</p>
                <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.65, margin: 0 }}>This is educational context only, not a diagnosis.</p>
              </div>
            </>
          )}
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
  const [duplicateWarning, setDuplicateWarning] = useState<{ count: number; slugs: string[]; total: number } | null>(null)
  // Tracks which unmatched markers the user has dismissed in the current review flow.
  // Ignored markers are not saved to pending_biomarkers. Reset on handleReset().
  const [ignoredPending, setIgnoredPending] = useState<Set<number>>(new Set())

  // ── Recent snapshot state ────────────────────────────────────────────────────
  const [recentBiomarkers, setRecentBiomarkers] = useState<RecentBiomarker[]>([])
  const [hasAnyLabs, setHasAnyLabs] = useState(false)
  const [snapshotLoading, setSnapshotLoading] = useState(true)
  const [selectedBiomarker, setSelectedBiomarker] = useState<RecentBiomarker | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  // ── History view state ────────────────────────────────────────────────────────
  const [labsView, setLabsView] = useState<'snapshot' | 'history'>('snapshot')
  const [histBiomarkers, setHistBiomarkers] = useState<HistBiomarkerRow[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histFetched, setHistFetched] = useState(false)
  const [histError, setHistError] = useState<string | null>(null)
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set())
  const [histSelectedBiomarker, setHistSelectedBiomarker] = useState<HistBiomarkerRow | null>(null)
  const [deleteConfirmDate, setDeleteConfirmDate] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Snapshot view mode + progressive disclosure ──────────────────────────────
  const [snapshotViewMode, setSnapshotViewMode] = useState<SnapshotViewMode>('clinical_panels')
  const [optimalExpanded, setOptimalExpanded] = useState<Set<string>>(new Set())

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
        .select('biological_profile, onboarding_completed, full_name, birth_date, user_profile')
        .eq('id', user.id)
        .single()
      const nextStep = getNextOnboardingStep(profile)
      if (nextStep) { router.push(nextStep); return }
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

      // If the URL contains ?view=history, pre-fetch history data immediately
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        if (params.get('view') === 'history') {
          setLabsView('history')
          setHistLoading(true)
          const { data: histData, error: histFetchError } = await supabase
            .from('biomarkers_static')
            .select('id, marker_name, value, unit, state, reference_range_min, reference_range_max, optimal_range_min, optimal_range_max, collected_at, created_at, flag_error')
            .eq('user_id', user.id)
            .order('collected_at', { ascending: false })
            .order('created_at', { ascending: false })
          if (histFetchError) {
            setHistError('Could not load your Timeline. Please try again.')
          } else {
            setHistBiomarkers(histData || [])
            setHistFetched(true)
          }
          setHistLoading(false)
        }
      }
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
        setLabDate(data.lab_date || '')
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
      // Exclude qualitative markers and non-finite values from save payload.
      // Qualitative urine dipstick markers are not numeric biomarkers_static rows.
      const safeBiomarkers = staged.filter(b => Number.isFinite(b.value) && !isLikelyQualitativeUrinalysis(b.name))
      const response = await fetch('/api/ocr/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, biomarkers: safeBiomarkers, collected_at: collectedAt }),
      })
      const data = await response.json()
      if (!data.success) { setError(data.error || 'Failed to save biomarkers'); setConfirming(false); return }
      setSavedCount(data.saved_count)
      setConfirmed(true)
      setConfirming(false)

      // ── Refresh snapshot so it's current when the user returns to idle state ─
      if (userId) {
        const refreshCutoff = new Date()
        refreshCutoff.setFullYear(refreshCutoff.getFullYear() - 1)
        const { data: refreshed } = await supabase
          .from('biomarkers_static')
          .select('id, marker_name, value, unit, state, reference_range_min, reference_range_max, optimal_range_min, optimal_range_max, collected_at, flag_error')
          .eq('user_id', userId)
          .gte('collected_at', refreshCutoff.toISOString())
          .order('collected_at', { ascending: false })
          .order('created_at', { ascending: false })
        if (refreshed) {
          setRecentBiomarkers(refreshed)
          setHasAnyLabs(refreshed.length > 0)
        }
      }

      // ── Save non-ignored pending markers ────────────────────────────────────
      // Fire-and-forget: pending save failure must NOT block or surface errors
      // to the user in the main confirm flow.
      const pendingToSave = unmatched
        .filter((_, i) => !ignoredPending.has(i))
        .map(u => ({
          raw_name:            u.name,
          raw_value:           u.value,
          raw_unit:            u.unit,
          raw_reference_range: u.reference_range ?? null,
        }))
      if (pendingToSave.length > 0) {
        fetch('/api/ocr/pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id:         userId,
            markers:         pendingToSave,
            collected_at:    collectedAt,
            source_pdf_name: fileName,
          }),
        }).catch(err => console.error('[Meridian] Failed to save pending markers:', err))
      }
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
          setDuplicateWarning({ count: overlapping.length, slugs: overlapping, total: staged.filter(b => !b.flag_error).length })
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
    setIgnoredPending(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── History view handlers ─────────────────────────────────────────────────────
  async function loadHistoryData() {
    if (!userId) return
    setHistLoading(true)
    setHistError(null)
    const { data, error: fetchError } = await supabase
      .from('biomarkers_static')
      .select('id, marker_name, value, unit, state, reference_range_min, reference_range_max, optimal_range_min, optimal_range_max, collected_at, created_at, flag_error')
      .eq('user_id', userId)
      .order('collected_at', { ascending: false })
      .order('created_at', { ascending: false })
    if (fetchError) {
      setHistError('Could not load your Timeline. Please try again.')
    } else {
      setHistBiomarkers(data || [])
      setHistFetched(true)
    }
    setHistLoading(false)
  }

  function toggleHistPanel(dateKey: string, panel: string) {
    const key = `${dateKey}::${panel}`
    setExpandedPanels(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleDeleteSession(dateKey: string) {
    if (!userId) return
    setDeleteLoading(true)
    const nextDay = new Date(dateKey + 'T00:00:00Z')
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const { error: deleteError } = await supabase
      .from('biomarkers_static')
      .delete()
      .eq('user_id', userId)
      .gte('collected_at', `${dateKey}T00:00:00.000Z`)
      .lt('collected_at', nextDay.toISOString())
    if (deleteError) {
      setHistError('Could not delete this session. Please try again.')
      setDeleteLoading(false)
      setDeleteConfirmDate(null)
      return
    }
    setHistBiomarkers(prev => prev.filter(b => histUtcDateKey(b.collected_at) !== dateKey))
    setDeleteConfirmDate(null)
    setDeleteLoading(false)
  }

  // ── Derived snapshot data ────────────────────────────────────────────────────
  // Deduplicate — rows ordered collected_at DESC so first occurrence = most recent
  const snapshotBiomarkers = deduplicateByMarker(recentBiomarkers)
  const hasRecentLabs = snapshotBiomarkers.length > 0
  const currentYear = new Date().getFullYear()
  const panelSummaries = hasRecentLabs ? buildPanelSummaries(snapshotBiomarkers) : []
  const latestDate = hasRecentLabs ? snapshotBiomarkers[0].collected_at : null
  // Phase 1 guardrail: systemic markers inside clinical reference range display as
  // Optimal rather than Watch. Raw DB state is preserved in snapshotBiomarkers.
  const snapshotBiomarkersDisplay = snapshotBiomarkers.map(b => ({ ...b, state: effectiveSnapshotState(b) }))
  const totalStateCounts = {
    Optimal:   snapshotBiomarkersDisplay.filter(b => b.state === 'Optimal').length,
    Watch:     snapshotBiomarkersDisplay.filter(b => b.state === 'Watch').length,
    Attention: snapshotBiomarkersDisplay.filter(b => b.state === 'Attention').length,
    Critical:  snapshotBiomarkersDisplay.filter(b => b.state === 'Critical').length,
  }
  const SEVERITY: Record<string, number> = { Critical: 0, Attention: 1, Watch: 2 }
  const attentionMarkers = snapshotBiomarkersDisplay
    .filter(b => b.state === 'Critical' || b.state === 'Attention' || b.state === 'Watch')
    .sort((a, b) => (SEVERITY[a.state ?? ''] ?? 9) - (SEVERITY[b.state ?? ''] ?? 9))
  const filteredBiomarkers = activeFilter
    ? snapshotBiomarkersDisplay.filter(b => b.state === activeFilter)
    : snapshotBiomarkersDisplay

  // Group filteredBiomarkers by source panel for the filtered view.
  // Map preserves insertion order → groups appear in biomarker severity order.
  const filteredGrouped: { panel: string; markers: RecentBiomarker[] }[] = (() => {
    if (!activeFilter) return []
    const groupMap = new Map<string, RecentBiomarker[]>()
    for (const b of filteredBiomarkers) {
      const panel = SLUG_TO_PANEL[b.marker_name] ?? 'Other'
      if (!groupMap.has(panel)) groupMap.set(panel, [])
      groupMap.get(panel)!.push(b)
    }
    return Array.from(groupMap, ([panel, markers]) => ({ panel, markers }))
  })()

  // ── Current marker groups for Snapshot view mode ─────────────────────────────
  const currentMarkerGroups = (() => {
    if (!hasRecentLabs) return []
    const slugMap = snapshotViewMode === 'clinical_panels' ? CLINICAL_SLUG_TO_PANEL : SIGNAL_SLUG_TO_LAYER
    const order   = snapshotViewMode === 'clinical_panels' ? CLINICAL_PANEL_ORDER   : SIGNAL_LAYER_ORDER
    const eduMap  = snapshotViewMode === 'clinical_panels' ? CLINICAL_PANEL_EDUCATION : SIGNAL_LAYER_EDUCATION
    const groupMap = new Map<string, RecentBiomarker[]>()
    for (const b of snapshotBiomarkersDisplay) {
      const g = slugMap[b.marker_name] ?? 'Other'
      if (!groupMap.has(g)) groupMap.set(g, [])
      groupMap.get(g)!.push(b)
    }
    return Array.from(groupMap.entries())
      .map(([label, markers]) => {
        const sorted = [...markers].sort((a, b) => (SNAPSHOT_STATE_SORT[a.state ?? ''] ?? 9) - (SNAPSHOT_STATE_SORT[b.state ?? ''] ?? 9))
        return {
          key: label,
          label,
          count: sorted.length,
          stateCounts: {
            Critical:  sorted.filter(b => b.state === 'Critical').length,
            Attention: sorted.filter(b => b.state === 'Attention').length,
            Watch:     sorted.filter(b => b.state === 'Watch').length,
            Optimal:   sorted.filter(b => b.state === 'Optimal').length,
          },
          markers: sorted,
          education: eduMap[label] ?? 'This group adds context to your biological profile.',
        }
      })
      .sort((a, b) => {
        const ai = order.indexOf(a.label); const bi = order.indexOf(b.label)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
  })()

  function toggleOptimalExpand(key: string) {
    setOptimalExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

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
      padding: '44px 20px 120px',
    }}>
      {/* Detail sheet — snapshot */}
      {selectedBiomarker && (
        <BiomarkerDetailSheet
          biomarker={selectedBiomarker}
          allBiomarkers={recentBiomarkers}
          bioProfile={bioProfile}
          onClose={() => setSelectedBiomarker(null)}
        />
      )}

      {/* Detail sheet — history */}
      {histSelectedBiomarker && (
        <HistoryDetailSheet
          biomarker={histSelectedBiomarker}
          allBiomarkers={histBiomarkers}
          bioProfile={bioProfile}
          onClose={() => setHistSelectedBiomarker(null)}
        />
      )}

      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* ── Page header ── */}
        {!inUploadFlow && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {/* BIOMARKER SIGNALS chip */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 18px', borderRadius: '999px',
              border: '1px solid rgba(45,212,191,0.38)',
              background: 'rgba(20,184,166,0.08)',
              color: '#2DD4BF',
              fontSize: '12px', fontWeight: 800, letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: '28px',
            }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 8px rgba(45,212,191,0.7)', flexShrink: 0 }} />
              Biomarker Signals
            </div>
            <h1 style={{
              fontFamily: fonts.heading,
              fontSize: 'clamp(26px, 5vw, 32px)',
              fontWeight: 700,
              color: colors.text,
              marginBottom: '16px',
              lineHeight: 1.2,
            }}>
              {hasRecentLabs ? 'Labs' : 'Upload your labs'}
            </h1>
            <p style={{ fontSize: '15px', fontWeight: 600, color: colors.text, marginBottom: '6px', lineHeight: 1.5 }}>
              Your clinical markers.
            </p>
            <p style={{ fontSize: '15px', color: colors.textMuted, marginBottom: hasRecentLabs ? '24px' : '20px', lineHeight: 1.5 }}>
              Translated into biological signals.
            </p>
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(103,232,249,0.12) 40%, rgba(103,232,249,0.08) 60%, transparent)', marginBottom: '28px' }} />
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ACTIVE UPLOAD FLOW (unchanged — loading / staging / success)
            ════════════════════════════════════════════════════════════════════ */}

        {/* Upload header shown during flow */}
        {inUploadFlow && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, marginBottom: '8px' }}>
              Upload your labs
            </h1>
            <p style={{ fontSize: '15px', color: colors.textSoft, marginBottom: '20px', lineHeight: 1.6 }}>
              Upload a PDF from your lab provider. Meridian will extract your biomarkers automatically.
            </p>
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(103,232,249,0.12) 40%, rgba(103,232,249,0.08) 60%, transparent)', marginBottom: '28px' }} />
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

              {/* Biomarker cards — grouped by clinical panel */}
              {(() => {
                const panelMap = new Map<string, StagedBiomarker[]>()
                for (const b of staged) {
                  const panel = CLINICAL_SLUG_TO_PANEL[b.slug] ?? 'Other'
                  if (!panelMap.has(panel)) panelMap.set(panel, [])
                  panelMap.get(panel)!.push(b)
                }
                const groups = Array.from(panelMap.entries()).sort((a, b) => {
                  const ai = CLINICAL_PANEL_ORDER.indexOf(a[0]); const bi = CLINICAL_PANEL_ORDER.indexOf(b[0])
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                })
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                    {groups.map(([panel, markers], gi) => {
                      const realFlagCount = markers.filter(b =>
                        b.flag_error && Number.isFinite(b.value) && !isLikelyQualitativeUrinalysis(b.name)
                      ).length
                      return (
                        <motion.div
                          key={panel}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: gi * 0.06 }}
                          style={{
                            backgroundColor: colors.cardBg,
                            border: `1px solid ${colors.cardBorder}`,
                            borderRadius: '14px',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Panel header */}
                          <div style={{
                            padding: '11px 16px 10px',
                            borderBottom: `1px solid ${colors.cardBorder}`,
                            display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                          }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: colors.teal, flex: 1, letterSpacing: '0.01em' }}>{panel}</span>
                            <span style={{ fontSize: '11px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                              {markers.length} {markers.length === 1 ? 'marker' : 'markers'}
                            </span>
                            {realFlagCount > 0 && (
                              <span style={{
                                fontSize: '10px', fontWeight: 700, color: '#F87171',
                                backgroundColor: colors.critical, border: `1px solid ${colors.criticalBorder}`,
                                borderRadius: '20px', padding: '1px 8px', whiteSpace: 'nowrap',
                              }}>{realFlagCount} flagged</span>
                            )}
                          </div>
                          {/* Marker rows */}
                          <div>
                            {markers.map((b, i) => {
                              const s = getStateStyles(b.state)
                              const valueIsFinite = Number.isFinite(b.value)
                              const qualitative = isLikelyQualitativeUrinalysis(b.name)
                              const isRealError = b.flag_error && valueIsFinite && !qualitative
                              const isSoftIssue = b.flag_error && (!valueIsFinite || qualitative)
                              const errorMsg = isSoftIssue
                                ? qualitative
                                  ? 'Qualitative marker — not saved as a numeric biomarker.'
                                  : 'Value could not be read.'
                                : isRealError ? b.error_reason : null
                              return (
                                <div
                                  key={b.slug + i}
                                  style={{
                                    padding: '12px 16px',
                                    borderTop: i === 0 ? 'none' : `1px solid ${colors.cardBorder}`,
                                    display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                                    backgroundColor: isRealError
                                      ? 'rgba(248,113,113,0.07)'
                                      : isSoftIssue
                                        ? 'rgba(250,204,21,0.04)'
                                        : 'transparent',
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: '150px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: errorMsg ? '4px' : '0' }}>
                                      <div style={{
                                        width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                                        backgroundColor: isRealError ? colors.error : isSoftIssue ? '#FCD34D' : s.dot,
                                      }} />
                                      <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>{b.name}</span>
                                    </div>
                                    {b.converted && (
                                      <span style={{ fontSize: '11px', color: colors.textMuted, display: 'block', paddingLeft: '15px' }}>
                                        Converted from {b.original_value} {b.original_unit}
                                      </span>
                                    )}
                                    {errorMsg && (
                                      <span style={{
                                        fontSize: '11px', display: 'block', paddingLeft: '15px',
                                        color: isRealError ? '#FCA5A5' : '#FCD34D',
                                      }}>
                                        {errorMsg}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    {valueIsFinite ? (
                                      <>
                                        <span style={{ fontSize: '18px', fontWeight: 700, color: colors.text }}>{b.value}</span>
                                        <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: '4px' }}>{b.unit}</span>
                                      </>
                                    ) : (
                                      <span style={{ fontSize: '12px', color: colors.textMuted, fontStyle: 'italic' }}>—</span>
                                    )}
                                    <div style={{
                                      fontSize: '10px', fontWeight: 700, marginTop: '2px', letterSpacing: '0.04em',
                                      color: isRealError ? '#F87171' : isSoftIssue ? '#FCD34D' : s.dot,
                                    }}>
                                      {isRealError ? 'FLAG' : isSoftIssue ? 'SKIP' : s.label}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )
              })()}

              {/* ── Pending Classification + OCR Artifacts ───────────────────
                  Unrecognized markers are preserved here, not silently dropped.
                  Partitioned into: true pending markers, and OCR artifacts.    */}
              {(() => {
                const visibleUnmatched = unmatched
                  .map((u, i) => ({ u, i }))
                  .filter(({ i }) => !ignoredPending.has(i))
                const realPending = visibleUnmatched.filter(({ u }) => !isOcrArtifact(u.name))
                const artifacts  = visibleUnmatched.filter(({ u }) =>  isOcrArtifact(u.name))
                if (visibleUnmatched.length === 0) return null

                const IgnoreBtn = ({ idx }: { idx: number }) => (
                  <button
                    onClick={() => setIgnoredPending(prev => { const next = new Set(prev); next.add(idx); return next })}
                    style={{
                      padding: '4px 10px', backgroundColor: 'transparent',
                      border: '1px solid rgba(95,142,133,0.28)', borderRadius: '6px',
                      color: colors.textMuted, fontFamily: fonts.ui,
                      fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                  >Ignore</button>
                )

                return (
                  <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* ── Real Pending Classification ─────────────────────────── */}
                    {realPending.length > 0 && (
                      <div>
                        <div style={{
                          padding: '12px 16px', backgroundColor: 'rgba(103,232,249,0.035)',
                          border: `1px solid ${colors.cardBorder}`, borderRadius: '12px', marginBottom: '8px',
                        }}>
                          <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.textMuted, margin: '0 0 4px' }}>
                            Pending Classification
                          </p>
                          <p style={{ fontSize: '12px', color: colors.textMuted, margin: 0, lineHeight: 1.55 }}>
                            These markers were extracted but could not be confidently matched to Meridian&apos;s biomarker dictionary. They will not affect your lab results, counts, or health signals.
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {realPending.map(({ u, i }) => {
                            const isQual = isLikelyQualitativeUrinalysis(u.name)
                            const subLabel = isQual
                              ? 'Qualitative urinalysis marker'
                              : 'No confident match in dictionary'
                            return (
                              <div key={i} style={{
                                padding: '11px 14px', backgroundColor: colors.cardBg,
                                border: `1px solid ${colors.cardBorder}`, borderRadius: '10px',
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px',
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textSoft, display: 'block', marginBottom: '2px' }}>{u.name}</span>
                                  <span style={{ fontSize: '13px', color: colors.textMuted }}>
                                    {u.value} {u.unit}
                                    {u.reference_range && (
                                      <span style={{ marginLeft: '8px', fontSize: '11px', opacity: 0.7 }}>Ref: {u.reference_range}</span>
                                    )}
                                  </span>
                                  <span style={{ fontSize: '11px', color: colors.textMuted, opacity: 0.5, display: 'block', marginTop: '3px' }}>{subLabel}</span>
                                </div>
                                <IgnoreBtn idx={i} />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Possible document artifacts ─────────────────────────── */}
                    {artifacts.length > 0 && (
                      <div>
                        <div style={{
                          padding: '10px 14px', backgroundColor: 'rgba(95,142,133,0.04)',
                          border: '1px solid rgba(95,142,133,0.14)', borderRadius: '10px', marginBottom: '6px',
                        }}>
                          <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.textMuted, margin: '0 0 3px', opacity: 0.7 }}>
                            Possible document artifacts
                          </p>
                          <p style={{ fontSize: '11px', color: colors.textMuted, margin: 0, lineHeight: 1.5, opacity: 0.65 }}>
                            These appear to be PDF layout codes or OCR residue rather than clinical biomarkers. They will not be saved.
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {artifacts.map(({ u, i }) => (
                            <div key={i} style={{
                              padding: '8px 12px', backgroundColor: 'rgba(95,142,133,0.03)',
                              border: '1px solid rgba(95,142,133,0.10)', borderRadius: '8px',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                            }}>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textMuted, fontFamily: 'monospace' }}>{u.name}</span>
                                <span style={{ fontSize: '11px', color: colors.textMuted, opacity: 0.45, marginLeft: '8px' }}>document code</span>
                              </div>
                              <IgnoreBtn idx={i} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )
              })()}

              {/* Duplicate / overlap notice — 3-tier */}
              {duplicateWarning && (() => {
                const ratio = duplicateWarning.total > 0 ? duplicateWarning.count / duplicateWarning.total : 0
                const level = (duplicateWarning.count <= 2 || ratio < 0.25) ? 'low'
                            : ratio > 0.70 ? 'high'
                            : 'moderate'
                const isLow = level === 'low'
                return (
                  <div style={{
                    padding: '14px 18px',
                    backgroundColor: isLow ? 'rgba(45,212,191,0.06)' : 'rgba(250,204,21,0.07)',
                    border: `1px solid ${isLow ? 'rgba(45,212,191,0.25)' : 'rgba(250,204,21,0.28)'}`,
                    borderRadius: '12px',
                    marginBottom: '16px',
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: isLow ? colors.teal : '#FCD34D', margin: '0 0 5px' }}>
                      {level === 'low' ? 'Same-day lab panel detected'
                        : level === 'high' ? 'Possible duplicate upload'
                        : 'Possible overlap detected'}
                    </p>
                    <p style={{ fontSize: '13px', color: colors.textSoft, margin: `0 0 ${isLow ? '10px' : '14px'}`, lineHeight: 1.5 }}>
                      {level === 'low'
                        ? 'Some markers from this date may already exist. Meridian can save this PDF and add the new markers to your Lab Snapshot.'
                        : level === 'high'
                        ? 'Most markers in this PDF appear to already exist for this date. Save anyway only if this is a corrected or separate file.'
                        : 'Some biomarkers from this date may already exist. Review before saving, or save anyway if this is a separate lab panel.'}
                    </p>
                    {isLow ? (
                      <button
                        onClick={() => setDuplicateWarning(null)}
                        style={{
                          padding: '5px 14px', borderRadius: '8px',
                          border: '1px solid rgba(45,212,191,0.25)',
                          backgroundColor: 'transparent', color: colors.teal,
                          fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Dismiss
                      </button>
                    ) : (
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
                    )}
                  </div>
                )
              })()}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <motion.button
                  onClick={() => duplicateWarning ? handleConfirm(true) : handleConfirm()}
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
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'relative',
              padding: '28px 24px 24px',
              backgroundColor: colors.optimal,
              border: `1px solid ${colors.optimalBorder}`,
              borderRadius: '16px',
            }}
          >
            {/* Close button */}
            <button
              onClick={handleReset}
              aria-label="Dismiss"
              style={{
                position: 'absolute', top: '14px', right: '14px',
                width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: 'rgba(45,212,191,0.10)',
                border: '1px solid rgba(45,212,191,0.22)',
                color: colors.textMuted, fontSize: '13px',
                cursor: 'pointer', fontFamily: fonts.ui,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: '1',
              }}
            >
              ✕
            </button>

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: 'rgba(45,212,191,0.18)',
                border: '1px solid rgba(45,212,191,0.40)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px',
              }}>
                ✓
              </div>
              <div>
                <h2 style={{ fontFamily: fonts.heading, fontSize: '20px', fontWeight: 700, color: colors.text, margin: 0, lineHeight: 1.2 }}>
                  Lab saved
                </h2>
                <span style={{ fontSize: '12px', color: colors.textMuted }}>
                  {savedCount} {savedCount === 1 ? 'biomarker' : 'biomarkers'} added to Snapshot
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 20px', lineHeight: 1.6 }}>
              Your confirmed biomarkers were added to your Lab Snapshot.{' '}
              <span style={{ color: colors.textMuted }}>
                Upload another PDF if this lab visit included more than one file.
              </span>
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <motion.button
                onClick={() => {
                  handleReset()
                  setTimeout(() => fileInputRef.current?.click(), 60)
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  flex: 1, padding: '12px 16px',
                  background: `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`,
                  border: 'none', borderRadius: '10px', color: colors.background,
                  fontFamily: fonts.ui, fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Upload another PDF
              </motion.button>
              <button
                onClick={handleReset}
                style={{
                  flex: 1, padding: '12px 16px',
                  backgroundColor: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '10px',
                  color: colors.textSoft, fontFamily: fonts.ui, fontSize: '14px',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                View Labs
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
            {labsView === 'snapshot' && hasRecentLabs && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                style={{ marginBottom: '32px' }}
              >
                {/* Section label */}
                <p style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em',
                  color: colors.textMuted, textTransform: 'uppercase',
                  margin: '0 0 14px',
                }}>
                  Current Biomarker Snapshot
                </p>

                {/* Snapshot / Timeline toggle */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{
                    display: 'inline-flex',
                    gap: '3px',
                    padding: '4px',
                    backgroundColor: 'rgba(232,248,245,0.04)',
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '24px',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}>
                    {(['snapshot', 'history'] as const).map(view => {
                      const isActive = labsView === view
                      return (
                        <button
                          key={view}
                          onClick={() => {
                            setLabsView(view)
                            if (view === 'history' && !histFetched) loadHistoryData()
                          }}
                          style={{
                            padding: '6px 20px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 600,
                            fontFamily: fonts.ui,
                            cursor: 'pointer',
                            border: 'none',
                            backgroundColor: isActive ? 'rgba(45,212,191,0.14)' : 'transparent',
                            color: isActive ? colors.teal : colors.textMuted,
                            transition: 'background 0.15s ease, color 0.15s ease',
                            letterSpacing: '0.01em',
                            outline: 'none',
                            boxShadow: isActive ? 'inset 0 1px 0 rgba(45,212,191,0.18)' : 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {view === 'snapshot' ? 'Snapshot' : 'Timeline'}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: colors.textMuted, margin: '6px 0 16px' }}>
                  Current Year · {currentYear}
                </p>

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
                    <p style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                      {activeFilter} Biomarkers
                    </p>
                    {filteredBiomarkers.length > 0 ? (
                      <div>
                        {filteredGrouped.map(({ panel, markers }) => (
                          <div key={panel} style={{ marginBottom: '14px' }}>
                            {/* Panel section header */}
                            <p style={{
                              fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
                              textTransform: 'uppercase', color: colors.textMuted,
                              margin: '0 0 8px 2px',
                            }}>
                              {panel}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {markers.map(b => {
                                const s = getStateStyles(b.state ?? '')
                                const showBar = isUsableRange(b.reference_range_min, b.reference_range_max)
                                return (
                                  <div key={b.id} style={{
                                    padding: '14px 16px',
                                    backgroundColor: 'rgba(232,248,245,0.055)',
                                    border: `1px solid ${s.dot}30`,
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.18)`,
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
                                      <BiomarkerRangeBar value={b.value} refMin={b.reference_range_min!} refMax={b.reference_range_max!} state={b.state} slug={b.marker_name} />
                                    ) : (
                                      <div style={{ height: '3px', borderRadius: '2px', marginTop: '10px', background: `linear-gradient(90deg, transparent 0%, ${s.dot}38 35%, ${s.dot}55 65%, transparent 100%)` }} />
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
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
                    {/* ── View mode control ── */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text, whiteSpace: 'nowrap' }}>
                          View mode:
                        </span>
                        <div style={{
                          display: 'inline-flex',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${colors.cardBorder}`,
                          borderRadius: '10px',
                          padding: '3px',
                          gap: '2px',
                        }}>
                          <button
                            onClick={() => { setSnapshotViewMode('clinical_panels'); setOptimalExpanded(new Set()) }}
                            style={{
                              padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                              cursor: 'pointer', fontFamily: fonts.ui, outline: 'none', border: 'none',
                              background: snapshotViewMode === 'clinical_panels' ? 'rgba(45,212,191,0.13)' : 'transparent',
                              color: snapshotViewMode === 'clinical_panels' ? colors.teal : colors.textMuted,
                              boxShadow: snapshotViewMode === 'clinical_panels' ? '0 0 10px rgba(45,212,191,0.10)' : 'none',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Clinical Panels
                          </button>
                          <button
                            onClick={() => { setSnapshotViewMode('signal_map'); setOptimalExpanded(new Set()) }}
                            style={{
                              padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                              cursor: 'pointer', fontFamily: fonts.ui, outline: 'none', border: 'none',
                              background: snapshotViewMode === 'signal_map' ? 'rgba(45,212,191,0.13)' : 'transparent',
                              color: snapshotViewMode === 'signal_map' ? colors.teal : colors.textMuted,
                              boxShadow: snapshotViewMode === 'signal_map' ? '0 0 10px rgba(45,212,191,0.10)' : 'none',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Signal Map
                          </button>
                        </div>
                      </div>
                      <p style={{ fontSize: '11px', color: colors.textMuted, marginTop: '6px', lineHeight: 1.5 }}>
                        {snapshotViewMode === 'clinical_panels'
                          ? 'Grouped by clinical lab panels.'
                          : 'Grouped by biological signal layers.'}
                      </p>
                    </div>

                    {/* ── Current Markers ── */}
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.textMuted, marginBottom: '12px' }}>
                        Current Markers
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {currentMarkerGroups.map(group => {
                          const abnormal    = group.markers.filter(b => b.state !== 'Optimal')
                          const optimal     = group.markers.filter(b => b.state === 'Optimal')
                          const optKey      = `${snapshotViewMode}::${group.key}`
                          const isOptExp    = optimalExpanded.has(optKey)
                          const hiddenOpt   = Math.max(0, optimal.length - OPTIMAL_SHOW_LIMIT)
                          const visibleOpt  = isOptExp ? optimal : optimal.slice(0, OPTIMAL_SHOW_LIMIT)
                          const sc          = group.stateCounts
                          return (
                            <div key={group.key} style={{
                              backgroundColor: colors.cardBg,
                              border: `1px solid ${colors.cardBorder}`,
                              borderRadius: '14px',
                              backdropFilter: 'blur(24px)',
                              WebkitBackdropFilter: 'blur(24px)',
                              overflow: 'hidden',
                            }}>
                              {/* Group header */}
                              <div style={{ padding: '14px 18px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text, flex: 1, minWidth: '100px' }}>{group.label}</span>
                                  <span style={{ fontSize: '11px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                                    {group.count} {group.count === 1 ? 'marker' : 'markers'}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                    {sc.Critical > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#F87171' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#F87171', display: 'inline-block' }} />{sc.Critical}</span>}
                                    {sc.Attention > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#FB923C' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FB923C', display: 'inline-block' }} />{sc.Attention}</span>}
                                    {sc.Watch > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#FCD34D' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FCD34D', display: 'inline-block' }} />{sc.Watch}</span>}
                                    {sc.Optimal > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#2DD4BF' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#2DD4BF', display: 'inline-block' }} />{sc.Optimal}</span>}
                                  </div>
                                </div>
                                <span style={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.5, display: 'block' }}>
                                  {group.education}
                                </span>
                              </div>

                              {/* Marker rows */}
                              <div style={{ borderTop: `1px solid ${colors.cardBorder}`, padding: '10px 14px 14px' }}>
                                {/* Abnormal: Critical → Attention → Watch */}
                                {abnormal.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: optimal.length > 0 ? '10px' : '0' }}>
                                    {abnormal.map(b => {
                                      const s = getStateStyles(b.state ?? '')
                                      const showBar = !b.flag_error && isUsableRange(b.reference_range_min, b.reference_range_max)
                                      return (
                                        <div
                                          key={b.id}
                                          onClick={() => setSelectedBiomarker(b)}
                                          style={{
                                            padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                                            backgroundColor: 'rgba(232,248,245,0.055)',
                                            border: `1px solid ${s.dot}30`,
                                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.18)',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: showBar ? '8px' : '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, flex: 1, minWidth: 0 }}>
                                              {markerDisplayName(b.marker_name)}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                              <span style={{ fontSize: '15px', fontWeight: 700, color: colors.text }}>{b.value}</span>
                                              {b.unit && <span style={{ fontSize: '11px', color: colors.textMuted }}>{b.unit}</span>}
                                              <span style={{ padding: '2px 7px', borderRadius: '5px', fontSize: '10px', fontWeight: 700, backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.dot, letterSpacing: '0.04em' }}>{s.label}</span>
                                              <span style={{ fontSize: '13px', color: colors.textMuted, opacity: 0.4, lineHeight: 1 }}>›</span>
                                            </div>
                                          </div>
                                          {showBar ? (
                                            <BiomarkerRangeBar value={b.value} refMin={b.reference_range_min!} refMax={b.reference_range_max!} state={b.state} slug={b.marker_name} />
                                          ) : (
                                            <span style={{ fontSize: '10px', color: colors.textMuted, opacity: 0.55 }}>Range data not available.</span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* Divider */}
                                {abnormal.length > 0 && optimal.length > 0 && (
                                  <div style={{ height: '1px', background: colors.cardBorder, marginBottom: '8px' }} />
                                )}

                                {/* Optimal: calm compact rows */}
                                {visibleOpt.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {visibleOpt.map(b => {
                                      // Optimal range pill: prefer optimal_range when valid
                                      const hasOptRange = !b.flag_error && isUsableRange(b.optimal_range_min, b.optimal_range_max)
                                      // Reference range pill: only shown when the value actually falls within the
                                      // stored bounds — prevents showing misleading category/borderline bands
                                      // (e.g. Triglycerides "Ref 150–199" while value is 66, state Optimal)
                                      const hasRefRange = !b.flag_error && isUsableRange(b.reference_range_min, b.reference_range_max)
                                      const refInRange  = hasRefRange &&
                                        b.value >= b.reference_range_min! &&
                                        b.value <= b.reference_range_max!
                                      const pillStyle: React.CSSProperties = {
                                        fontSize: '9px', color: 'rgba(154,203,193,0.65)',
                                        backgroundColor: 'rgba(103,232,249,0.05)',
                                        border: '1px solid rgba(103,232,249,0.10)',
                                        borderRadius: '20px', padding: '1px 7px', whiteSpace: 'nowrap',
                                      }
                                      return (
                                        <div
                                          key={b.id}
                                          onClick={() => setSelectedBiomarker(b)}
                                          style={{
                                            padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap',
                                            backgroundColor: 'rgba(45,212,191,0.03)',
                                            border: '1px solid rgba(45,212,191,0.09)',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, minWidth: '100px' }}>
                                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#2DD4BF', flexShrink: 0 }} />
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textSoft }}>{markerDisplayName(b.marker_name)}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>{b.value}</span>
                                            {b.unit && <span style={{ fontSize: '11px', color: colors.textMuted }}>{b.unit}</span>}
                                            {hasOptRange && (
                                              <span style={pillStyle}>Opt {b.optimal_range_min}–{b.optimal_range_max}</span>
                                            )}
                                            {!hasOptRange && refInRange && (
                                              <span style={pillStyle}>Ref {b.reference_range_min}–{b.reference_range_max}</span>
                                            )}
                                            <span style={{ padding: '2px 7px', backgroundColor: colors.optimal, border: `1px solid ${colors.optimalBorder}`, borderRadius: '5px', fontSize: '10px', fontWeight: 700, color: '#2DD4BF', letterSpacing: '0.04em' }}>Optimal</span>
                                            <span style={{ fontSize: '13px', color: colors.textMuted, opacity: 0.4, lineHeight: 1 }}>›</span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* Progressive disclosure */}
                                {!isOptExp && hiddenOpt > 0 && (
                                  <button
                                    onClick={() => toggleOptimalExpand(optKey)}
                                    style={{
                                      marginTop: '8px', width: '100%', padding: '8px', borderRadius: '8px',
                                      background: 'transparent', border: `1px solid rgba(45,212,191,0.12)`,
                                      color: colors.textMuted, fontSize: '12px', fontWeight: 600,
                                      cursor: 'pointer', fontFamily: fonts.ui, outline: 'none', textAlign: 'center',
                                    }}
                                  >
                                    View {hiddenOpt} more optimal {hiddenOpt === 1 ? 'marker' : 'markers'}
                                  </button>
                                )}
                                {isOptExp && optimal.length > OPTIMAL_SHOW_LIMIT && (
                                  <button
                                    onClick={() => toggleOptimalExpand(optKey)}
                                    style={{
                                      marginTop: '8px', width: '100%', padding: '8px', borderRadius: '8px',
                                      background: 'transparent', border: `1px solid rgba(45,212,191,0.12)`,
                                      color: colors.textMuted, fontSize: '12px', fontWeight: 600,
                                      cursor: 'pointer', fontFamily: fonts.ui, outline: 'none', textAlign: 'center',
                                    }}
                                  >
                                    Hide extra optimal markers
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ── No recent labs, but older labs exist ── */}
            {labsView === 'snapshot' && !hasRecentLabs && hasAnyLabs && (
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
                    Your confirmed results are saved in Timeline.
                  </p>
                </div>
                <button
                  onClick={() => { setLabsView('history'); if (!histFetched) loadHistoryData() }}
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
                  View Timeline →
                </button>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                TIMELINE VIEW — shown when Timeline tab is active
                ════════════════════════════════════════════════════════════════ */}
            {labsView === 'history' && (
              <div style={{ marginBottom: '32px' }}>
                {/* Timeline section header */}
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: colors.textMuted, margin: '0 0 4px' }}>
                    Timeline
                  </p>
                  <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0, lineHeight: 1.5 }}>
                    Your confirmed lab results over time.
                  </p>
                </div>
                {/* Loading spinner */}
                {histLoading && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
                    <div style={{ width: '32px', height: '32px', border: `3px solid rgba(103,232,249,0.2)`, borderTopColor: colors.teal, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}
                {/* Error */}
                {histError && !histLoading && (
                  <div style={{ padding: '20px 24px', backgroundColor: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: '14px', marginBottom: '24px' }}>
                    <p style={{ fontSize: '14px', color: '#F87171', margin: 0 }}>{histError}</p>
                  </div>
                )}
                {/* Empty */}
                {!histLoading && !histError && histGroupRows(histBiomarkers).length === 0 && (
                  <div style={{ padding: '56px 24px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', textAlign: 'center', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>🧬</div>
                    <p style={{ fontSize: '16px', color: colors.textSoft, marginBottom: '6px', fontWeight: 600 }}>No saved labs yet.</p>
                    <p style={{ fontSize: '13px', color: colors.textMuted }}>Upload a lab PDF to see your biomarkers here.</p>
                  </div>
                )}
                {/* Year groups */}
                {!histLoading && histGroupRows(histBiomarkers).map(yearGroup => (
                  <div key={yearGroup.year} style={{ marginBottom: '36px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                      <span style={{ fontFamily: fonts.heading, fontSize: '22px', fontWeight: 700, color: colors.text, letterSpacing: '-0.02em' }}>{yearGroup.year}</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: colors.cardBorder }} />
                    </div>
                    {yearGroup.months.map(monthGroup => (
                      <div key={monthGroup.monthKey} style={{ marginBottom: '32px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px' }}>{monthGroup.label}</p>
                        {monthGroup.dates.map(dateGroup => (
                          <div key={dateGroup.dateKey} style={{ marginBottom: '20px' }}>
                            {/* Date header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', paddingLeft: '4px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors.teal, flexShrink: 0, boxShadow: `0 0 6px ${colors.teal}80` }} />
                              <span style={{ fontSize: '14px', fontWeight: 700, color: colors.teal, letterSpacing: '0.02em' }}>{dateGroup.label}</span>
                              <span style={{ fontSize: '12px', color: colors.textMuted, flex: 1 }}>
                                {dateGroup.total} {dateGroup.total === 1 ? 'biomarker' : 'biomarkers'} · {dateGroup.panelCount} {dateGroup.panelCount === 1 ? 'panel' : 'panels'}
                              </span>
                              <button
                                onClick={() => setDeleteConfirmDate(deleteConfirmDate === dateGroup.dateKey ? null : dateGroup.dateKey)}
                                style={{ padding: '3px 9px', backgroundColor: 'transparent', border: `1px solid rgba(95,142,133,0.28)`, borderRadius: '6px', color: colors.textMuted, fontFamily: fonts.ui, fontSize: '11px', cursor: 'pointer', flexShrink: 0, lineHeight: 1.6, outline: 'none' }}
                              >Delete</button>
                            </div>
                            {/* Delete confirm */}
                            {deleteConfirmDate === dateGroup.dateKey && (
                              <div style={{ marginBottom: '10px', padding: '12px 16px', backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', color: colors.textSoft, flex: 1, lineHeight: 1.5 }}>Delete all {dateGroup.total} biomarkers from {dateGroup.label}? This cannot be undone.</span>
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                  <button onClick={() => setDeleteConfirmDate(null)} style={{ padding: '6px 14px', backgroundColor: 'transparent', border: `1px solid ${colors.cardBorder}`, borderRadius: '7px', color: colors.textMuted, fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>Cancel</button>
                                  <button onClick={() => handleDeleteSession(dateGroup.dateKey)} disabled={deleteLoading} style={{ padding: '6px 14px', backgroundColor: 'rgba(248,113,113,0.13)', border: '1px solid rgba(248,113,113,0.38)', borderRadius: '7px', color: '#F87171', fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600, cursor: deleteLoading ? 'not-allowed' : 'pointer', outline: 'none' }}>
                                    {deleteLoading ? 'Deleting…' : 'Delete session'}
                                  </button>
                                </div>
                              </div>
                            )}
                            {/* Panel accordion list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {dateGroup.panels.map(panelGroup => {
                                const panelKey = `${dateGroup.dateKey}::${panelGroup.panel}`
                                const isOpen = expandedPanels.has(panelKey)
                                const sc = panelGroup.stateCounts
                                return (
                                  <div key={panelGroup.panel} style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', overflow: 'hidden' }}>
                                    {/* Panel header (toggle) */}
                                    <button onClick={() => toggleHistPanel(dateGroup.dateKey, panelGroup.panel)} style={{ width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', outline: 'none' }}>
                                      <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text, flex: 1, minWidth: 0 }}>{panelGroup.panel}</span>
                                      <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>{panelGroup.items.length} {panelGroup.items.length === 1 ? 'marker' : 'markers'}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                        {sc.Optimal > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#2DD4BF' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2DD4BF', display: 'inline-block' }} />{sc.Optimal}</span>}
                                        {sc.Watch > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#FCD34D' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FCD34D', display: 'inline-block' }} />{sc.Watch}</span>}
                                        {sc.Attention > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#FB923C' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FB923C', display: 'inline-block' }} />{sc.Attention}</span>}
                                        {sc.Critical > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#F87171' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F87171', display: 'inline-block' }} />{sc.Critical}</span>}
                                      </div>
                                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                        <path d="M4 6l4 4 4-4" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                    {/* Panel biomarker rows */}
                                    {isOpen && (
                                      <div style={{ borderTop: `1px solid ${colors.cardBorder}`, padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {panelGroup.items.map(b => {
                                          const s = histGetStateStyle(b.state)
                                          const showBar = !b.flag_error && isUsableRange(b.reference_range_min, b.reference_range_max)
                                          if (showBar) {
                                            return (
                                              <div key={b.id} style={{ backgroundColor: 'rgba(232,248,245,0.055)', border: `1px solid ${s.dot}30`, borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.18)' }} onClick={() => setHistSelectedBiomarker(b)}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                                                  <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, flex: 1, minWidth: 0 }}>{histMarkerDisplayName(b.marker_name)}</span>
                                                  {b.state && <span style={{ padding: '2px 8px', backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: '5px', fontSize: '10px', fontWeight: 700, color: s.dot, letterSpacing: '0.04em', flexShrink: 0 }}>{s.label}</span>}
                                                </div>
                                                <div style={{ marginBottom: '4px' }}>
                                                  <span style={{ fontSize: '22px', fontWeight: 800, color: colors.text, lineHeight: '1' }}>{b.value}</span>
                                                  {b.unit && <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: '5px' }}>{b.unit}</span>}
                                                </div>
                                                <BiomarkerRangeBar value={b.value} refMin={b.reference_range_min!} refMax={b.reference_range_max!} state={b.state} slug={b.marker_name} />
                                              </div>
                                            )
                                          }
                                          return (
                                            <div key={b.id} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', backgroundColor: b.flag_error ? 'rgba(248,113,113,0.06)' : 'rgba(232,248,245,0.03)', border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.14)' }} onClick={() => setHistSelectedBiomarker(b)}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, minWidth: '130px' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: b.flag_error ? '#F87171' : s.dot, flexShrink: 0 }} />
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>{histMarkerDisplayName(b.marker_name)}</span>
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                <span style={{ fontSize: '15px', fontWeight: 700, color: colors.text }}>{b.value}</span>
                                                {b.unit && <span style={{ fontSize: '11px', color: colors.textMuted }}>{b.unit}</span>}
                                                {b.flag_error ? (
                                                  <span style={{ padding: '2px 7px', backgroundColor: colors.critical, border: `1px solid ${colors.criticalBorder}`, borderRadius: '5px', fontSize: '10px', fontWeight: 700, color: '#F87171', letterSpacing: '0.04em' }}>FLAGGED</span>
                                                ) : b.state && (
                                                  <span style={{ padding: '2px 7px', backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: '5px', fontSize: '10px', fontWeight: 700, color: s.dot, letterSpacing: '0.04em' }}>{s.label}</span>
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
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                UPLOAD AREA — Snapshot view only
                ════════════════════════════════════════════════════════════════ */}
            {labsView === 'snapshot' && (
              <>
                {/* Upload section heading (only shown when recent labs exist, to distinguish the CTA) */}
                {hasRecentLabs && (
                  <p style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
                    color: colors.textMuted, textTransform: 'uppercase', marginBottom: '12px',
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
                      justifyContent: 'center',
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
          </>
        )}

      </div>
      <NavBar />
    </div>
  )
}
