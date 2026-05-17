'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar from '@/components/NavBar'
import { getSafetyStatusForBiomarker } from '@/lib/safety-engine'
import { getNextOnboardingStep } from '@/lib/onboarding'
import { resolveDisplayRange } from '@/lib/range-resolver'
import { buildClinicalSnapshot, isUrinalysisCategorical } from '@/lib/panel-reconstruction'
import { getClinicalContextualState, getTrendDisplayProps } from '@/lib/trend-engine'

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
  source_marker_name: string
  source_raw_value: string
  qualitative_value: string | null
  extraction_status: 'parsed' | 'unreadable' | 'partial' | 'qualitative_only'
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
  value: number | null          // null for qualitative markers; always numeric for quantitative
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
  mcv: 'CBC', mch: 'CBC', mchc: 'CBC', rdw: 'CBC', rdw_sd: 'CBC',
  // Phase 1 hardening: added canonical 'platelets' + 'mpv' slugs alongside legacy aliases
  platelets: 'CBC', platelet_count: 'CBC', platelet_count_abs: 'CBC',
  mpv: 'CBC',
  neutrophils_pct: 'CBC', neutrophils_abs: 'CBC',
  lymphocytes_pct: 'CBC', lymphocytes_abs: 'CBC',
  monocytes_pct: 'CBC', monocytes_abs: 'CBC',
  eosinophils_pct: 'CBC', eosinophils_abs: 'CBC',
  basophils_pct: 'CBC', basophils_abs: 'CBC',
  immature_granulocytes_pct: 'CBC', immature_granulocytes_abs: 'CBC',
  nrbc_pct: 'CBC', nrbc_abs: 'CBC',
  hba1c: 'Glycemic', insulin_fasting: 'Glycemic',
  total_cholesterol: 'Lipid Panel', hdl: 'Lipid Panel', ldl: 'Lipid Panel',
  vldl: 'Lipid Panel', triglycerides: 'Lipid Panel', non_hdl: 'Lipid Panel',
  ldl_hdl_ratio: 'Lipid Panel', chol_hdl_ratio: 'Lipid Panel',
  testosterone_total: 'Hormones', cortisol_am: 'Hormones', dhea_s: 'Hormones',
  tpo_antibodies: 'Thyroid Panel', acth: 'Hormones',
  crp_hs: 'Inflammation / Cardiac Risk', homocysteine: 'Inflammation / Cardiac Risk',
  vitamin_d: 'Vitamins & Nutrients', vitamin_b12: 'Vitamins & Nutrients',
  folate: 'Vitamins & Nutrients', magnesium: 'Vitamins & Nutrients', ferritin: 'Vitamins & Nutrients',
  creatinine: 'Kidney / Renal', bun: 'Kidney / Renal', bun_creatinine_ratio: 'Kidney / Renal',
  egfr: 'Kidney / Renal', egfr_african_american: 'Kidney / Renal', egfr_non_african_american: 'Kidney / Renal',
  ast: 'Liver', alt: 'Liver', alkaline_phosphatase: 'Liver',
  bilirubin_total: 'Liver', albumin: 'Liver', globulin: 'Liver',
  ag_ratio: 'Liver', total_protein: 'Liver',
  glucose_fasting: 'Glycemic', sodium: 'Electrolytes', potassium: 'Electrolytes',
  chloride: 'Electrolytes', co2: 'Electrolytes', calcium: 'Electrolytes', anion_gap: 'Electrolytes',
  // Urinalysis — dipstick, physical, and microscopy
  urine_color: 'Urinalysis', urine_clarity: 'Urinalysis',
  urine_specific_gravity: 'Urinalysis', urine_ph: 'Urinalysis',
  urine_glucose_ua: 'Urinalysis', urine_protein_ua: 'Urinalysis',
  urine_blood_ua: 'Urinalysis', urine_ketones_ua: 'Urinalysis',
  urine_bilirubin_ua: 'Urinalysis', urine_urobilinogen_ua: 'Urinalysis',
  urine_nitrite_ua: 'Urinalysis', urine_leukocyte_esterase_ua: 'Urinalysis',
  urine_wbc_hpf: 'Urinalysis', urine_rbc_hpf: 'Urinalysis',
  urine_bacteria_hpf: 'Urinalysis', urine_epithelial_cells_hpf: 'Urinalysis',
  urine_casts_hpf: 'Urinalysis', urine_mucus_hpf: 'Urinalysis',
}

function inferPanel(slug: string): string {
  return SLUG_TO_PANEL[slug] ?? 'Other'
}

const PANEL_ORDER = [
  'CBC', 'Lipid Panel', 'Glycemic', 'Kidney / Renal', 'Liver', 'Electrolytes',
  'Thyroid Panel', 'Vitamins & Nutrients',
  'Hormones', 'Inflammation / Cardiac Risk', 'Urinalysis', 'Other',
]

// ── Snapshot view mode ────────────────────────────────────────────────────────
type SnapshotViewMode = 'clinical_panels' | 'signal_map'

// How many Optimal markers to show before progressive disclosure
const OPTIMAL_SHOW_LIMIT = 5

// Marker state sort priority (Critical first)
// Sprint 1: Clinical Stability Phase — new states sort alongside legacy equivalents.
// Critical (0) → Low/High (1) → Attention (2) → Watch (3) → Normal/Optimal (4)
const SNAPSHOT_STATE_SORT: Record<string, number> = {
  Critical: 0,
  Low: 1, High: 1,
  Attention: 2,
  Watch: 3,
  Normal: 4, Optimal: 4,
}

// ── Clinical Panels mapping ───────────────────────────────────────────────────
const CLINICAL_SLUG_TO_PANEL: Record<string, string> = {
  // CBC
  wbc: 'CBC', rbc: 'CBC', hemoglobin: 'CBC', hematocrit: 'CBC',
  mcv: 'CBC', mch: 'CBC', mchc: 'CBC', rdw: 'CBC', rdw_sd: 'CBC',
  platelets: 'CBC', platelet_count: 'CBC', platelet_count_abs: 'CBC', mpv: 'CBC',
  neutrophils_pct: 'CBC', neutrophils_abs: 'CBC',
  lymphocytes_pct: 'CBC', lymphocytes_abs: 'CBC',
  monocytes_pct: 'CBC', monocytes_abs: 'CBC',
  eosinophils_pct: 'CBC', eosinophils_abs: 'CBC',
  basophils_pct: 'CBC', basophils_abs: 'CBC',
  immature_granulocytes_pct: 'CBC', immature_granulocytes_abs: 'CBC',
  nrbc_pct: 'CBC', nrbc_abs: 'CBC',
  // Lipid Panel
  total_cholesterol: 'Lipid Panel', hdl: 'Lipid Panel', ldl: 'Lipid Panel',
  vldl: 'Lipid Panel', non_hdl: 'Lipid Panel', triglycerides: 'Lipid Panel',
  ldl_hdl_ratio: 'Lipid Panel', chol_hdl_ratio: 'Lipid Panel',
  // Glycemic
  hba1c: 'Glycemic', insulin_fasting: 'Glycemic', glucose_fasting: 'Glycemic',
  // Kidney / Renal
  creatinine: 'Kidney / Renal', bun: 'Kidney / Renal', bun_creatinine_ratio: 'Kidney / Renal',
  egfr: 'Kidney / Renal', egfr_african_american: 'Kidney / Renal', egfr_non_african_american: 'Kidney / Renal',
  // Liver
  ast: 'Liver', alt: 'Liver', alkaline_phosphatase: 'Liver', bilirubin_total: 'Liver',
  albumin: 'Liver', globulin: 'Liver', ag_ratio: 'Liver', total_protein: 'Liver',
  // Electrolytes
  sodium: 'Electrolytes', potassium: 'Electrolytes', chloride: 'Electrolytes',
  co2: 'Electrolytes', calcium: 'Electrolytes', anion_gap: 'Electrolytes',
  // Thyroid Panel
  tsh: 'Thyroid Panel', free_t4: 'Thyroid Panel', free_t3: 'Thyroid Panel', total_t3: 'Thyroid Panel',
  tpo_antibodies: 'Thyroid Panel',
  // Vitamins & Nutrients (includes ferritin / iron stores)
  vitamin_d: 'Vitamins & Nutrients', vitamin_b12: 'Vitamins & Nutrients',
  folate: 'Vitamins & Nutrients', magnesium: 'Vitamins & Nutrients', ferritin: 'Vitamins & Nutrients',
  // Hormones
  testosterone_total: 'Hormones', dhea_s: 'Hormones', cortisol_am: 'Hormones',
  acth: 'Hormones',
  // Inflammation / Cardiac Risk
  crp_hs: 'Inflammation / Cardiac Risk', homocysteine: 'Inflammation / Cardiac Risk',
  // Urinalysis — dipstick, physical, and microscopy
  urine_color: 'Urinalysis', urine_clarity: 'Urinalysis',
  urine_specific_gravity: 'Urinalysis', urine_ph: 'Urinalysis',
  urine_glucose_ua: 'Urinalysis', urine_protein_ua: 'Urinalysis',
  urine_blood_ua: 'Urinalysis', urine_ketones_ua: 'Urinalysis',
  urine_bilirubin_ua: 'Urinalysis', urine_urobilinogen_ua: 'Urinalysis',
  urine_nitrite_ua: 'Urinalysis', urine_leukocyte_esterase_ua: 'Urinalysis',
  urine_wbc_hpf: 'Urinalysis', urine_rbc_hpf: 'Urinalysis',
  urine_bacteria_hpf: 'Urinalysis', urine_epithelial_cells_hpf: 'Urinalysis',
  urine_casts_hpf: 'Urinalysis', urine_mucus_hpf: 'Urinalysis',
}

const CLINICAL_PANEL_ORDER = [
  'CBC', 'Lipid Panel', 'Glycemic', 'Kidney / Renal', 'Liver', 'Electrolytes',
  'Thyroid Panel', 'Vitamins & Nutrients', 'Hormones', 'Inflammation / Cardiac Risk',
  'Urinalysis', 'Other',
]

const CLINICAL_PANEL_EDUCATION: Record<string, string> = {
  'CBC':                         'Your CBC gives Meridian a window into immune activity, oxygen-carrying capacity, and red and white cell patterns — signals that can shift in response to stress, recovery, nutrition, and more.',
  'Lipid Panel':                 'Cholesterol markers tell a story about how your body transports fats. Meridian watches trends here over time because single readings rarely capture the full cardiovascular picture.',
  'Glycemic':                    'Blood sugar regulation shapes energy, metabolism, and long-term tissue health. Meridian watches glycemic markers together because the pattern across multiple results matters more than any one number.',
  'Kidney / Renal':              'Kidney filtration and waste-clearance markers that Meridian watches over time — because kidney capacity tends to shift gradually, and trends carry more signal than any single reading.',
  'Liver':                       'Liver enzyme and protein markers that can reflect how the liver is responding to stress, recovery, nutrition, and metabolic demands over time.',
  'Electrolytes':                'Electrolyte balance governs fluid regulation, acid-base chemistry, and cellular signaling. Meridian watches these together because shifts in one often reflect shifts in the broader system.',
  'Thyroid Panel':               'Your thyroid influences metabolism, energy, temperature regulation, and recovery. Meridian tracks these signals over time because thyroid function tends to shift gradually.',
  'Vitamins & Nutrients':        'Micronutrient levels — including iron stores — can quietly influence energy, immunity, mood, and recovery. Meridian watches trends here because deficiencies often develop slowly over time.',
  'Hormones':                    'Hormonal signals shape energy, recovery, stress response, libido, and mood. Meridian watches these as an interconnected system because no single hormone operates alone.',
  'Inflammation / Cardiac Risk': 'Low-grade inflammation is a background signal linked to cardiovascular risk, metabolic health, and recovery. Meridian watches it over time because sustained elevation can matter more than a one-off reading.',
  'Urinalysis':                  'Urine findings give Meridian a snapshot of kidney and urinary tract health, hydration balance, and chemical patterns that complement bloodwork context.',
  'Other':                       'These markers add additional context to your biological profile. Meridian tracks them alongside related signals for a more complete picture.',
}

// ── Signal Map mapping ────────────────────────────────────────────────────────
const SIGNAL_SLUG_TO_LAYER: Record<string, string> = {
  // Cardiovascular
  total_cholesterol: 'Cardiovascular', hdl: 'Cardiovascular', ldl: 'Cardiovascular',
  vldl: 'Cardiovascular', non_hdl: 'Cardiovascular', triglycerides: 'Cardiovascular',
  ldl_hdl_ratio: 'Cardiovascular', chol_hdl_ratio: 'Cardiovascular',
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
  tpo_antibodies: 'Thyroid / Energy',
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
  testosterone_total: 'Hormones', dhea_s: 'Hormones', cortisol_am: 'Hormones', acth: 'Hormones',
  // Inflammation
  crp_hs: 'Inflammation', homocysteine: 'Inflammation',
  // RDW-SD maps to Blood / Oxygen layer (same as RDW-CV)
  rdw_sd: 'Blood / Oxygen',
  // Urinary — all urinalysis slugs map to the existing 'Urinary' signal layer
  urine_color: 'Urinary', urine_clarity: 'Urinary',
  urine_specific_gravity: 'Urinary', urine_ph: 'Urinary',
  urine_glucose_ua: 'Urinary', urine_protein_ua: 'Urinary',
  urine_blood_ua: 'Urinary', urine_ketones_ua: 'Urinary',
  urine_bilirubin_ua: 'Urinary', urine_urobilinogen_ua: 'Urinary',
  urine_nitrite_ua: 'Urinary', urine_leukocyte_esterase_ua: 'Urinary',
  urine_wbc_hpf: 'Urinary', urine_rbc_hpf: 'Urinary',
  urine_bacteria_hpf: 'Urinary', urine_epithelial_cells_hpf: 'Urinary',
  urine_casts_hpf: 'Urinary', urine_mucus_hpf: 'Urinary',
}

const SIGNAL_LAYER_ORDER = [
  'Cardiovascular', 'Metabolic', 'Renal / Filtration', 'Liver', 'Thyroid / Energy',
  'Blood / Oxygen', 'Immune', 'Vitamins & Nutrients', 'Hormones', 'Inflammation', 'Urinary', 'Other',
]

const SIGNAL_LAYER_EDUCATION: Record<string, string> = {
  'Cardiovascular':       'Lipid transport and vascular risk signals. Meridian watches how these move together over time rather than reacting to any single reading.',
  'Metabolic':            'Blood sugar regulation, electrolyte balance, and cellular energy. Shifts here can connect to diet, hydration, stress, and long-term metabolic health.',
  'Renal / Filtration':   'Kidney filtration markers that reflect how well the body is clearing waste and managing fluid balance over time.',
  'Liver':                'Liver enzyme and protein patterns that can reflect cellular stress, recovery, nutrition, and hepatic function changes over time.',
  'Thyroid / Energy':     'Thyroid hormone signals that influence metabolism, energy output, and recovery. Trends here often matter more than isolated snapshots.',
  'Blood / Oxygen':       'Red cell size, count, and oxygen-carrying capacity. These signals can connect to iron status, nutrient availability, and recovery.',
  'Immune':               'White cell counts and differential patterns that can reflect immune activation, recovery stress, or physiological adaptation.',
  'Vitamins & Nutrients': 'Micronutrient status that quietly shapes energy, immunity, mood, and cellular function over time.',
  'Hormones':             'Hormonal signals tied to energy, recovery, stress response, and metabolic balance. Meridian watches these as a system, not in isolation.',
  'Inflammation':         'Systemic inflammation signals that connect to cardiovascular risk, metabolic health, and how the body is managing stress and recovery.',
  'Urinary':              'Kidney and urinary tract markers that add context on filtration, hydration, and urinary health patterns.',
  'Other':                'Additional signals that add context to your broader biological profile.',
}

const PANEL_EDUCATION: Record<string, string> = {
  'CBC':                         'Your CBC helps Meridian understand blood cell patterns, oxygen transport, and immune cell distribution — signals that can shift in response to stress, nutrition, recovery, and more.',
  'Lipid Panel':                 'Your lipid panel helps Meridian understand how your body transports cholesterol and fats. Trends here matter more than individual readings.',
  'Glycemic':                    'Your glycemic markers help Meridian understand blood sugar regulation and longer-term glucose patterns that can connect to metabolic health and energy.',
  'Kidney / Renal':              'These markers give Meridian context on kidney filtration capacity, hydration balance, and waste clearance — signals that tend to shift gradually over time.',
  'Liver':                       'Your liver markers help Meridian understand enzyme patterns and protein metabolism that can reflect how your liver is responding to stress, recovery, medications, and lifestyle patterns.',
  'Electrolytes':                'Your electrolyte markers give Meridian context on fluid balance, acid-base regulation, and cellular signaling — the chemical environment that underpins most physiological processes.',
  'Thyroid Panel':               'Your thyroid panel gives Meridian context on hormone signaling that influences metabolism, energy, temperature regulation, and recovery patterns over time.',
  'Vitamins & Nutrients':        'Your nutrient markers — including iron stores — help Meridian understand micronutrient status that can quietly affect energy, immunity, mood, and recovery over time.',
  'Hormones':                    'Your hormone markers give Meridian context on the signals that shape energy, recovery, stress response, and metabolic balance as an integrated system.',
  'Inflammation / Cardiac Risk': 'Your inflammation and cardiac risk markers help Meridian understand low-grade systemic inflammation and cardiovascular signal patterns over time.',
  'Urinalysis':                  'Your urinalysis adds context on kidney and urinary tract health, hydration, and chemical patterns that complement your bloodwork.',
  'Other':                       'These markers add additional context to your broader biological profile alongside related signals.',
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

// ── Qualitative result display labels ─────────────────────────────────────────
// Maps internal qualitative_value keys to the badge text shown in the UI.
// Covers serology, urinalysis semi-quantitative, microscopy, and color/clarity.
const QUALITATIVE_DISPLAY_LABELS: Record<string, string> = {
  // Serology / infectious disease
  reactive:        'REACTIVE',
  non_reactive:    'NON REACTIVE',
  positive:        'POSITIVE',
  negative:        'NEGATIVE',
  detected:        'DETECTED',
  not_detected:    'NOT DETECTED',
  indeterminate:   'INDETERMINATE',
  equivocal:       'EQUIVOCAL',
  // Urinalysis semi-quantitative
  trace:           'TRACE',
  small:           'SMALL',
  moderate:        'MODERATE',
  large:           'LARGE',
  plus_1:          '1+',
  plus_2:          '2+',
  plus_3:          '3+',
  plus_4:          '4+',
  normal:          'NORMAL',
  abnormal:        'ABNORMAL',
  present:         'PRESENT',
  absent:          'ABSENT',
  // Microscopy counts
  none:            'NONE',
  none_seen:       'NONE SEEN',
  rare:            'RARE',
  few:             'FEW',
  many:            'MANY',
  // Urine color
  yellow:          'YELLOW',
  straw:           'STRAW',
  amber:           'AMBER',
  orange:          'ORANGE',
  red:             'RED',
  brown:           'BROWN',
  // Urine clarity
  clear:           'CLEAR',
  hazy:            'HAZY',
  cloudy:          'CLOUDY',
  turbid:          'TURBID',
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
        Optimal:   items.filter(i => isInRangeState(i.state)).length,
        Watch:     0,
        Attention: items.filter(i => i.state === 'Low' || i.state === 'High' || i.state === 'Attention').length,
        Critical:  items.filter(i => i.state === 'Critical').length,
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

// Sprint 1 — Clinical Stability Phase:
// The Watch guardrail and SYSTEMIC_MARKERS set are no longer needed.
// The new state engine (classifyBiomarkerState) uses only clinical reference ranges
// and never produces a Watch state for new data. Legacy Watch records in the DB
// are handled by backward-compat cases in getStateStyles / getStateColor.

// ── State bucket helpers ────────────────────────────────────────────────────────
// Used for snapshot grouping: compact/quiet row vs emphasized/flagged row.
function isInRangeState(state: string | null): boolean {
  return state === 'Normal' || state === 'Optimal' || state === 'Watch'
}
function isOutOfRangeState(state: string | null): boolean {
  return state === 'Low' || state === 'High' || state === 'Attention' || state === 'Critical'
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
    // ── Clinical Stability Phase states ───────────────────────────────────────
    case 'Normal':    return '#2DD4BF'  // teal — within reference range
    case 'Low':       return '#FB923C'  // orange — below reference range
    case 'High':      return '#FB923C'  // orange — above reference range
    case 'Critical':  return '#F87171'  // red — severe deviation
    // ── Legacy states (backward compat for existing DB records) ───────────────
    case 'Optimal':   return '#2DD4BF'
    case 'Watch':     return '#FCD34D'
    case 'Attention': return '#FB923C'
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

// Gradient definitions — clinical position only, independent from severity
// 13-stop gradient: gradual spectral blending, muted warm tones, luminous teal center
const TRACK_LOW_NORMAL_HIGH = 'linear-gradient(to right, rgba(248,113,113,0.22) 0%, rgba(248,113,113,0.28) 5%, rgba(251,146,60,0.31) 13%, rgba(251,146,60,0.17) 21%, rgba(45,212,191,0.07) 28%, rgba(45,212,191,0.17) 37%, rgba(103,232,249,0.25) 50%, rgba(45,212,191,0.17) 63%, rgba(45,212,191,0.07) 72%, rgba(251,146,60,0.17) 79%, rgba(251,146,60,0.31) 87%, rgba(248,113,113,0.28) 95%, rgba(248,113,113,0.22) 100%)'
const TRACK_UNKNOWN = 'linear-gradient(to right, rgba(95,142,133,0.14) 0%, rgba(95,142,133,0.26) 50%, rgba(95,142,133,0.14) 100%)'

interface RangeBarProps {
  value: number
  refMin: number
  refMax: number
}

function BiomarkerRangeBar({ value, refMin, refMax }: RangeBarProps) {
  const span = Math.max(refMax - refMin, 1e-6)
  // padding = 0.40× span → ref range occupies 55.6% of bar (22%–78%)
  // gives clear visual spread: edge values near edge, out-of-range clearly outside
  const padding = Math.max(span * 0.40, 1)
  const visualMin = refMin - padding
  const visualMax = refMax + padding
  const visualSpan = Math.max(visualMax - visualMin, 1e-6)
  const safeValue = Number.isFinite(value) ? value : refMin
  const dotPct = Math.min(100, Math.max(0, ((safeValue - visualMin) / visualSpan) * 100))
  const leftPct = Math.min(100, Math.max(0, ((refMin - visualMin) / visualSpan) * 100))
  const rightPct = Math.min(100, Math.max(0, ((refMax - visualMin) / visualSpan) * 100))

  return (
    <div style={{ width: '100%', paddingTop: '6px' }}>
      <div style={{
        position: 'relative', height: '8px', borderRadius: '6px', width: '100%',
        background: TRACK_LOW_NORMAL_HIGH,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.30), inset 0 0 20px rgba(103,232,249,0.07), 0 1px 0 rgba(103,232,249,0.03)',
        overflow: 'visible',
      }}>
        {/* Healthy-zone overlay — feathered edges for atmospheric blending */}
        <div style={{
          position: 'absolute',
          left: `${leftPct}%`,
          width: `${Math.max(0, rightPct - leftPct)}%`,
          top: 0,
          bottom: 0,
          background: 'linear-gradient(to right, transparent, rgba(45,212,191,0.09) 20%, rgba(103,232,249,0.19) 50%, rgba(45,212,191,0.09) 80%, transparent)',
        }} />
        {/* Knob */}
        <div style={{
          position: 'absolute', top: '50%', left: `${dotPct}%`,
          transform: 'translate(-50%, -50%)',
          width: '12px', height: '12px', borderRadius: '50%',
          backgroundColor: 'rgba(236,252,249,0.97)',
          border: '1px solid rgba(103,232,249,0.52)',
          boxShadow: '0 0 0 3px rgba(45,212,191,0.10), 0 0 0 6px rgba(45,212,191,0.04), 0 1px 8px rgba(0,0,0,0.34), 0 0 14px rgba(103,232,249,0.20)',
          zIndex: 2,
        }} />
      </div>
    </div>
  )
}

function renderClinicalReferenceBar(value: number, refMin: number, refMax: number, unit?: string) {
  return (
    <>
      <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 8px' }}>
        <span style={{ fontWeight: 600, color: colors.text }}>{refMin} – {refMax}</span>{unit ? ` ${unit}` : ''}
      </p>
      <BiomarkerRangeBar value={value} refMin={refMin} refMax={refMax} />
    </>
  )
}

// ── State style helpers ────────────────────────────────────────────────────────
function getStateStyles(state: string) {
  switch (state) {
    // ── Clinical Stability Phase states ───────────────────────────────────────
    case 'Normal':    return { bg: colors.optimal,   border: colors.optimalBorder,   label: 'Normal',   dot: '#2DD4BF' }
    case 'Low':       return { bg: colors.attention, border: colors.attentionBorder, label: 'Low',      dot: '#FB923C' }
    case 'High':      return { bg: colors.attention, border: colors.attentionBorder, label: 'High',     dot: '#FB923C' }
    case 'Critical':  return { bg: colors.critical,  border: colors.criticalBorder,  label: 'Critical', dot: '#F87171' }
    // ── Legacy states (backward compat for existing DB records) ───────────────
    case 'Optimal':   return { bg: colors.optimal,   border: colors.optimalBorder,   label: 'Normal',   dot: '#2DD4BF' }
    case 'Watch':     return { bg: colors.watch,      border: colors.watchBorder,     label: 'Tracking', dot: '#FCD34D' }
    case 'Attention': return { bg: colors.attention,  border: colors.attentionBorder, label: 'Review',   dot: '#FB923C' }
    default:          return { bg: colors.cardBg,     border: colors.cardBorder,      label: '—',        dot: colors.textMuted }
  }
}

// Returns a small contextual descriptor shown beneath the badge in detail sheets.
// Explains Meridian's interpretation intent vs the clinical range bar — two distinct signals.
function getStateBadgeMeta(state: string): string | null {
  switch (state) {
    case 'Watch':     return 'Meridian observing a contextual pattern'
    case 'Attention': return 'Shifted from clinical reference range'
    case 'Low':       return 'Below clinical reference range'
    case 'High':      return 'Above clinical reference range'
    default:          return null
  }
}

// ── Marker display names ───────────────────────────────────────────────────────
const NAME_OVERRIDES: Record<string, string> = {
  egfr: 'eGFR', egfr_african_american: 'eGFR (African American)', egfr_non_african_american: 'eGFR (Non-African American)',
  ldl_hdl_ratio: 'LDL/HDL Ratio', chol_hdl_ratio: 'Cholesterol/HDL Ratio', non_hdl: 'Non-HDL Cholesterol',
  hba1c: 'Hemoglobin A1c', crp_hs: 'hs-CRP', dhea_s: 'DHEA-S', bun: 'BUN',
  bun_creatinine_ratio: 'BUN/Creatinine Ratio', wbc: 'WBC', rbc: 'RBC',
  mcv: 'MCV', mch: 'MCH', mchc: 'MCHC', rdw: 'RDW', rdw_sd: 'RDW-SD', mpv: 'MPV',
  co2: 'CO₂ (Bicarbonate)', ast: 'AST', alt: 'ALT', tsh: 'TSH',
  ag_ratio: 'A/G Ratio', free_t4: 'Free T4', free_t3: 'Free T3', total_t3: 'Total T3',
  tpo_antibodies: 'TPO Antibodies', acth: 'ACTH',
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
  // ── CBC ───────────────────────────────────────────────────────────────────────
  wbc:                    'WBC gives Meridian a window into immune activity — how many white blood cells are circulating and, alongside the differential, which types are elevated or suppressed. Shifts can connect to immune activation, recovery, physiological stress, or adaptation.',
  rbc:                    'Red blood cells carry oxygen from your lungs to every tissue in your body. Meridian tracks the count because changes over time can connect to iron status, nutrient availability, bone marrow activity, and how efficiently the body is maintaining its oxygen supply.',
  hemoglobin:             'Hemoglobin carries oxygen through your bloodstream and is central to how your body fuels itself. Meridian tracks it alongside RBC and ferritin to understand oxygen transport capacity and how it changes over time.',
  hematocrit:             'Hematocrit reflects what proportion of your blood volume is made up of red blood cells. Meridian watches it as part of the oxygen-transport picture — changes can connect to hydration status, iron stores, and red cell production patterns.',
  mcv:                    'MCV measures the average size of your red blood cells. Meridian watches it because cell size can reflect nutrient availability — particularly iron, B12, and folate — and can sometimes shift before other markers show obvious changes.',
  mch:                    'MCH reflects how much hemoglobin is packed into the average red blood cell. Meridian tracks it alongside MCV and MCHC as part of the red cell quality picture — together these indices give context on how cells are being produced and how efficiently they carry oxygen.',
  mchc:                   'MCHC measures the concentration of hemoglobin inside your red blood cells. Meridian watches it alongside MCV and MCH because together these indices give context on whether cells are being produced efficiently and carrying oxygen optimally.',
  rdw:                    'RDW measures variation in the size of your red blood cells. Meridian watches it because elevated variation can sometimes connect to iron deficiency, B12 status, or emerging changes in cell production — often before other CBC markers shift.',
  platelets:              'Platelets are essential for clotting and vascular repair. Meridian tracks platelet count over time because shifts in either direction can connect to immune activity, inflammatory patterns, and overall blood health.',
  neutrophils_pct:        'Neutrophils are your immune system\'s most abundant first responders — cells that mobilize quickly to sites of infection or inflammation. Meridian watches their proportion because shifts can reflect acute immune activity, physiological stress, or more persistent patterns depending on the surrounding context.',
  neutrophils_abs:        'The absolute neutrophil count reflects how many first-responder immune cells are actively circulating. Meridian tracks it because shifts can connect to immune activation, physiological stress, or recovery — most meaningfully read alongside the full white cell differential.',
  lymphocytes_pct:        'Lymphocytes are the immune cells that coordinate targeted defense — including T cells and B cells. Meridian watches their proportion because changes can connect to immune resilience, recovery patterns, and how the body is managing ongoing physiological demands.',
  lymphocytes_abs:        'The absolute lymphocyte count reflects the circulating level of your targeted immune defense cells. Meridian watches it because changes can connect to immune resilience and recovery — most informative when read alongside the full white cell differential.',
  monocytes_pct:          'Monocytes are immune cells that patrol the bloodstream before maturing into tissue macrophages. Meridian tracks their proportion because elevated counts can sometimes connect to low-grade inflammation, immune activation, or recovery patterns.',
  monocytes_abs:          'The absolute monocyte count reflects how many of your blood-based immune patrol cells are circulating. Meridian watches it because shifts can sometimes connect to inflammatory activity or immune signaling when read alongside the full differential.',
  eosinophils_pct:        'Eosinophils are involved in allergic responses and certain types of tissue inflammation. Meridian watches their proportion because persistently elevated counts can sometimes connect to allergic or inflammatory patterns not obvious from other markers alone.',
  eosinophils_abs:        'The absolute eosinophil count reflects how many of your allergy-related immune cells are circulating. Meridian watches it because elevated counts — particularly when persistent — can connect to allergic inflammation or immune-mediated patterns.',
  basophils_pct:          'Basophils are the least abundant white blood cells, involved in allergic and inflammatory signaling. Meridian tracks them as part of the complete differential picture — changes are most meaningful when read alongside the broader white cell pattern.',
  basophils_abs:          'The absolute basophil count is most relevant as part of the full white cell differential. Meridian watches it as one piece of the immune pattern — most informative alongside the complete differential rather than in isolation.',
  mpv:                    'Mean platelet volume reflects the average size of platelets. Meridian watches it as part of the platelet picture because changes can sometimes connect to platelet production patterns, inflammatory activity, or cardiovascular context.',
  // ── Lipid Panel ───────────────────────────────────────────────────────────────
  hdl:                    'HDL helps transport excess cholesterol away from blood vessels. Meridian watches it alongside triglycerides, inflammation markers, and metabolic trends because the relationship between these signals can sometimes reveal more than a single cholesterol number alone.',
  ldl:                    'LDL is one of the primary cholesterol transport markers in your blood. Meridian tracks it over time as part of a broader cardiovascular picture, since long-term trends tend to be more meaningful than any isolated reading.',
  triglycerides:          'Triglycerides reflect how much fat is circulating in your blood. Meridian watches them alongside HDL and metabolic markers because elevated levels over time can connect to insulin sensitivity, diet patterns, and cardiovascular context.',
  total_cholesterol:      'Total cholesterol on its own tells an incomplete story. Meridian uses it as a starting point — always evaluated alongside HDL, LDL, triglycerides, and inflammation markers to understand the fuller cardiovascular picture.',
  vldl:                   'VLDL carries triglycerides through the bloodstream. Meridian tracks it because elevated VLDL can sometimes connect to metabolic patterns like insulin resistance and elevated triglycerides — signals more meaningful together than in isolation.',
  non_hdl:                'Non-HDL cholesterol captures all the atherogenic particles in your blood — including LDL and VLDL. Meridian watches it because it may give a more complete cardiovascular picture than LDL alone, particularly over time.',
  ldl_hdl_ratio:          'The LDL/HDL ratio reflects the balance between a key atherogenic particle and its protective counterpart. Meridian watches this ratio because it can sometimes carry more cardiovascular signal than either number independently.',
  chol_hdl_ratio:         'The total cholesterol/HDL ratio reflects how much of your total cholesterol is in a protective form. Meridian tracks it over time because the trend in this ratio can sometimes be more meaningful than any individual cholesterol value.',
  // ── CMP / Electrolytes ────────────────────────────────────────────────────────
  glucose_fasting:        'Fasting glucose reflects your blood sugar at rest — a snapshot of how your body is managing energy between meals. Meridian tracks it alongside A1c and insulin to understand glucose regulation patterns over time.',
  sodium:                 'Sodium is the primary electrolyte governing fluid balance in your body. Meridian watches it because shifts — even subtle ones — can connect to hydration status, kidney regulation, adrenal signaling, and how the body is managing fluid at a cellular level.',
  potassium:              'Potassium is critical for heart rhythm, muscle contraction, and cellular energy balance. Meridian watches it because significant deviations in either direction can carry cardiovascular implications and provide context on kidney function and adrenal regulation.',
  chloride:               'Chloride works alongside sodium and bicarbonate to maintain fluid balance and acid-base stability. Meridian watches it as part of the electrolyte system, where patterns across multiple markers are usually more informative than any single value.',
  co2:                    'CO₂ (bicarbonate) reflects how well your body is managing acid-base balance — the chemical equilibrium that underpins most cellular processes. Meridian watches it because shifts can connect to metabolic changes, kidney function, respiratory patterns, and hydration status.',
  calcium:                'Calcium supports bone integrity, muscle contraction, nerve signaling, and heart function. Meridian watches it because blood calcium is tightly regulated — significant deviations can sometimes reflect parathyroid signaling, vitamin D status, or other metabolic patterns.',
  anion_gap:              'The anion gap is a calculated value reflecting the balance of charged particles in your blood. Meridian watches it because elevated levels can sometimes signal metabolic acid accumulation — shifts that may not be obvious from individual electrolyte readings alone.',
  // ── Kidney / Renal ────────────────────────────────────────────────────────────
  creatinine:             'Creatinine is a waste product your kidneys filter continuously. Meridian watches it alongside eGFR and BUN because together they give a fuller picture of kidney filtration and muscle metabolism.',
  egfr:                   'eGFR estimates how efficiently your kidneys are filtering waste from your blood. Meridian tracks it over time because kidney function tends to change gradually, and early directional trends can carry long-term significance.',
  egfr_african_american:  'This adjusted eGFR estimate accounts for biological variation in creatinine production. Meridian watches it as part of long-term kidney context — consistent trends across visits carry more interpretive weight than any single reading.',
  egfr_non_african_american: 'This eGFR estimate reflects how efficiently your kidneys are filtering waste. Meridian tracks it over time because kidney function tends to change gradually, and directional trends across readings carry more significance than any individual result.',
  bun:                    'BUN (blood urea nitrogen) reflects how well your kidneys are filtering protein waste. Meridian watches it alongside creatinine because the ratio between them can also provide context on hydration status and dietary protein patterns.',
  bun_creatinine_ratio:   'The BUN/creatinine ratio gives Meridian additional context on kidney function relative to hydration and muscle mass. It can sometimes help distinguish between different reasons why kidney markers may be shifting.',
  // ── Liver ─────────────────────────────────────────────────────────────────────
  ast:                    'AST is an enzyme released when liver, heart, or muscle cells are under stress. Meridian watches it alongside ALT because the pattern across liver enzymes — particularly whether AST and ALT move together — often carries more information than any single marker.',
  alt:                    'ALT is released by the liver when it\'s under strain or irritation. Meridian watches it because changes over time can reflect how the body may be responding to inflammation, recovery, medications, alcohol, or metabolic stress patterns.',
  alkaline_phosphatase:   'Alkaline phosphatase is produced by the liver, bile ducts, and bone. Meridian watches it because elevated levels can connect to liver health, bile flow, bone turnover, or inflammatory patterns — and the context of surrounding markers helps identify the most likely origin.',
  bilirubin_total:        'Bilirubin is a byproduct of red blood cell breakdown that the liver processes and clears. Meridian watches it because changes can connect to liver processing capacity, bile flow, or red blood cell turnover — all part of a fuller hepatic picture.',
  albumin:                'Albumin is the most abundant protein in your blood, produced by the liver. Meridian watches it because it reflects nutritional status, liver synthetic function, and overall protein balance — signals that can shift with illness, inflammation, or long-term dietary patterns.',
  globulin:               'Globulins include immune-related antibodies and carrier proteins. Meridian watches them because changes can provide context on immune activity, liver function, chronic inflammation, and protein balance over time.',
  total_protein:          'Total protein reflects both albumin and globulins together — a broad view of how well the body is producing and maintaining protein. Changes can connect to nutritional status, liver function, immune activity, and recovery.',
  ag_ratio:               'The albumin/globulin ratio reflects the balance between two major protein groups in your blood. Meridian watches it because shifts can sometimes provide early context on liver function, immune activity, or chronic inflammation before individual markers become obviously abnormal.',
  // ── Glycemic ──────────────────────────────────────────────────────────────────
  hba1c:                  'A1c gives Meridian a view of your average blood sugar exposure over approximately the past three months. It\'s one of the clearest long-term windows into glycemic regulation and metabolic health.',
  insulin_fasting:        'Fasting insulin reveals how hard your body is working to keep blood sugar stable between meals. Meridian watches it because elevated fasting insulin can sometimes precede changes in glucose or A1c — connecting to metabolic efficiency and long-term health patterns.',
  // ── Thyroid ───────────────────────────────────────────────────────────────────
  tsh:                    'TSH is the signal your brain sends to regulate your thyroid. Meridian watches it because changes over time can connect to metabolism, sustained energy, temperature regulation, sleep quality, and recovery.',
  free_t4:                'Free T4 is the main storage form of thyroid hormone in your blood. Meridian tracks it because it reflects the raw material your body converts into the active hormone that drives cellular metabolism — a key part of the thyroid system picture.',
  free_t3:                'Free T3 is the active thyroid hormone that directly drives cellular energy use. Meridian watches it because T3 levels can shift even when TSH appears stable, and it may better reflect how your body is actually using thyroid hormones day to day.',
  total_t3:               'Total T3 reflects the overall circulating level of your primary active thyroid hormone. Meridian watches it as part of the thyroid picture — particularly when Free T3 is not available — to understand metabolic and energy signaling patterns over time.',
  tpo_antibodies:         'TPO antibodies are immune proteins that can attack thyroid tissue. Meridian watches them because elevated levels are associated with autoimmune thyroid patterns — including Hashimoto\'s thyroiditis — that often develop gradually and are best understood through long-term trend monitoring.',
  // ── Vitamins & Nutrients ──────────────────────────────────────────────────────
  vitamin_d:              'Vitamin D plays a role in immune signaling, recovery, bone health, mood regulation, and metabolic function. Meridian watches long-term trends because consistently low levels can sometimes overlap with broader recovery, inflammation, or energy-related patterns.',
  vitamin_b12:            'Vitamin B12 supports nerve function, red blood cell production, and energy metabolism at a cellular level. Meridian tracks trends here because deficiency often develops quietly and can connect to fatigue, cognition, and neurological patterns.',
  ferritin:               'Ferritin reflects your body\'s stored iron reserves. Meridian watches it because low stores can affect energy, oxygen delivery, and immune resilience — often before anaemia becomes apparent.',
  folate:                 'Folate is essential for DNA repair, cell division, and red blood cell production. Meridian watches it because low levels can connect to elevated homocysteine, red cell changes, and long-term cellular health patterns — often developing quietly over time.',
  magnesium:              'Magnesium is involved in hundreds of enzymatic reactions — including energy production, muscle function, nerve signaling, and sleep regulation. Meridian watches it because insufficient levels can sometimes connect to fatigue, muscle recovery, and cardiovascular patterns.',
  // ── Hormones ──────────────────────────────────────────────────────────────────
  testosterone_total:     'Testosterone plays a role in energy, recovery, muscle maintenance, mood, and metabolic signaling. Meridian watches it alongside cortisol and DHEA-S because hormonal patterns rarely exist in isolation.',
  cortisol_am:            'Morning cortisol reflects the first wave of your body\'s daily stress and energy response. Meridian watches it because sustained shifts can connect to recovery, immune function, metabolic balance, and adrenal signaling.',
  dhea_s:                 'DHEA-S is an adrenal hormone associated with resilience and hormonal reserve. Meridian watches it because levels often decline gradually with age and stress — the trend over time tends to be more informative than any single reading.',
  acth:                   'ACTH is the pituitary signal that tells your adrenal glands to produce cortisol. Meridian tracks it alongside cortisol because together they help build a picture of adrenal and stress-response signaling that neither marker reveals fully on its own.',
  // ── Inflammation / Cardiac Risk ───────────────────────────────────────────────
  crp_hs:                 'High-sensitivity CRP is one of the markers Meridian watches for low-grade systemic inflammation. Persistently elevated levels can sometimes connect to cardiovascular risk, metabolic stress, and recovery patterns over time.',
  homocysteine:           'Homocysteine is an amino acid that accumulates when B-vitamin metabolism is impaired. Meridian watches it because elevated levels have been associated with cardiovascular risk and vascular inflammation — even in people with otherwise normal cholesterol.',
}

function getInterpretation(slug: string): string {
  return INTERPRETATIONS[slug] ?? 'This biomarker is part of the picture Meridian is building over time. Patterns across related markers tend to carry more weight than any single reading.'
}

// ── Micro-intelligence layer ───────────────────────────────────────────────────
interface BiomarkerIntel { why: string; context: string }
const BIOMARKER_CONTEXT: Record<string, BiomarkerIntel> = {
  // ── Thyroid ─────────────────────────────────────────────────────────────────
  tsh: {
    why: 'TSH is the signal your brain sends to regulate how much thyroid hormone your body produces. Meridian watches it because changes over time can connect to metabolism, sustained energy, temperature regulation, sleep quality, and recovery — often before symptoms become obvious.',
    context: 'In context with Free T3, Free T4, and cortisol, Meridian is watching whether a TSH shift reflects a thyroid system pattern or a transient fluctuation. When multiple thyroid signals move together, the pattern carries more interpretive weight than any individual reading.',
  },
  free_t4: {
    why: 'Free T4 is the main storage form of thyroid hormone circulating in your blood. Meridian tracks it because it reflects the raw material your body converts into the active hormone that drives cellular metabolism and energy.',
    context: 'A Free T4 shift in isolation can mean something different than a shift that moves alongside TSH or Free T3. Meridian is watching whether the thyroid cluster tells a consistent story — or whether this appears to be a fluctuation within one part of the system.',
  },
  free_t3: {
    why: 'Free T3 is the active thyroid hormone that directly drives cellular energy use. Meridian watches it because T3 levels can shift even when TSH appears stable, and it may better reflect how your body is actually using thyroid hormones day to day.',
    context: 'In context with TSH and Free T4, a Free T3 pattern can sometimes reveal more about how the body is using thyroid hormones than TSH alone would suggest. Meridian is watching whether T3 shifts persist across readings or appear as isolated fluctuations — the distinction tends to matter more than any single value.',
  },
  total_t3: {
    why: 'Total T3 reflects the overall circulating level of your body\'s primary active thyroid hormone. Meridian watches it as part of the thyroid picture — particularly when Free T3 is not available — to understand metabolic and energy signaling patterns over time.',
    context: 'As part of the thyroid cluster, Total T3 adds interpretive weight when it moves in alignment with TSH and T4 shifts. Meridian is watching whether the thyroid picture appears consistent across related markers — or whether this represents an isolated fluctuation in one part of the system.',
  },
  // ── CBC ─────────────────────────────────────────────────────────────────────
  wbc: {
    why: 'White blood cells are your immune system\'s first responders. Meridian watches the total count alongside the differential breakdown because the pattern of which cell types are elevated or suppressed can provide context about immune activation, recovery stress, or physiological adaptation.',
    context: 'Alongside the differential breakdown and inflammatory markers, a WBC shift can help Meridian distinguish temporary immune activation — such as recent illness or physical stress — from a more persistent pattern. Which cell types are shifting tends to tell a more complete story than the total count alone.',
  },
  rbc: {
    why: 'Red blood cells carry oxygen from your lungs to every tissue in your body. Meridian tracks RBC count because changes over time can connect to nutrient availability, iron status, bone marrow activity, and how efficiently your body is maintaining its oxygen supply.',
    context: 'In context with hemoglobin, hematocrit, and ferritin, a shift in RBC count may reflect changes in iron availability or nutrient status. Meridian is watching whether this represents an evolving oxygen-transport pattern or an isolated fluctuation — the cluster of signals together tends to be more informative than any single reading.',
  },
  hemoglobin: {
    why: 'Hemoglobin is the protein inside red blood cells that carries oxygen through your bloodstream. Meridian watches it because it\'s central to how your body fuels itself — shifts can connect to energy levels, endurance, recovery capacity, and iron or nutrient status.',
    context: 'In context with RBC, hematocrit, and ferritin, a hemoglobin shift may appear more consistent with iron or nutrient-related changes than a structural blood issue. Meridian is watching whether this pattern persists or resolves, and how the related signals move alongside it over time.',
  },
  hematocrit: {
    why: 'Hematocrit reflects what proportion of your blood volume is made up of red blood cells. Meridian tracks it as part of the oxygen-transport picture, since changes can connect to hydration status, iron stores, and red cell production.',
    context: 'When hematocrit shifts alongside hemoglobin and RBC, Meridian can begin to assess whether the change reflects a consistent oxygen-transport pattern or a transient fluctuation — sometimes connected to hydration changes or temporary iron depletion. Persistent movement across the cluster tends to carry more interpretive weight.',
  },
  mcv: {
    why: 'MCV measures the average size of your red blood cells. Meridian watches it because cell size can reflect nutrient availability — particularly iron, B12, and folate — and can sometimes shift before other markers show obvious changes.',
    context: 'An MCV change becomes more interpretable in context with ferritin, B12, and folate. When MCV shifts alongside low ferritin, an iron-related cell production pattern may be emerging. When it shifts alongside low B12 or folate, a different nutrient pathway may be involved. Meridian is watching the cluster for directional consistency across readings.',
  },
  mch: {
    why: 'MCH reflects how much hemoglobin is packed into the average red blood cell. Meridian tracks it because it provides context on red cell quality and oxygen-carrying efficiency alongside other CBC signals.',
    context: 'MCH changes rarely carry strong standalone signal — but in context with MCV, MCHC, and nutrient markers, they can add texture to the red cell picture. Meridian is watching whether this reflects an evolving production pattern or sits within normal biological variation.',
  },
  mchc: {
    why: 'MCHC measures the concentration of hemoglobin within your red blood cells. Meridian watches it alongside MCV and MCH because together these indices give context on whether cells are being produced efficiently and carrying oxygen optimally.',
    context: 'When MCHC moves alongside MCV and MCH, the combined pattern can sometimes help Meridian distinguish between different types of red cell changes. An isolated MCHC shift often reflects normal variation; consistent movement across the CBC cluster may suggest a more persistent pattern worth continuing to track.',
  },
  rdw: {
    why: 'RDW measures how much variation there is in the size of your red blood cells. Meridian watches it because elevated variation can sometimes connect to iron deficiency, B12 status, or emerging changes in cell production — often before other markers shift.',
    context: 'An elevated RDW can be one of the earliest signals in a developing nutrient-related cell pattern. In context with ferritin, B12, and MCV, Meridian is watching whether this reflects an early iron or B-vitamin signal — or a transient fluctuation. When multiple markers in this cluster shift together, the pattern tends to be more meaningful.',
  },
  platelets: {
    why: 'Platelets are essential for clotting and vascular repair. Meridian tracks platelet count because significant shifts in either direction can provide context on immune activity, inflammatory patterns, and overall blood health.',
    context: 'Alongside other CBC markers and inflammatory signals, platelet count shifts can sometimes reflect immune activation or recovery stress rather than a primary platelet issue. Meridian is watching whether this appears isolated or moves as part of a broader inflammatory or recovery pattern over time.',
  },
  // ── Glycemic ────────────────────────────────────────────────────────────────
  hba1c: {
    why: 'A1c reflects your average blood sugar exposure over approximately the past three months. Meridian watches it because it\'s one of the clearest long-term windows into how well your body is regulating glucose — a signal that connects to energy, metabolic health, and long-term tissue resilience.',
    context: 'In context with fasting glucose and insulin, A1c shifts can help Meridian assess whether the glycemic picture appears to be improving, drifting, or holding steady. A rising A1c alongside elevated fasting glucose may suggest a broader regulation pattern; a stable A1c in the context of shifting fasting glucose may reflect short-term variation rather than a persistent trend.',
  },
  insulin_fasting: {
    why: 'Fasting insulin reveals how hard your body is working to keep blood sugar stable between meals. Meridian watches it because elevated fasting insulin can sometimes precede changes in glucose or A1c — and may connect to metabolic efficiency, energy patterns, and long-term cardiovascular context.',
    context: 'In context with fasting glucose and A1c, elevated fasting insulin can sometimes suggest the body is working harder than expected to maintain blood sugar stability — a pattern that may precede visible changes in other glycemic markers. Meridian is watching whether this resolves or persists across readings, since the trajectory carries more signal than any single value.',
  },
  glucose_fasting: {
    why: 'Fasting glucose gives Meridian a snapshot of how your body manages blood sugar at rest — a fundamental window into metabolic health. Meridian watches trends here because small, sustained changes over time can connect to energy regulation, metabolic resilience, and long-term health patterns.',
    context: 'In isolation this shift may appear mild, but together with A1c and fasting insulin, Meridian can begin to assess whether this reflects transient variation or a broader glucose regulation pattern. When fasting glucose moves consistently across visits — even within reference range — it can sometimes suggest an evolving metabolic signal worth continuing to monitor.',
  },
  // ── Lipid Panel ─────────────────────────────────────────────────────────────
  total_cholesterol: {
    why: 'Total cholesterol reflects the sum of all cholesterol particles in your blood. On its own it tells an incomplete story — Meridian uses it as a starting point, always evaluated in the context of HDL, LDL, triglycerides, and inflammation.',
    context: 'Total cholesterol carries most of its interpretive value through its component parts. In context with HDL, LDL, triglycerides, and hs-CRP, Meridian is watching whether the cholesterol picture appears more consistent with a metabolically favorable pattern or one that warrants continued attention as trends develop.',
  },
  hdl: {
    why: 'HDL helps transport excess cholesterol away from blood vessels and back to the liver. Meridian watches it because consistently low HDL alongside elevated triglycerides and inflammation can sometimes connect to cardiovascular and metabolic risk patterns that no single number fully captures.',
    context: 'Meridian watches HDL together with triglycerides, inflammation markers, and long-term metabolic trends because the relationship between these signals can sometimes reveal more than a single cholesterol value alone. A low HDL pattern alongside elevated triglycerides may suggest a broader metabolic context — while HDL that is stable or rising within a favorable lipid cluster is generally a reassuring signal.',
  },
  ldl: {
    why: 'LDL carries cholesterol to tissues throughout the body and is one of the most tracked cardiovascular markers. Meridian watches it over time because long-term trends — rather than isolated readings — provide the most useful context, particularly alongside inflammation and metabolic signals.',
    context: 'In context with HDL ratio, triglycerides, and hs-CRP, an LDL shift can take on very different meanings. An elevated LDL alongside high triglycerides and elevated inflammation may suggest a more metabolically significant pattern than elevated LDL in an otherwise favorable lipid and inflammatory picture. Meridian is watching how this fits the broader cardiovascular cluster over time.',
  },
  vldl: {
    why: 'VLDL is responsible for carrying triglycerides through the bloodstream. Meridian tracks it because elevated VLDL can sometimes overlap with metabolic patterns like insulin resistance, elevated triglycerides, and cardiovascular risk signals.',
    context: 'VLDL tends to track closely with triglyceride levels. When both are elevated, Meridian is watching whether the combined pattern may reflect broader metabolic signaling — such as insulin sensitivity or dietary fat patterns — rather than an isolated lipid fluctuation.',
  },
  triglycerides: {
    why: 'Triglycerides reflect how much fat is circulating in your blood after fasting. Meridian watches them because elevated levels over time can connect to dietary patterns, insulin sensitivity, metabolic health, and cardiovascular risk — particularly when combined with low HDL.',
    context: 'In context with HDL and fasting insulin, a triglyceride shift can sometimes suggest a broader metabolic pattern. Elevated triglycerides alongside low HDL is a cluster Meridian watches carefully — this combination can sometimes reflect insulin sensitivity or dietary patterns that no single marker would reveal on its own.',
  },
  non_hdl: {
    why: 'Non-HDL cholesterol captures all the cholesterol-carrying particles that can contribute to arterial buildup — including LDL, VLDL, and others. Meridian watches it because it may give a more complete cardiovascular picture than LDL alone.',
    context: 'Non-HDL adds interpretive depth to the lipid picture when LDL and VLDL are considered together. In context with the full lipid cluster and hs-CRP, Meridian is watching whether non-HDL appears to reflect a consistent atherogenic pattern or whether the broader cardiovascular signals remain favorable.',
  },
  ldl_hdl_ratio: {
    why: 'The LDL/HDL ratio reflects the balance between a key atherosclerotic particle and its protective counterpart. Meridian watches this ratio because it can sometimes carry more signal than either number independently.',
    context: 'The LDL/HDL ratio often carries more cardiovascular signal than either marker alone. Meridian is watching whether this ratio is moving in a favorable or unfavorable direction alongside inflammation and metabolic markers — a ratio trend across multiple readings tends to be more meaningful than any single value.',
  },
  chol_hdl_ratio: {
    why: 'The total cholesterol/HDL ratio is a cardiovascular signal that reflects how much of your total cholesterol is in a protective form. Meridian tracks it over time alongside absolute values for a fuller picture.',
    context: 'In context with the full lipid and inflammatory picture, this ratio gives Meridian a view of the overall cardiovascular signal balance. A worsening ratio in the presence of elevated triglycerides or inflammation may suggest a broader pattern; a stable or improving ratio alongside favorable lipid trends is generally an encouraging signal.',
  },
  // ── Hormones ────────────────────────────────────────────────────────────────
  testosterone_total: {
    why: 'Testosterone plays a role in energy, muscle maintenance, recovery, libido, mood, and metabolic signaling in both men and women. Meridian watches it because sustained changes can connect to how the body is managing stress, recovery, and hormonal balance more broadly.',
    context: 'In context with cortisol and DHEA-S, a testosterone shift may sometimes reflect broader hormonal system balance rather than an isolated change. Elevated cortisol alongside suppressed testosterone is a pattern Meridian watches, as it can sometimes connect to chronic stress load or recovery capacity. A stable testosterone within a balanced hormonal cluster is generally a favorable signal.',
  },
  cortisol_am: {
    why: 'Morning cortisol represents the first wave of your body\'s daily stress and activation response. Meridian watches it because sustained elevations or significant drops can connect to recovery quality, immune function, metabolic balance, sleep patterns, and adrenal signaling over time.',
    context: 'In context with thyroid markers, glucose, and inflammatory signals, a morning cortisol pattern can help Meridian assess whether the stress-recovery picture appears balanced or shifted. A persistently elevated cortisol alongside disrupted thyroid or metabolic signals may reflect a broader physiological adaptation; an isolated fluctuation without related cluster changes is generally less significant.',
  },
  dhea_s: {
    why: 'DHEA-S is an adrenal hormone that serves as a precursor to sex hormones and is associated with resilience, recovery, and hormonal reserve. Meridian watches it because levels often decline gradually with age and stress, and the trend over time can be more informative than a single reading.',
    context: 'In context with cortisol and testosterone, a DHEA-S trend can help Meridian assess the overall balance of adrenal and hormonal signaling. A falling DHEA-S alongside persistently elevated cortisol may suggest an adrenal pattern worth monitoring over time. When the hormonal cluster appears balanced and stable, an isolated DHEA-S reading carries less weight than a persistent trend.',
  },
  // ── Inflammation / Cardiac Risk ─────────────────────────────────────────────
  crp_hs: {
    why: 'High-sensitivity CRP is one of the most sensitive markers Meridian watches for low-grade systemic inflammation. Persistently elevated levels — even within the conventional normal range — can sometimes connect to cardiovascular risk, metabolic stress, recovery patterns, and how the body is responding to ongoing physiological demands.',
    context: 'In context with lipid, metabolic, and hormonal markers, a sustained hs-CRP elevation can sometimes suggest that inflammation is part of a broader biological pattern rather than a temporary response. Meridian is watching whether this signal appears alongside other cluster shifts — or whether it appears isolated, which may be more consistent with transient physiological stress.',
  },
  homocysteine: {
    why: 'Homocysteine is an amino acid that accumulates when B-vitamin metabolism is impaired. Meridian watches it because elevated levels over time have been associated with cardiovascular risk, vascular inflammation, and methylation patterns — even in people with otherwise normal cholesterol.',
    context: 'In context with B12, folate, and inflammatory markers, an elevated homocysteine may reflect either a nutrient pathway impairment or a broader cardiovascular risk signal — sometimes both. Meridian is watching whether related nutrient markers support a methylation or B-vitamin pattern, which can help distinguish a nutritional origin from a more complex vascular picture.',
  },
  // ── Vitamins & Nutrients ────────────────────────────────────────────────────
  vitamin_d: {
    why: 'Vitamin D plays a role in immune signaling, recovery, bone health, mood regulation, and metabolic function. Meridian watches long-term trends because consistently low levels can sometimes overlap with broader patterns in recovery, inflammation, immune resilience, and energy.',
    context: 'In context with inflammatory markers and hormonal signals, a consistently low Vitamin D pattern can sometimes overlap with broader immune and recovery signaling — particularly when it persists across multiple readings. Meridian is watching whether Vitamin D appears as an isolated deficiency or as part of a wider pattern that may connect to inflammatory tone or recovery quality.',
  },
  vitamin_b12: {
    why: 'Vitamin B12 supports nerve conduction, red blood cell production, DNA synthesis, and cellular energy metabolism. Meridian watches it because deficiency often develops quietly over time and can connect to fatigue, cognitive patterns, and neurological signals before it becomes clinically obvious.',
    context: 'In context with folate, homocysteine, and CBC markers — particularly MCV and RDW — a B12 pattern can help Meridian assess whether nutrient status may be quietly affecting cell production or neurological signaling. When B12 shifts alongside elevated homocysteine or enlarged red cells, the cluster may suggest an active nutrient pattern rather than isolated variation.',
  },
  folate: {
    why: 'Folate is essential for DNA repair, cell division, and red blood cell production. Meridian watches it because low levels can connect to elevated homocysteine, red cell changes, recovery capacity, and long-term cellular health patterns.',
    context: 'In context with B12 and homocysteine, a folate shift can help Meridian assess whether a methylation or B-vitamin pattern may be emerging. When folate, B12, and homocysteine move together in a consistent direction, the combined signal tends to be more interpretively meaningful than any single nutrient marker alone.',
  },
  magnesium: {
    why: 'Magnesium is involved in over 300 enzymatic reactions in the body — including energy production, muscle contraction, nerve signaling, and sleep regulation. Meridian watches it because insufficient levels can sometimes connect to fatigue, muscle recovery, stress response, and cardiovascular patterns.',
    context: 'Serum magnesium may not fully reflect intracellular stores, which means Meridian watches it alongside electrolyte balance and metabolic markers rather than in isolation. A consistently low-normal magnesium pattern — particularly alongside fatigue signals, cardiovascular markers, or stress indicators — may be worth continuing to track over time.',
  },
  ferritin: {
    why: 'Ferritin reflects your body\'s stored iron reserves — the backup supply your body draws on before anaemia becomes apparent. Meridian watches it because low ferritin can quietly connect to fatigue, poor recovery, cognitive fog, and immune resilience, often well before other markers shift.',
    context: 'In context with hemoglobin, RBC, and MCV, a ferritin pattern can help Meridian assess whether iron availability may be quietly affecting oxygen transport or recovery capacity. A low ferritin alongside stable hemoglobin may reflect early iron depletion before anaemia develops; when ferritin, hemoglobin, and MCV all shift together, the pattern tends to suggest a more established iron-related change.',
  },
  // ── Kidney / Renal ──────────────────────────────────────────────────────────
  creatinine: {
    why: 'Creatinine is a waste product of muscle activity that your kidneys continuously filter from the blood. Meridian watches it as a proxy for kidney filtration efficiency — levels that trend upward over time can sometimes signal changes in how well the kidneys are clearing metabolic waste.',
    context: 'In context with eGFR and BUN, a creatinine shift may appear more consistent with hydration variation or muscle load than with kidney function change — particularly if eGFR remains stable. When creatinine and eGFR move together in the same direction across readings, Meridian places more interpretive weight on the pattern as potentially reflecting kidney filtration trends.',
  },
  bun: {
    why: 'BUN (blood urea nitrogen) reflects how well your kidneys are filtering protein waste from your blood. Meridian watches it alongside creatinine because the ratio between them can also provide context on hydration status and protein metabolism.',
    context: 'In context with creatinine and eGFR, a BUN shift can help Meridian distinguish between a kidney filtration change and a variation in hydration or protein metabolism. An isolated BUN fluctuation alongside stable creatinine and eGFR may be more consistent with hydration or dietary protein variation than a kidney pattern.',
  },
  bun_creatinine_ratio: {
    why: 'The BUN/creatinine ratio gives Meridian additional context on kidney function relative to muscle mass and hydration state. It can sometimes help distinguish between different reasons for kidney marker changes.',
    context: 'A shifting BUN/creatinine ratio, read in context with the full renal cluster, can help Meridian interpret the likely origin of a kidney marker change. A high ratio with stable eGFR can sometimes suggest dehydration or high protein turnover; a broadly elevated renal cluster may suggest a different pattern. Meridian is watching whether these signals remain consistent or converge across readings.',
  },
  egfr: {
    why: 'eGFR estimates how well your kidneys are filtering waste from your blood — one of the most direct measures of kidney function available from standard bloodwork. Meridian watches it over time because kidney capacity tends to change gradually, and early trends can carry long-term significance.',
    context: 'Meridian watches eGFR over time because a single reading reflects a snapshot — while a consistent directional drift across visits carries more interpretive weight. In context with creatinine and BUN, Meridian is watching whether the renal picture appears stable, improving, or showing a sustained pattern of change that warrants continued attention.',
  },
  egfr_african_american: {
    why: 'This eGFR calculation accounts for biological variation in creatinine production and provides an adjusted estimate of kidney filtration capacity. Meridian watches it as part of long-term kidney context.',
    context: 'In context with creatinine and BUN, Meridian uses this adjusted eGFR to assess kidney filtration patterns over time. A single reading reflects a snapshot — consistent directional trends across visits are what Meridian watches most closely.',
  },
  egfr_non_african_american: {
    why: 'eGFR estimates how well your kidneys are filtering waste from your blood — one of the most direct measures of kidney function from standard bloodwork. Meridian watches it over time because kidney capacity tends to change gradually.',
    context: 'In context with creatinine and BUN, Meridian uses this eGFR estimate to assess kidney filtration patterns over time. A single reading reflects a snapshot — consistent directional trends across visits are what Meridian watches most closely.',
  },
  // ── Liver ───────────────────────────────────────────────────────────────────
  ast: {
    why: 'AST is an enzyme found in the liver, heart, and muscles that gets released when cells are under stress or damaged. Meridian watches it because changes over time can provide context on liver health, muscle stress, recovery patterns, and broader tissue inflammation.',
    context: 'In context with ALT and alkaline phosphatase, an AST shift can help Meridian assess whether a change may reflect a hepatic pattern or a non-liver origin. An AST shift without corresponding ALT elevation can sometimes connect to muscle stress or recovery; when AST and ALT move together, a hepatic origin is more likely. The pattern across the enzyme cluster tends to carry more signal than any single marker.',
  },
  alt: {
    why: 'ALT is one of the markers your liver releases when it\'s under strain or irritation. Meridian watches it because changes over time can help reveal how your body may be responding to inflammation, recovery, medications, alcohol, metabolic health, or broader liver stress patterns.',
    context: 'In context with the related liver markers Meridian is tracking, a shift in ALT may appear more consistent with metabolic inflammation, recovery stress, or transient dietary patterns than a persistent liver issue — particularly if the shift is mild and the surrounding cluster remains favorable. Meridian is watching whether this resolves or persists over subsequent readings.',
  },
  alkaline_phosphatase: {
    why: 'Alkaline phosphatase is produced by the liver, bile ducts, and bone. Meridian watches it because elevated levels can sometimes connect to liver health, bile flow, bone turnover, or inflammatory patterns — and the context of which other markers are shifting helps interpret it.',
    context: 'In context with AST, ALT, and bilirubin, an alkaline phosphatase shift can help Meridian assess whether a change may relate to liver and bile flow, bone turnover, or a broader inflammatory signal. When alkaline phosphatase rises alongside AST and ALT, a hepatic pattern may be more likely; a rise in isolation may suggest a different origin worth watching over time.',
  },
  bilirubin_total: {
    why: 'Bilirubin is a byproduct of red blood cell breakdown that the liver processes and clears. Meridian watches it because changes can connect to liver processing capacity, bile flow, or red blood cell turnover — signals that help build a fuller hepatic picture.',
    context: 'In context with AST, ALT, and CBC markers, a bilirubin shift can help Meridian assess whether the pattern may connect to liver processing, bile flow, or red blood cell turnover. When bilirubin shifts in isolation without corresponding liver enzyme changes, red blood cell turnover is sometimes the more likely origin — though Meridian continues to watch how the cluster evolves.',
  },
  albumin: {
    why: 'Albumin is the most abundant protein in your blood and is produced by the liver. Meridian watches it because it reflects nutritional status, liver synthetic function, and overall protein balance — signals that can shift with illness, inflammation, or long-term dietary patterns.',
    context: 'In context with total protein, A/G ratio, and liver markers, an albumin shift can sometimes reflect changes in liver synthetic function, nutritional status, or inflammatory state. A low albumin alongside elevated globulin may suggest an inflammatory or immune-related protein shift; when albumin shifts alongside liver enzymes, a hepatic production pattern may be more likely.',
  },
  globulin: {
    why: 'Globulins are a group of proteins that include immune-related antibodies and carrier proteins. Meridian watches them because changes can provide context on immune activity, liver function, chronic inflammation, and overall protein balance.',
    context: 'In context with albumin and the A/G ratio, a globulin shift can help Meridian assess whether a protein pattern may reflect immune activation, chronic inflammation, or liver-related changes. When globulin rises as albumin falls, Meridian is watching this as a potentially meaningful protein balance shift — rather than an isolated fluctuation in one marker.',
  },
  total_protein: {
    why: 'Total protein reflects both albumin and globulins together, giving Meridian a broad view of how well the body is producing and maintaining protein. Changes can connect to nutritional status, liver function, immune activity, and recovery.',
    context: 'In context with albumin and globulin, total protein adds a summary view of overall protein balance. When albumin and globulin move in opposite directions while total protein remains stable, Meridian is watching this as a protein balance shift rather than a synthesis problem — a pattern worth continuing to track alongside liver and immune markers.',
  },
  ag_ratio: {
    why: 'The albumin/globulin ratio reflects the balance between two major protein groups in your blood. Meridian watches it because shifts in this ratio can sometimes provide early context on liver function, immune activity, or chronic inflammation before individual markers become obviously abnormal.',
    context: 'When the A/G ratio shifts, Meridian is watching which component — albumin or globulin — is driving the change, as this can sometimes help distinguish a liver production pattern from an immune or inflammatory one. A persistently falling A/G ratio, particularly alongside other liver or immune signals, may carry more interpretive weight than an isolated reading.',
  },
  // ── CMP electrolytes ────────────────────────────────────────────────────────
  sodium: {
    why: 'Sodium is the primary electrolyte governing fluid balance in your body. Meridian watches it because shifts — even subtle ones — can connect to hydration status, kidney regulation, adrenal signaling, and how the body is managing fluid across cells.',
    context: 'In context with potassium, chloride, and CO2, a sodium shift can help Meridian assess whether fluid balance appears broadly stable or may be part of a wider electrolyte pattern. Sodium fluctuations are often transient and hydration-related; when multiple electrolytes shift together, Meridian considers whether a more integrated kidney or adrenal pattern may be emerging.',
  },
  potassium: {
    why: 'Potassium is critical for heart rhythm, muscle contraction, and cellular energy balance. Meridian watches it because significant deviations in either direction can carry cardiovascular implications, and it provides important context on kidney function and adrenal regulation.',
    context: 'In context with sodium and the broader electrolyte cluster, a potassium shift can help Meridian assess whether the change appears consistent with hydration variation, dietary patterns, or a more persistent renal or adrenal signal. When potassium moves outside of normal range consistently, or alongside other electrolyte changes, Meridian watches this cluster more closely.',
  },
  chloride: {
    why: 'Chloride works alongside sodium and bicarbonate to maintain fluid balance and acid-base stability in the body. Meridian watches it as part of the electrolyte system, where the pattern across multiple markers is usually more informative than any single value.',
    context: 'In context with sodium and CO2, a chloride shift can help Meridian assess whether the acid-base and electrolyte picture appears balanced. An isolated chloride fluctuation is often transient; when chloride moves alongside CO2 in an opposing direction, Meridian may be watching for an evolving acid-base pattern.',
  },
  co2: {
    why: 'CO2 (reported as bicarbonate) reflects how well your body is managing acid-base balance — the chemical equilibrium that underpins most cellular processes. Meridian watches it because shifts can connect to metabolic changes, kidney function, respiratory patterns, and hydration status.',
    context: 'In context with chloride and the anion gap, a CO2 shift can help Meridian assess whether the acid-base picture is stable or showing a directional pattern. A falling CO2 alongside a rising anion gap may suggest an accumulating acid load; when CO2 fluctuates without supporting cluster changes, it is more often consistent with transient variation.',
  },
  calcium: {
    why: 'Calcium supports bone integrity, muscle contraction, nerve signaling, and heart function. Meridian watches it because blood calcium is tightly regulated — significant deviations can sometimes reflect parathyroid signaling, vitamin D status, or other metabolic patterns.',
    context: 'Blood calcium is tightly regulated, so meaningful shifts — particularly persistent ones — are worth watching in context with vitamin D and metabolic markers. Meridian is watching whether a calcium change appears isolated or moves alongside related signals that might suggest a broader mineral balance or parathyroid-related pattern.',
  },
  anion_gap: {
    why: 'The anion gap is a calculated value that reflects the balance of charged particles in your blood. Meridian watches it because elevated levels can sometimes signal metabolic acid accumulation — shifts that might not be obvious from individual electrolyte readings alone.',
    context: 'In context with CO2 and chloride, an elevated anion gap can help Meridian assess whether the acid-base picture may reflect metabolic acid accumulation. When the anion gap rises alongside a falling CO2 and stable chloride, the pattern may be more interpretively significant than an isolated value — Meridian watches the electrolyte cluster together rather than any single marker.',
  },
  // ── CBC Differential ────────────────────────────────────────────────────────
  neutrophils_pct: {
    why: 'Neutrophils are your immune system\'s most abundant first responders — the cells that mobilize quickly to sites of infection or inflammation. Meridian tracks their proportion as part of the white cell differential because the balance of cell types often tells a more complete immune story than the total WBC count alone.',
    context: 'In context with the full white cell differential and inflammatory markers like hs-CRP, a neutrophil shift can help Meridian distinguish between a temporary response — such as physical stress or recent illness — and a more persistent immune activation pattern. Elevated neutrophils alongside suppressed lymphocytes is a shift Meridian watches carefully over time.',
  },
  neutrophils_abs: {
    why: 'The absolute neutrophil count reflects how many of your immune system\'s primary first-responder cells are actively circulating. Meridian tracks the absolute count alongside the percentage because together they give a fuller picture of immune activity than either measurement alone.',
    context: 'In context with other differential markers and hs-CRP, an absolute neutrophil shift can help Meridian assess whether an immune pattern appears transient — such as after illness or physical stress — or more persistent. Absolute counts tend to be most informative when read alongside the full differential cluster and the surrounding clinical picture.',
  },
  lymphocytes_pct: {
    why: 'Lymphocytes are the immune cells responsible for targeted defense — including T cells that coordinate immune responses and B cells that produce antibodies. Meridian watches their proportion because changes can connect to immune resilience, recovery patterns, and how the body is managing ongoing physiological demands.',
    context: 'In context with total WBC and other differential markers, a lymphocyte percentage shift can help Meridian assess whether the immune picture reflects a transient response or a more persistent pattern. A relatively low lymphocyte proportion alongside elevated neutrophils can sometimes suggest a stress or recovery-related immune shift rather than a primary lymphocyte issue.',
  },
  lymphocytes_abs: {
    why: 'The absolute lymphocyte count reflects the circulating level of your targeted immune defense cells. Meridian watches it because changes can connect to immune resilience, response patterns, and recovery — often alongside shifts in other white cell markers.',
    context: 'In context with other differential markers and inflammatory signals, an absolute lymphocyte shift is most meaningful as part of a pattern rather than as an isolated value. Meridian is watching whether lymphocyte changes persist across readings or appear consistent with transient immune activity.',
  },
  monocytes_pct: {
    why: 'Monocytes are immune cells that circulate in the blood before maturing into tissue macrophages. Meridian watches them because elevated counts can sometimes connect to chronic low-grade inflammation, immune activation, or recovery patterns — particularly when other inflammatory markers are also shifting.',
    context: 'In context with other white cell differential markers and hs-CRP, a monocyte shift can add texture to the immune picture. Monocyte elevations alongside other inflammatory signals may suggest a more persistent activation pattern rather than a transient response.',
  },
  monocytes_abs: {
    why: 'The absolute monocyte count reflects how many of your blood-based immune patrol cells are circulating. Meridian tracks it because shifts can sometimes connect to inflammatory activity or immune signaling patterns when read alongside the full white cell differential.',
    context: 'In context with the differential cluster and hs-CRP, an absolute monocyte shift adds context to the immune picture. Meridian is watching whether monocyte changes appear isolated or form part of a consistent broader inflammatory pattern across readings.',
  },
  eosinophils_pct: {
    why: 'Eosinophils are immune cells involved in allergic responses, parasitic defense, and certain types of tissue inflammation. Meridian tracks them because persistently elevated counts can sometimes connect to allergic or inflammatory patterns that may not be obvious from other markers alone.',
    context: 'In context with other CBC differential markers, an eosinophil shift can help Meridian assess whether the pattern may connect to allergic activity, environmental exposures, or a broader immune response. An isolated mild elevation is often transient; persistent elevation across readings tends to carry more interpretive weight.',
  },
  eosinophils_abs: {
    why: 'The absolute eosinophil count reflects how many of your allergy-related immune cells are actively circulating. Meridian watches it because elevated absolute counts — particularly when persistent — can connect to allergic inflammation, environmental triggers, or other immune-mediated patterns.',
    context: 'In context with the full differential and inflammatory markers, absolute eosinophil shifts are most meaningful when they persist across readings or coincide with other immune pattern changes. An isolated elevation is often transient and less significant than a consistent trend.',
  },
  basophils_pct: {
    why: 'Basophils are the least abundant white blood cells and are involved in allergic and inflammatory signaling. Meridian tracks them as part of the complete immune picture — while isolated changes are rarely significant on their own, patterns within the broader white cell differential can add context.',
    context: 'In context with the full differential and eosinophils, a basophil shift is most meaningful as part of a broader immune pattern rather than as a standalone signal. Meridian watches the differential cluster as a whole rather than reacting to any single cell type in isolation.',
  },
  basophils_abs: {
    why: 'The absolute basophil count is typically very low and is most relevant as part of the complete white cell differential. Meridian tracks it as one small component of the immune pattern — shifts are rarely significant in isolation but may add context when read alongside the full differential.',
    context: 'Absolute basophil counts carry most of their interpretive value in context with the full white cell differential and inflammatory signals. Meridian watches this as one piece of the broader immune picture rather than interpreting it independently.',
  },
  // ── Additional CBC ────────────────────────────────────────────────────────────
  mpv: {
    why: 'Mean platelet volume (MPV) reflects the average size of platelets in your blood. Meridian watches it as part of the platelet picture because changes in size can sometimes connect to platelet production patterns, inflammatory activity, or cardiovascular context.',
    context: 'In context with platelet count and other CBC markers, MPV adds texture to the platelet picture. A lower platelet count alongside a higher MPV can sometimes suggest active platelet production; when MPV shifts without platelet count changes, Meridian is watching whether this appears as isolated variation or part of a broader pattern.',
  },
  rdw_sd: {
    why: 'RDW-SD measures the standard deviation of red blood cell sizes — a complementary angle to RDW-CV for understanding size variation across your red cell population. Meridian tracks it because elevated variation can sometimes connect to nutrient-related or production-related changes in red cell quality.',
    context: 'In context with RDW-CV, ferritin, B12, and MCV, an RDW-SD shift adds texture to the red cell size picture. Meridian evaluates both RDW measurements alongside nutrient markers to understand whether cell production patterns may be quietly shifting.',
  },
  // ── Additional Thyroid ─────────────────────────────────────────────────────
  tpo_antibodies: {
    why: 'TPO antibodies are immune proteins that can attack thyroid peroxidase — an enzyme critical for thyroid hormone production. Meridian watches them because persistently elevated levels are associated with autoimmune thyroid patterns, including Hashimoto\'s thyroiditis, which often develops gradually over time.',
    context: 'In context with TSH, Free T4, and Free T3, a TPO antibody result can help Meridian understand whether thyroid function changes may have an autoimmune component. An elevated antibody result without current thyroid hormone disruption may warrant continued monitoring of the full thyroid cluster over time.',
  },
  // ── Additional Hormones ────────────────────────────────────────────────────
  acth: {
    why: 'ACTH is a pituitary hormone that signals the adrenal glands to produce cortisol. Meridian watches it because ACTH and cortisol together give context on adrenal and stress-response signaling that neither marker reveals fully on its own.',
    context: 'In context with cortisol AM and DHEA-S, an ACTH pattern can help Meridian assess whether the adrenal signaling picture appears balanced or shifted. When ACTH and cortisol move in opposing directions across readings, Meridian is watching whether this reflects a pituitary or adrenal-origin pattern — a distinction that context from the full hormonal cluster helps clarify.',
  },
  // ── Urinalysis — Physical ────────────────────────────────────────────────
  urine_color: {
    why: 'Urine color is one of the simplest physical properties Meridian tracks as part of a complete urinalysis. While color varies widely with hydration, diet, and medications, unusual or persistent changes can sometimes provide early context alongside the chemical and microscopy findings.',
    context: 'Urine color carries most of its interpretive value alongside hydration and chemical markers. Changes attributable to diet or hydration rarely require further attention; unusual or persistent color findings, particularly in the presence of other abnormal urinalysis signals, may be worth continued monitoring over time.',
  },
  urine_clarity: {
    why: 'Urine clarity reflects whether the sample is clear or turbid. Meridian tracks it as part of the complete urinalysis picture because cloudiness can sometimes coincide with elevated cell counts or bacteria — though an isolated turbidity finding is rarely significant on its own.',
    context: 'In context with microscopy and chemical markers, a turbid urine finding can sometimes align with elevated cell counts or infection-related signals. When clarity is the only finding in an otherwise unremarkable urinalysis, it is typically less interpretively significant than when it appears alongside other abnormal markers.',
  },
  urine_specific_gravity: {
    why: 'Specific gravity reflects how concentrated your urine is — how much dissolved material the kidneys are retaining or releasing relative to water. Meridian tracks it because patterns over time can provide context on hydration status and kidney concentrating ability.',
    context: 'Specific gravity varies considerably with fluid intake and hydration, which limits the interpretive value of any single reading. In context with sodium and kidney markers, a consistently high or low specific gravity pattern across readings may sometimes reflect hydration habits or kidney concentrating function — though isolated values are rarely independently significant.',
  },
  urine_ph: {
    why: 'Urine pH reflects the acidity or alkalinity of your urine. Meridian watches it as a physical property of the urinalysis because it can sometimes provide background context on metabolic patterns, diet, and urinary tract chemistry — though it varies widely with normal, everyday factors.',
    context: 'Urine pH fluctuates naturally with diet, hydration, and time of day, which limits the weight Meridian places on any single reading. In context with other chemical urinalysis markers, a persistently alkaline pattern can sometimes connect to bacterial activity; a consistently acidic pattern may reflect dietary or metabolic factors. Meridian watches these tendencies over multiple readings rather than reacting to isolated values.',
  },
  // ── Urinalysis — Chemical (Dipstick) ────────────────────────────────────
  urine_protein_ua: {
    why: 'Protein is not normally present in significant amounts in urine — the kidneys are designed to keep it in the bloodstream. Meridian watches this marker because a pattern of urine protein can sometimes connect to kidney filtration health, and it is worth tracking alongside bloodwork markers over time.',
    context: 'In context with creatinine, eGFR, and BUN, a urine protein result can help Meridian assess whether the kidney picture appears stable or whether this may be part of a broader renal pattern. An isolated mild finding — particularly after exercise, with concurrent illness, or in a single sample — is often transient; a pattern across multiple readings, especially alongside other renal signals, carries more interpretive weight.',
  },
  urine_blood_ua: {
    why: 'The presence of blood in urine is something Meridian watches carefully. While it can sometimes reflect entirely benign causes — such as vigorous exercise, minor irritation, or sample timing — it can also provide important context when it appears alongside other urinary findings or persists across readings.',
    context: 'In context with urine WBC, bacteria, and protein findings, a blood marker can help Meridian assess whether the pattern may connect to a possible infection, a benign cause, or a urinary finding worth following. A single isolated finding is often transient; a pattern that persists or appears alongside other abnormal urinalysis markers carries more interpretive weight.',
  },
  urine_glucose_ua: {
    why: 'Glucose is not normally found in urine. Meridian watches urine glucose because its presence can sometimes indicate that blood sugar has reached levels where the kidneys begin to pass it through — a finding that may complement the bloodwork picture even when fasting glucose appears within range.',
    context: 'In context with fasting glucose, A1c, and fasting insulin, a urine glucose result can help Meridian assess whether blood sugar regulation may be shifting in ways not yet fully visible in bloodwork. A single finding is worth noting; a persistent pattern alongside moving glycemic markers tends to carry more interpretive significance.',
  },
  urine_ketones_ua: {
    why: 'Ketones in urine indicate the body is using fat for fuel instead of glucose. Meridian watches this marker because ketone presence can connect to several different physiological states — including dietary choices, prolonged fasting, intense exercise, or, at elevated levels, certain metabolic patterns worth monitoring.',
    context: 'In context with fasting glucose and A1c, a urine ketone result can help Meridian assess whether the finding reflects a dietary or fasting pattern versus something worth closer attention. A mild isolated finding is often benign and diet-related; high levels, particularly alongside elevated glucose markers, are a pattern Meridian watches more carefully alongside the full glycemic picture.',
  },
  urine_nitrite_ua: {
    why: 'Nitrite in urine can form when certain bacteria metabolize compounds in the urinary tract. Meridian watches it because a positive result can sometimes be one of the signals that connects to a urinary tract infection pattern — though it is most meaningful when viewed alongside supporting markers.',
    context: 'In context with leukocyte esterase, urine WBC, and bacteria findings, a positive nitrite result adds weight to the picture of possible urinary tract immune activity. The combination of nitrite and leukocyte esterase together tends to carry more interpretive significance than either in isolation. A negative nitrite result does not rule out infection — some bacteria do not produce detectable nitrite levels.',
  },
  urine_leukocyte_esterase_ua: {
    why: 'Leukocyte esterase is an enzyme released by white blood cells. Meridian watches it because its presence in urine can indicate immune cell activity in the urinary tract — which may connect to inflammation or infection-related patterns when viewed alongside supporting markers.',
    context: 'In context with nitrite, urine WBC, and bacteria findings, leukocyte esterase adds to the picture of whether urinary tract white cell activity may be present. A positive result is most meaningful when it persists or appears alongside other infection-related signals; an isolated mild finding can sometimes reflect sample timing, hydration, or transient factors rather than an active infection pattern.',
  },
  urine_bilirubin_ua: {
    why: 'Bilirubin is not normally present in urine. Meridian watches it because urine bilirubin can sometimes reflect liver processing patterns or bile flow — a finding that is worth tracking alongside bloodwork liver markers when both are available.',
    context: 'In context with serum bilirubin, AST, and ALT, urine bilirubin adds context to the hepatic picture. A positive finding alongside elevated liver enzymes may align with a hepatic pattern; an isolated urine bilirubin finding without supporting bloodwork changes is less interpretively significant, but worth continued monitoring if it persists.',
  },
  urine_urobilinogen_ua: {
    why: 'Urobilinogen is a byproduct of bilirubin breakdown that normally appears in small amounts in urine. Meridian watches it because values outside the expected range can sometimes provide context on liver function, bile flow, or red blood cell turnover patterns.',
    context: 'In context with serum bilirubin, AST, ALT, and CBC markers, urobilinogen adds one more layer to the liver and red blood cell picture. Mildly elevated urobilinogen is common and often unremarkable; a consistently elevated pattern alongside other hepatic or hemolytic signals may carry more interpretive weight.',
  },
  // ── Urinalysis — Microscopy ──────────────────────────────────────────────
  urine_wbc_hpf: {
    why: 'Urine WBC count reflects how many white blood cells are present in a microscopy field. Meridian watches it because elevated counts can indicate immune cell activity in the urinary tract — a direct signal that can sometimes connect to inflammation or infection-related patterns.',
    context: 'In context with leukocyte esterase, nitrite, and bacteria findings, urine WBC count provides quantitative precision to the infection-related picture. An elevated count alongside positive leukocyte esterase and bacteria tends to be more interpretively significant than any single finding alone; isolated mild elevations can sometimes reflect sample handling or transient factors.',
  },
  urine_rbc_hpf: {
    why: 'Urine RBC count reflects how many red blood cells appear in urine microscopy. Meridian watches it because while small numbers are often benign, consistently elevated counts — particularly when they appear alongside other urinary findings — can be worth following over time.',
    context: 'In context with urine blood, protein, and other urinalysis markers, urine RBC adds quantitative context to the blood-in-urine picture. The significance of an RBC count depends greatly on its context — isolated small elevations are common and often transient; persistent or elevated counts, particularly alongside other abnormal findings, tend to carry more interpretive weight.',
  },
  urine_bacteria_hpf: {
    why: 'Bacteria detected in urine microscopy can reflect a urinary tract infection pattern or, in some cases, sample handling and collection factors. Meridian watches it alongside infection-related chemical markers to build a more complete picture.',
    context: 'In context with nitrite, leukocyte esterase, and urine WBC, bacteria detection adds to the infection-related picture. Bacterial findings are most informative when they appear alongside multiple supporting signals; an isolated bacteria finding without other infection markers may sometimes reflect specimen collection factors or transient activity rather than an active infection pattern.',
  },
  urine_epithelial_cells_hpf: {
    why: 'Epithelial cells in urine come from the lining of the urinary tract. Small numbers are normal and expected; Meridian tracks elevated counts because they can sometimes reflect local tissue activity — or, in some cases, sample handling factors worth noting alongside other urinary findings.',
    context: 'In context with other microscopy findings, urine epithelial cell counts add texture to the overall urinary picture. Mildly elevated counts are often benign and may reflect normal cellular turnover or specimen collection; elevated counts alongside infection-related markers may be more meaningful as part of a broader urinary pattern.',
  },
  urine_casts_hpf: {
    why: 'Urinary casts are protein structures that form in the kidney tubules and can shed into urine. Meridian watches them because certain cast types can sometimes provide context on kidney health patterns — though many casts, particularly hyaline casts, are benign and often related to physical activity.',
    context: 'The type and number of urinary casts matters considerably for interpretation. Hyaline casts after exercise are common and generally benign; other cast types may warrant clinical context. Meridian watches cast findings alongside kidney markers like creatinine and eGFR rather than interpreting them in isolation.',
  },
  urine_mucus_hpf: {
    why: 'Mucus in urine is a common finding that typically reflects normal secretions from the urinary tract lining. Meridian tracks it as part of the complete urinalysis, though it is rarely clinically significant when it appears in isolation.',
    context: 'Isolated urine mucus in microscopy is most often benign and related to normal urinary tract secretions. In context with other microscopy and infection-related markers, persistent or heavy mucus findings can add background texture — though they are typically among the least interpretively significant urinalysis signals Meridian tracks.',
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
  nrbc_pct: 'CBC', nrbc_abs: 'CBC',
  rdw_sd: 'CBC',
  // Lipid
  total_cholesterol: 'Lipid Panel', hdl: 'Lipid Panel', ldl: 'Lipid Panel', vldl: 'Lipid Panel',
  triglycerides: 'Lipid Panel', non_hdl: 'Lipid Panel', ldl_hdl_ratio: 'Lipid Panel', chol_hdl_ratio: 'Lipid Panel',
  // Kidney / Renal
  creatinine: 'Kidney / Renal', bun: 'Kidney / Renal', bun_creatinine_ratio: 'Kidney / Renal',
  egfr: 'Kidney / Renal', egfr_african_american: 'Kidney / Renal', egfr_non_african_american: 'Kidney / Renal',
  // Liver
  ast: 'Liver', alt: 'Liver', alkaline_phosphatase: 'Liver', bilirubin_total: 'Liver',
  albumin: 'Liver', globulin: 'Liver', ag_ratio: 'Liver', total_protein: 'Liver',
  // Electrolytes
  sodium: 'Electrolytes', potassium: 'Electrolytes', chloride: 'Electrolytes',
  co2: 'Electrolytes', calcium: 'Electrolytes', anion_gap: 'Electrolytes',
  // Glycemic
  hba1c: 'Glycemic', insulin_fasting: 'Glycemic', glucose_fasting: 'Glycemic',
  // Hormones
  testosterone_total: 'Hormones', cortisol_am: 'Hormones', dhea_s: 'Hormones',
  acth: 'Hormones',
  // Inflammation / Cardiac Risk
  crp_hs: 'Inflammation / Cardiac Risk', homocysteine: 'Inflammation / Cardiac Risk',
  // Vitamins & Nutrients
  vitamin_d: 'Vitamins & Nutrients', vitamin_b12: 'Vitamins & Nutrients',
  folate: 'Vitamins & Nutrients', magnesium: 'Vitamins & Nutrients', ferritin: 'Vitamins & Nutrients',
  // Urinalysis — dipstick, physical, and microscopy
  urine_color: 'Urinalysis', urine_clarity: 'Urinalysis',
  urine_specific_gravity: 'Urinalysis', urine_ph: 'Urinalysis',
  urine_glucose_ua: 'Urinalysis', urine_protein_ua: 'Urinalysis',
  urine_blood_ua: 'Urinalysis', urine_ketones_ua: 'Urinalysis',
  urine_bilirubin_ua: 'Urinalysis', urine_urobilinogen_ua: 'Urinalysis',
  urine_nitrite_ua: 'Urinalysis', urine_leukocyte_esterase_ua: 'Urinalysis',
  urine_wbc_hpf: 'Urinalysis', urine_rbc_hpf: 'Urinalysis',
  urine_bacteria_hpf: 'Urinalysis', urine_epithelial_cells_hpf: 'Urinalysis',
  urine_casts_hpf: 'Urinalysis', urine_mucus_hpf: 'Urinalysis',
}
function histInferPanel(slug: string): string { return HIST_SLUG_TO_PANEL[slug] ?? 'Other' }

const HIST_PANEL_DISPLAY_ORDER = [
  'CBC', 'Lipid Panel', 'Glycemic', 'Kidney / Renal', 'Liver', 'Electrolytes',
  'Thyroid Panel', 'Vitamins & Nutrients', 'Hormones', 'Inflammation / Cardiac Risk',
  'Urinalysis', 'Other',
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
    mcv: 'MCV', mch: 'MCH', mchc: 'MCHC', rdw: 'RDW', rdw_sd: 'RDW-SD', mpv: 'MPV',
    co2: 'CO₂ (Bicarbonate)', ast: 'AST', alt: 'ALT', tsh: 'TSH',
    ag_ratio: 'A/G Ratio', free_t4: 'Free T4', free_t3: 'Free T3', total_t3: 'Total T3',
    tpo_antibodies: 'TPO Antibodies', acth: 'ACTH',
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
    // ── Clinical Stability Phase states ───────────────────────────────────────
    case 'Normal':    return { bg: colors.optimal,   border: colors.optimalBorder,   dot: '#2DD4BF', label: 'Normal'   }
    case 'Low':       return { bg: colors.attention, border: colors.attentionBorder, dot: '#FB923C', label: 'Low'      }
    case 'High':      return { bg: colors.attention, border: colors.attentionBorder, dot: '#FB923C', label: 'High'     }
    case 'Critical':  return { bg: colors.critical,  border: colors.criticalBorder,  dot: '#F87171', label: 'Critical' }
    // ── Legacy states (backward compat for existing DB records) ───────────────
    case 'Optimal':   return { bg: colors.optimal,   border: colors.optimalBorder,   dot: '#2DD4BF', label: 'Normal'   }
    case 'Watch':     return { bg: colors.watch,      border: colors.watchBorder,     dot: '#FCD34D', label: 'Tracking' }
    case 'Attention': return { bg: colors.attention,  border: colors.attentionBorder, dot: '#FB923C', label: 'Review'   }
    default:          return { bg: colors.cardBg,     border: colors.cardBorder,      dot: colors.textMuted, label: '—' }
  }
}

// Canonical explanation source: HIST_INTERPRETATIONS points to the same dict as INTERPRETATIONS.
// Both Snapshot and Timeline detail sheets draw from the same single source of truth.
const HIST_INTERPRETATIONS = INTERPRETATIONS
function histGetInterpretation(slug: string): string {
  return HIST_INTERPRETATIONS[slug] ?? 'This biomarker is part of the picture Meridian is building over time. Patterns across related markers tend to carry more weight than any single reading.'
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
  // Sprint 3 — T004: 3-level grouping (year → month → date → rows[]).
  // Panel grouping, dedup, and canonical ordering are delegated to
  // buildClinicalSnapshot — the canonical entry point for all history paths.
  const yearMap = new Map<string, Map<string, Map<string, HistBiomarkerRow[]>>>()
  for (const row of rows) {
    const dateKey = histUtcDateKey(row.collected_at)
    const [y, m] = dateKey.split('-')
    const monthKey = `${y}-${m}`
    if (!yearMap.has(y)) yearMap.set(y, new Map())
    const monthMap = yearMap.get(y)!
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map())
    const dateMap = monthMap.get(monthKey)!
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
    dateMap.get(dateKey)!.push(row)
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
            .map(([dateKey, dateRows]) => {
              // Sprint 3 — T002/T004: canonical snapshot reconstruction per date.
              // buildClinicalSnapshot applies: panel grouping, dedup (T003),
              // canonical marker ordering (T007), and integrity scoring (T005).
              const snapshot = buildClinicalSnapshot(dateRows)
              const panels: HistPanelGroup[] = snapshot.map(({ panel, items }) => ({
                panel,
                items,
                stateCounts: {
                  // Sprint 3 fix: count both legacy (Optimal) and Sprint 1 (Normal) in-range states
                  Optimal:   items.filter(i => i.state === 'Optimal' || i.state === 'Normal').length,
                  Watch:     items.filter(i => i.state === 'Watch').length,
                  Attention: items.filter(i => i.state === 'Attention' || i.state === 'Low' || i.state === 'High').length,
                  Critical:  items.filter(i => i.state === 'Critical').length,
                },
              }))
              return {
                dateKey,
                label: histFormatDateLabel(dateKey),
                total: panels.reduce((s, p) => s + p.items.length, 0),
                panelCount: panels.length,
                panels,
              }
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
  const badgeMeta   = getStateBadgeMeta(isCritical ? 'Critical' : (biomarker.state ?? ''))
  const dotColor    = isCritical ? '#F87171' : getStateColor(biomarker.state)
  const resolvedRange = resolveDisplayRange(biomarker.marker_name, biomarker.reference_range_min, biomarker.reference_range_max, biomarker.unit, bioProfile)
  const intel       = BIOMARKER_CONTEXT[biomarker.marker_name]

  const _currentDateKey = biomarker.collected_at.split('T')[0]
  const prev = allBiomarkers
    .filter(b =>
      b.marker_name === biomarker.marker_name &&
      b.id !== biomarker.id &&
      b.collected_at.split('T')[0] < _currentDateKey
    )
    .sort((a, b) => b.collected_at.localeCompare(a.collected_at))[0] ?? null

  const delta = prev !== null ? Number((biomarker.value - prev.value).toFixed(2)) : null

  const contextualState = getClinicalContextualState(
    biomarker.marker_name,
    biomarker.value,
    biomarker.state,
    prev,
    resolvedRange?.min ?? null,
    resolvedRange?.max ?? null,
    isCritical,
  )
  const trendProps = getTrendDisplayProps(contextualState.contextual_severity, contextualState.trend)

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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.dot, letterSpacing: '0.04em' }}>
                  {s.label}
                </span>
                {badgeMeta && (
                  <span style={{ fontSize: '10px', color: colors.textMuted, lineHeight: 1.3, textAlign: 'right', maxWidth: '140px' }}>
                    {badgeMeta}
                  </span>
                )}
              </div>
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

          {/* Range card — always rendered; optimal range removed in Sprint 1 */}
          <div style={cardStyle}>
            <p style={labelStyle}>Clinical reference</p>
            {resolvedRange ? (
              renderClinicalReferenceBar(biomarker.value, resolvedRange.min, resolvedRange.max, biomarker.unit || undefined)
            ) : (
              <div style={{ width: '100%', paddingTop: '6px' }}>
                <div style={{ height: '8px', borderRadius: '6px', background: TRACK_UNKNOWN, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.28)' }} />
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '5px' }}>
                  <span style={{ fontSize: '11px', color: colors.textMuted, letterSpacing: '0.04em' }}>No reference range on file</span>
                </div>
              </div>
            )}
          </div>

          {/* Trend card — Sprint 4 T004: clinically-aware direction coloring */}
          <div style={cardStyle}>
            <p style={labelStyle}>Trend</p>
            {prev ? (
              <div>
                <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 4px' }}>
                  Previous: <span style={{ fontWeight: 700, color: colors.text }}>{prev.value}{prev.unit ? ` ${prev.unit}` : ''}</span>
                  <span style={{ color: colors.textMuted }}>{' '}on {fmtDate(prev.collected_at)}</span>
                </p>
                {delta !== null && (
                  <p style={{ fontSize: '13px', margin: trendProps.contextLine ? '0 0 3px' : '0', fontWeight: 600, color: trendProps.color }}>
                    {delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '— '}{delta} from previous
                  </p>
                )}
                {trendProps.contextLine && (
                  <p style={{ fontSize: '12px', margin: 0, color: trendProps.color, opacity: 0.82, lineHeight: 1.55 }}>
                    {trendProps.contextLine}
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
                Meridian has flagged this result for clinical review. For markers at this level, Meridian steps back from generating interpretive context and encourages you to share this result with your doctor or care team.
              </p>
              <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>
                This is educational context only — not a diagnosis. If this result is new or unexpected, or if you are experiencing symptoms, please discuss it with a healthcare professional.
              </p>
            </div>
          ) : (
            <>
              {/* Why it matters */}
              <div style={cardStyle}>
                <p style={labelStyle}>Why it matters</p>
                <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: 0 }}>
                  {intel?.why ?? 'This biomarker is one of the signals Meridian tracks over time. Changes in context alongside related markers tend to be more informative than any single reading.'}
                </p>
              </div>

              {/* Meridian context */}
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <p style={labelStyle}>Meridian context</p>
                <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.65, margin: 0 }}>
                  {intel?.context ?? 'Meridian evaluates this signal alongside related markers rather than in isolation. Trends over time carry more weight than any individual result.'}
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
  const badgeMeta   = getStateBadgeMeta(isCritical ? 'Critical' : (biomarker.state ?? ''))
  const dotColor    = isCritical ? '#F87171' : getStateColor(biomarker.state)
  const resolvedRange = resolveDisplayRange(biomarker.marker_name, biomarker.reference_range_min, biomarker.reference_range_max, biomarker.unit, bioProfile)
  const interp      = histGetInterpretation(biomarker.marker_name)
  const intel       = BIOMARKER_CONTEXT[biomarker.marker_name] as BiomarkerIntel | undefined

  const _histCurrentDateKey = biomarker.collected_at.split('T')[0]
  const prev = allBiomarkers
    .filter(b =>
      b.marker_name === biomarker.marker_name &&
      b.id !== biomarker.id &&
      b.collected_at.split('T')[0] < _histCurrentDateKey
    )
    .sort((a, b) => b.collected_at.localeCompare(a.collected_at))[0] ?? null
  const delta = prev !== null ? Number((biomarker.value - prev.value).toFixed(2)) : null

  const histContextualState = getClinicalContextualState(
    biomarker.marker_name,
    biomarker.value,
    biomarker.state,
    prev,
    resolvedRange?.min ?? null,
    resolvedRange?.max ?? null,
    isCritical,
  )
  const histTrendProps = getTrendDisplayProps(histContextualState.contextual_severity, histContextualState.trend)

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
            {biomarker.state && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.dot, letterSpacing: '0.04em' }}>{s.label}</span>
                {badgeMeta && <span style={{ fontSize: '10px', color: colors.textMuted, lineHeight: 1.3, textAlign: 'right', maxWidth: '140px' }}>{badgeMeta}</span>}
              </div>
            )}
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
          {/* Range card — optimal range removed in Sprint 1 */}
          <div style={cardStyle}>
            <p style={labelStyle}>Clinical reference</p>
            {resolvedRange ? (
              <>
                <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 8px' }}><span style={{ fontWeight: 600, color: colors.text }}>{resolvedRange.min} – {resolvedRange.max}</span>{biomarker.unit ? ` ${biomarker.unit}` : ''}</p>
                <BiomarkerRangeBar value={biomarker.value} refMin={resolvedRange.min} refMax={resolvedRange.max} />
              </>
            ) : (
              <div style={{ width: '100%', paddingTop: '6px' }}>
                <div style={{ height: '8px', borderRadius: '6px', background: TRACK_UNKNOWN, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.28)' }} />
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '5px' }}>
                  <span style={{ fontSize: '11px', color: colors.textMuted, letterSpacing: '0.04em' }}>No reference range on file</span>
                </div>
              </div>
            )}
          </div>
          <div style={cardStyle}>
            <p style={labelStyle}>Trend</p>
            {prev ? (
              <div>
                <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 4px' }}>Previous: <span style={{ fontWeight: 700, color: colors.text }}>{prev.value}{prev.unit ? ` ${prev.unit}` : ''}</span><span style={{ color: colors.textMuted }}>{' '}on {fmtDate(prev.collected_at)}</span></p>
                {delta !== null && <p style={{ fontSize: '13px', margin: histTrendProps.contextLine ? '0 0 3px' : '0', fontWeight: 600, color: histTrendProps.color }}>{delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '— '}{delta} from previous</p>}
                {histTrendProps.contextLine && (
                  <p style={{ fontSize: '12px', margin: 0, color: histTrendProps.color, opacity: 0.82, lineHeight: 1.55 }}>{histTrendProps.contextLine}</p>
                )}
              </div>
            ) : <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>No previous result yet.</p>}
          </div>
          {isCritical ? (
            <div style={{ backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: '14px', padding: '14px 16px', marginBottom: 0 }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F87171', marginBottom: '8px', marginTop: 0 }}>Safety Note</p>
              <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: '0 0 8px' }}>Meridian has flagged this result for clinical review. For markers at this level, Meridian steps back from generating interpretive context and encourages you to share this result with your doctor or care team.</p>
              <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>This is educational context only — not a diagnosis. If this result is new or unexpected, or if you are experiencing symptoms, please discuss it with a healthcare professional.</p>
            </div>
          ) : (
            <>
              <div style={cardStyle}>
                <p style={labelStyle}>Why it matters</p>
                <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: 0 }}>{intel?.why ?? interp}</p>
              </div>
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <p style={labelStyle}>Meridian context</p>
                <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.65, margin: 0 }}>{intel?.context ?? 'Meridian evaluates this signal alongside related markers rather than in isolation. Trends over time carry more weight than any individual result.'}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Page component ─────────────────────────────────────────────────────────────
// ── Connected Insights — cross-system pattern detection ────────────────────────
interface ConnectedInsight {
  id: string
  title: string
  tagline: string
  synthesis: string
  markers: string[]
  slugSet: Set<string>
  severity: 'attention' | 'watch'
  dotColor: string
  borderColor: string
}

function computeConnectedInsights(biomarkers: RecentBiomarker[]): ConnectedInsight[] {
  const bySlug = new Map(biomarkers.map(b => [b.marker_name, b]))
  const isAbnormal = (slug: string) => {
    const b = bySlug.get(slug)
    return !!b && isOutOfRangeState(b.state)
  }
  const isPresent = (slug: string) => bySlug.has(slug)

  const insights: ConnectedInsight[] = []

  // Metabolic cluster: triglycerides + HDL + glycemic markers
  {
    const slugs = ['triglycerides', 'hdl', 'glucose_fasting', 'hba1c', 'insulin_fasting']
    const present = slugs.filter(isPresent)
    const abnormal = slugs.filter(isAbnormal)
    if (present.length >= 2 && abnormal.length >= 1 && (isPresent('triglycerides') || isPresent('hdl'))) {
      const sev = abnormal.length >= 2 ? 'attention' : 'watch'
      insights.push({
        id: 'metabolic_cluster',
        title: 'Metabolic Cluster',
        tagline: 'Lipid · glycemic signals',
        synthesis: 'Triglycerides, HDL, and glycemic markers are part of the same metabolic picture. When they shift together, the combined signal tends to carry more interpretive weight than any marker alone — Meridian watches this cluster for directional consistency across readings.',
        markers: present.map(markerDisplayName),
        slugSet: new Set(present),
        severity: sev,
        dotColor: sev === 'attention' ? '#FB923C' : '#FCD34D',
        borderColor: sev === 'attention' ? 'rgba(251,146,60,0.22)' : 'rgba(250,204,21,0.18)',
      })
    }
  }

  // Oxygen transport: iron stores + red cell markers
  {
    const slugs = ['ferritin', 'hemoglobin', 'mcv', 'rbc', 'rdw']
    const present = slugs.filter(isPresent)
    const abnormal = slugs.filter(isAbnormal)
    if (present.length >= 2 && abnormal.length >= 1) {
      const sev = abnormal.length >= 2 ? 'attention' : 'watch'
      insights.push({
        id: 'oxygen_transport',
        title: 'Oxygen Transport',
        tagline: 'Iron · red cell signals',
        synthesis: 'Iron stores and red cell markers are connected through the same oxygen-delivery system. When ferritin, hemoglobin, or cell size markers shift together, the pattern may connect to energy, recovery capacity, and how efficiently the body is maintaining its oxygen supply.',
        markers: present.map(markerDisplayName),
        slugSet: new Set(present),
        severity: sev,
        dotColor: sev === 'attention' ? '#FB923C' : '#FCD34D',
        borderColor: sev === 'attention' ? 'rgba(251,146,60,0.22)' : 'rgba(250,204,21,0.18)',
      })
    }
  }

  // Thyroid axis: TSH + T4/T3
  {
    const slugs = ['tsh', 'free_t4', 'free_t3', 'total_t3', 'tpo_antibodies']
    const present = slugs.filter(isPresent)
    const abnormal = slugs.filter(isAbnormal)
    if (present.length >= 2 && abnormal.length >= 1) {
      const sev = abnormal.length >= 2 ? 'attention' : 'watch'
      insights.push({
        id: 'thyroid_axis',
        title: 'Thyroid Axis',
        tagline: 'TSH · thyroid hormone signals',
        synthesis: 'TSH and thyroid hormone levels form an interconnected feedback loop. When multiple markers in this cluster shift in alignment, Meridian places more weight on the pattern — isolated changes in one marker can mean something different than shifts that move across the full thyroid picture.',
        markers: present.map(markerDisplayName),
        slugSet: new Set(present),
        severity: sev,
        dotColor: sev === 'attention' ? '#FB923C' : '#FCD34D',
        borderColor: sev === 'attention' ? 'rgba(251,146,60,0.22)' : 'rgba(250,204,21,0.18)',
      })
    }
  }

  // Inflammatory signal: CRP + immune markers + homocysteine
  {
    const slugs = ['crp_hs', 'homocysteine', 'wbc', 'neutrophils_pct', 'neutrophils_abs']
    const present = slugs.filter(isPresent)
    const abnormal = slugs.filter(isAbnormal)
    if (present.length >= 2 && abnormal.length >= 1) {
      const sev = abnormal.length >= 2 ? 'attention' : 'watch'
      insights.push({
        id: 'inflammatory_signal',
        title: 'Inflammatory Signal',
        tagline: 'CRP · immune markers',
        synthesis: 'Inflammatory and immune markers are shifting alongside each other — a combination Meridian watches as part of the broader stress, recovery, and cardiovascular risk picture rather than as isolated values.',
        markers: present.map(markerDisplayName),
        slugSet: new Set(present),
        severity: sev,
        dotColor: sev === 'attention' ? '#FB923C' : '#FCD34D',
        borderColor: sev === 'attention' ? 'rgba(251,146,60,0.22)' : 'rgba(250,204,21,0.18)',
      })
    }
  }

  // Stress-hormone axis: cortisol + testosterone + DHEA-S
  {
    const slugs = ['cortisol_am', 'testosterone_total', 'dhea_s', 'acth']
    const present = slugs.filter(isPresent)
    const abnormal = slugs.filter(isAbnormal)
    if (present.length >= 2 && abnormal.length >= 1) {
      const sev = abnormal.length >= 2 ? 'attention' : 'watch'
      insights.push({
        id: 'stress_hormone',
        title: 'Hormonal Balance',
        tagline: 'Cortisol · sex hormone signals',
        synthesis: 'Cortisol, DHEA-S, and testosterone are connected through the adrenal and hormonal reserve system. When they shift together, the combined pattern can sometimes reflect stress load, recovery capacity, or hormonal balance — signals that any single hormone reading would not clearly reveal on its own.',
        markers: present.map(markerDisplayName),
        slugSet: new Set(present),
        severity: sev,
        dotColor: sev === 'attention' ? '#FB923C' : '#FCD34D',
        borderColor: sev === 'attention' ? 'rgba(251,146,60,0.22)' : 'rgba(250,204,21,0.18)',
      })
    }
  }

  // B-vitamin methylation pathway: B12 + folate + homocysteine
  {
    const slugs = ['vitamin_b12', 'folate', 'homocysteine']
    const present = slugs.filter(isPresent)
    const abnormal = slugs.filter(isAbnormal)
    if (present.length >= 2 && abnormal.length >= 1) {
      const sev = abnormal.length >= 2 ? 'attention' : 'watch'
      insights.push({
        id: 'methylation',
        title: 'Methylation Pathway',
        tagline: 'B-vitamin · homocysteine signals',
        synthesis: 'B12, folate, and homocysteine operate through the same metabolic pathway. When they shift in a consistent direction, the pattern may reflect a nutrient availability signal — one that individual marker readings can easily miss when viewed in isolation.',
        markers: present.map(markerDisplayName),
        slugSet: new Set(present),
        severity: sev,
        dotColor: sev === 'attention' ? '#FB923C' : '#FCD34D',
        borderColor: sev === 'attention' ? 'rgba(251,146,60,0.22)' : 'rgba(250,204,21,0.18)',
      })
    }
  }

  // Kidney cluster: creatinine + eGFR + BUN
  {
    const slugs = ['creatinine', 'egfr', 'egfr_non_african_american', 'egfr_african_american', 'bun', 'bun_creatinine_ratio']
    const present = slugs.filter(isPresent)
    const abnormal = slugs.filter(isAbnormal)
    if (present.length >= 2 && abnormal.length >= 1) {
      const sev = abnormal.length >= 2 ? 'attention' : 'watch'
      insights.push({
        id: 'renal_cluster',
        title: 'Renal Function',
        tagline: 'Kidney filtration signals',
        synthesis: 'Creatinine, eGFR, and BUN are all windows into the same kidney filtration system. When they shift in alignment, the pattern carries more interpretive weight than any individual reading — Meridian watches directional trends across this cluster over time.',
        markers: present.map(markerDisplayName),
        slugSet: new Set(present),
        severity: sev,
        dotColor: sev === 'attention' ? '#FB923C' : '#FCD34D',
        borderColor: sev === 'attention' ? 'rgba(251,146,60,0.22)' : 'rgba(250,204,21,0.18)',
      })
    }
  }

  // Sort attention-first; display limit controlled in render via moreInsightsExpanded
  return insights
    .sort((a, b) => (a.severity === 'attention' ? -1 : 1) - (b.severity === 'attention' ? -1 : 1))
}

// ── Key Biomarkers — curated priority selection ─────────────────────────────────
function computeKeyBiomarkers(
  biomarkers: RecentBiomarker[],
  insights: ConnectedInsight[],
): RecentBiomarker[] {
  const insightSlugs = new Set(insights.flatMap(ins => [...ins.slugSet]))
  const SEVERITY_SCORE: Record<string, number> = {
    Critical: 100, Low: 60, High: 60, Attention: 60, Watch: 20,
  }
  const scored = biomarkers.map(b => {
    let score = SEVERITY_SCORE[b.state ?? ''] ?? 5
    if (insightSlugs.has(b.marker_name)) score += 25
    return { b, score }
  })
  const sorted = scored.sort((a, b) => b.score - a.score)
  const topCount = Math.min(6, Math.max(4, sorted.filter(x => x.score >= 50).length + 2))
  return sorted.slice(0, topCount).map(x => x.b)
}

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
  const [savedQualCount, setSavedQualCount] = useState(0)
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
  // ── Curated hierarchy expansion state ────────────────────────────────────────
  const [fullClinicalExpanded, setFullClinicalExpanded] = useState(false)
  const [moreInsightsExpanded, setMoreInsightsExpanded] = useState(false)

  // ── Auth + data fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.push('/onboarding/welcome')
        return
      }

      // Biological profile (unchanged)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('biological_profile, onboarding_completed, full_name, birth_date, user_profile')
        .eq('id', user.id)
        .single()
      if (profileError || !profile) {
        router.push('/onboarding/welcome')
        return
      }
      setUserId(user.id)
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
      // Save all markers that were fully classified.
      // 'parsed' → quantitative markers with a valid numeric value.
      // 'qualitative_only' → serology / urinalysis dipstick markers; saved with value_qualitative.
      // 'unreadable' / 'partial' markers must never be saved — their values are unreliable.
      const safeBiomarkers = staged.filter(b =>
        b.extraction_status === 'parsed' || b.extraction_status === 'qualitative_only'
      )
      const response = await fetch('/api/ocr/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, biomarkers: safeBiomarkers, collected_at: collectedAt }),
      })
      const data = await response.json()
      if (!data.success) { setError(data.error || 'Failed to save biomarkers'); setConfirming(false); return }
      setSavedCount(data.quantitative_count ?? data.saved_count)
      setSavedQualCount(data.qualitative_count ?? 0)
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
    setSavedQualCount(0)
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
  // Deduplicate — rows ordered collected_at DESC so first occurrence = most recent.
  // Qualitative markers (value === null) are excluded from the numeric snapshot display;
  // they are persisted in the DB but shown in a separate serology UI in a future phase.
  const snapshotBiomarkers = deduplicateByMarker(recentBiomarkers.filter(b => b.value !== null))
  const hasRecentLabs = snapshotBiomarkers.length > 0
  const currentYear = new Date().getFullYear()
  const panelSummaries = hasRecentLabs ? buildPanelSummaries(snapshotBiomarkers) : []
  const latestDate = hasRecentLabs ? snapshotBiomarkers[0].collected_at : null
  // Sprint 1: Clinical Stability Phase — raw DB states used directly.
  // No Watch-guardrail transform needed; new engine only produces Normal/Low/High/Critical.
  const snapshotBiomarkersDisplay = snapshotBiomarkers
  const totalStateCounts = {
    // New engine: Normal → Optimal bucket; Low/High → Attention bucket.
    // Legacy engine: Optimal/Watch/Attention/Critical map to same buckets.
    Optimal:   snapshotBiomarkersDisplay.filter(b => isInRangeState(b.state)).length,
    Watch:     snapshotBiomarkersDisplay.filter(b => b.state === 'Watch').length,
    Attention: snapshotBiomarkersDisplay.filter(b => b.state === 'Low' || b.state === 'High' || b.state === 'Attention').length,
    Critical:  snapshotBiomarkersDisplay.filter(b => b.state === 'Critical').length,
  }
  const SEVERITY: Record<string, number> = { Critical: 0, Low: 1, High: 1, Attention: 2, Watch: 3 }
  const attentionMarkers = snapshotBiomarkersDisplay
    .filter(b => isOutOfRangeState(b.state) || b.state === 'Watch')
    .sort((a, b) => (SEVERITY[a.state ?? ''] ?? 9) - (SEVERITY[b.state ?? ''] ?? 9))
  const filteredBiomarkers = activeFilter
    ? snapshotBiomarkersDisplay.filter(b => {
        if (activeFilter === 'Optimal')   return isInRangeState(b.state)
        if (activeFilter === 'Attention') return b.state === 'Low' || b.state === 'High' || b.state === 'Attention'
        return b.state === activeFilter
      })
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
            // New engine states + legacy backward compat, folded into 4 display buckets
            Critical:  sorted.filter(b => b.state === 'Critical').length,
            Attention: sorted.filter(b => b.state === 'Low' || b.state === 'High' || b.state === 'Attention').length,
            Watch:     sorted.filter(b => b.state === 'Watch').length,
            Optimal:   sorted.filter(b => isInRangeState(b.state)).length,
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

  // Cross-system insights derived from snapshot biomarkers
  const connectedInsights = useMemo(
    () => computeConnectedInsights(snapshotBiomarkersDisplay),
    [snapshotBiomarkersDisplay]
  )

  // Curated priority biomarkers — top 4–6 by severity + insight cluster membership
  const keyBiomarkers = useMemo(
    () => computeKeyBiomarkers(snapshotBiomarkersDisplay, connectedInsights),
    [snapshotBiomarkersDisplay, connectedInsights]
  )

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
            <p style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '2px' }}>
              Your clinical markers.
            </p>
            <p style={{ fontSize: '14px', color: colors.textSoft, marginBottom: hasRecentLabs ? '24px' : '20px' }}>
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
                              const status = b.extraction_status ?? 'parsed'

                              // Rendering mode — determines which right-column variant to show
                              const isQualitative  = status === 'qualitative_only'
                              const isUnreadable   = status === 'unreadable'
                              const isPartial      = status === 'partial'  // impossible value
                              const isOk           = status === 'parsed'

                              const qualBadgeLabel = isQualitative && b.qualitative_value
                                ? (QUALITATIVE_DISPLAY_LABELS[b.qualitative_value] ?? b.qualitative_value.toUpperCase())
                                : null

                              // CBC differential slug sets — used to drive category label below value
                              const isDiffRelative = (
                                b.slug === 'neutrophils_pct' || b.slug === 'lymphocytes_pct' ||
                                b.slug === 'monocytes_pct' || b.slug === 'eosinophils_pct' ||
                                b.slug === 'basophils_pct' || b.slug === 'immature_granulocytes_pct' ||
                                b.slug === 'nrbc_pct'
                              )
                              const isDiffAbsolute = (
                                b.slug === 'neutrophils_abs' || b.slug === 'lymphocytes_abs' ||
                                b.slug === 'monocytes_abs' || b.slug === 'eosinophils_abs' ||
                                b.slug === 'basophils_abs' || b.slug === 'immature_granulocytes_abs' ||
                                b.slug === 'nrbc_abs'
                              )

                              // Category label shown below the right-column value
                              const markerCategoryLabel = isQualitative
                                ? (isLikelyQualitativeUrinalysis(b.name) ? 'URINALYSIS' : 'SEROLOGY')
                                : isDiffRelative ? 'RELATIVE DIFFERENTIAL'
                                : isDiffAbsolute ? 'ABSOLUTE DIFFERENTIAL'
                                : null

                              // Sub-text beneath the marker name.
                              // Priority: error states > unit conversion > original PDF name.
                              const sourceNameDiffers =
                                b.source_marker_name && b.source_marker_name !== b.name
                              const subText: string | null = isUnreadable
                                ? 'Meridian could not confidently extract this value from the PDF.'
                                : isPartial
                                  ? b.error_reason ?? 'Value outside plausible range — not saved.'
                                  : !isQualitative && b.converted
                                    ? `Converted from ${b.original_value} ${b.original_unit}`
                                    : sourceNameDiffers
                                      ? `From: ${b.source_marker_name}`
                                      : null

                              const dotColor = isUnreadable ? '#FCD34D' : isPartial ? '#F87171' : s.dot
                              const rowBg = isPartial
                                ? 'rgba(248,113,113,0.07)'
                                : isUnreadable
                                  ? 'rgba(250,204,21,0.04)'
                                  : 'transparent'

                              return (
                                <div
                                  key={b.slug + i}
                                  style={{
                                    padding: '12px 16px',
                                    borderTop: i === 0 ? 'none' : `1px solid ${colors.cardBorder}`,
                                    display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                                    backgroundColor: rowBg,
                                  }}
                                >
                                  {/* Left column: marker name + sub-text */}
                                  <div style={{ flex: 1, minWidth: '150px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: subText ? '4px' : '0' }}>
                                      <div style={{
                                        width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                                        backgroundColor: dotColor,
                                      }} />
                                      <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>{b.name}</span>
                                    </div>
                                    {subText && (
                                      <span style={{
                                        fontSize: '11px', display: 'block', paddingLeft: '15px',
                                        color: isUnreadable ? '#FCD34D' : isPartial ? '#FCA5A5' : colors.textMuted,
                                      }}>
                                        {subText}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right column: value display */}
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    {isQualitative ? (
                                      <>
                                        <div style={{
                                          display: 'inline-block', padding: '4px 12px',
                                          borderRadius: '20px', backgroundColor: s.bg,
                                          border: `1px solid ${s.border}`,
                                          fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: s.dot,
                                        }}>
                                          {qualBadgeLabel ?? '—'}
                                        </div>
                                        {markerCategoryLabel && (
                                          <div style={{
                                            fontSize: '10px', fontWeight: 700, marginTop: '4px',
                                            letterSpacing: '0.04em', color: s.dot,
                                          }}>
                                            {markerCategoryLabel}
                                          </div>
                                        )}
                                      </>
                                    ) : isUnreadable ? (
                                      <>
                                        <span style={{ fontSize: '12px', color: '#FCD34D', fontStyle: 'italic' }}>—</span>
                                        <div style={{
                                          fontSize: '10px', fontWeight: 700, marginTop: '2px',
                                          letterSpacing: '0.04em', color: '#FCD34D',
                                        }}>
                                          NEEDS REVIEW
                                        </div>
                                      </>
                                    ) : isOk || isPartial ? (
                                      <>
                                        <span style={{ fontSize: '18px', fontWeight: 700, color: colors.text }}>{b.value}</span>
                                        <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: '4px' }}>{b.unit}</span>
                                        <div style={{
                                          fontSize: '10px', fontWeight: 700, marginTop: '2px',
                                          letterSpacing: '0.04em', color: isPartial ? '#F87171' : s.dot,
                                        }}>
                                          {isPartial ? 'FLAG' : s.label}
                                        </div>
                                        {markerCategoryLabel && (
                                          <div style={{
                                            fontSize: '10px', fontWeight: 700, marginTop: '2px',
                                            letterSpacing: '0.04em', color: s.dot, opacity: 0.75,
                                          }}>
                                            {markerCategoryLabel}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <span style={{ fontSize: '12px', color: colors.textMuted, fontStyle: 'italic' }}>—</span>
                                    )}
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

              {/* Pre-save serology notice — shown when any qualitative markers are staged */}
              {(() => {
                const qualCount = staged.filter(b => b.extraction_status === 'qualitative_only').length
                if (qualCount === 0) return null
                const quantCount = staged.filter(b => b.extraction_status === 'parsed').length
                return (
                  <div style={{
                    padding: '10px 14px', marginBottom: '4px',
                    backgroundColor: 'rgba(45,212,191,0.07)',
                    border: '1px solid rgba(45,212,191,0.22)',
                    borderRadius: '10px',
                    fontSize: '12px', color: '#5F8E85', lineHeight: 1.5,
                  }}>
                    {quantCount > 0
                      ? `${qualCount} serology ${qualCount === 1 ? 'result' : 'results'} included — these will be saved as qualitative diagnostics alongside your ${quantCount} numeric ${quantCount === 1 ? 'biomarker' : 'biomarkers'}.`
                      : `${qualCount} serology ${qualCount === 1 ? 'result' : 'results'} detected — these qualitative diagnostics will be saved to your record.`
                    }
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
                  {(() => {
                    if (confirming) return 'Saving...'
                    const qCount = staged.filter(b => b.extraction_status === 'parsed').length
                    const sCount = staged.filter(b => b.extraction_status === 'qualitative_only').length
                    const total = qCount + sCount
                    return `Confirm ${total} ${total === 1 ? 'result' : 'results'}`
                  })()}
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
                  {savedCount > 0 && savedQualCount > 0
                    ? `${savedCount} ${savedCount === 1 ? 'biomarker' : 'biomarkers'} + ${savedQualCount} serology ${savedQualCount === 1 ? 'result' : 'results'} saved`
                    : savedQualCount > 0
                      ? `${savedQualCount} serology ${savedQualCount === 1 ? 'result' : 'results'} saved`
                      : `${savedCount} ${savedCount === 1 ? 'biomarker' : 'biomarkers'} added to Snapshot`
                  }
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
                  Biomarker Snapshot · {currentYear}
                </p>

                {/* Snapshot / Timeline toggle */}
                <div style={{ marginBottom: '16px' }}>
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

                {/* ── Connected Insights — primary intelligence layer ── */}
                {!activeFilter && connectedInsights.length > 0 && (
                  <div style={{ marginBottom: '36px', marginTop: '20px' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{
                        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: colors.textMuted, margin: '0 0 8px',
                      }}>
                        Connected Insights
                      </p>
                      <h2 style={{
                        fontFamily: fonts.heading, fontSize: '22px', fontWeight: 700,
                        color: colors.text, margin: 0, lineHeight: 1.25,
                      }}>
                        What your biology is telling you
                      </h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {(moreInsightsExpanded ? connectedInsights : connectedInsights.slice(0, 3)).map(insight => (
                        <div key={insight.id} style={{
                          padding: '20px',
                          backgroundColor: colors.cardBg,
                          border: `1px solid ${insight.borderColor}`,
                          borderRadius: '16px',
                          backdropFilter: 'blur(24px)',
                          WebkitBackdropFilter: 'blur(24px)',
                        }}>
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                              <p style={{
                                fontFamily: fonts.heading, fontSize: '18px', fontWeight: 700,
                                color: colors.text, margin: 0,
                              }}>
                                {insight.title}
                              </p>
                              <span style={{ fontSize: '11px', color: insight.dotColor, fontWeight: 600, letterSpacing: '0.03em' }}>
                                {insight.severity === 'attention' ? '· pattern detected' : '· tracking'}
                              </span>
                            </div>
                            <p style={{ fontSize: '11px', color: colors.textMuted, margin: 0 }}>
                              {insight.tagline}
                            </p>
                          </div>
                          <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.7, margin: '0 0 14px' }}>
                            {insight.synthesis}
                          </p>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {insight.markers.map(m => (
                              <span key={m} style={{
                                fontSize: '11px', color: colors.textMuted,
                                padding: '2px 8px', borderRadius: '4px',
                                backgroundColor: 'rgba(103,232,249,0.05)',
                                border: '1px solid rgba(103,232,249,0.11)',
                              }}>
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!moreInsightsExpanded && connectedInsights.length > 3 && (
                      <button
                        onClick={() => setMoreInsightsExpanded(true)}
                        style={{
                          marginTop: '10px', width: '100%', padding: '10px',
                          background: 'transparent',
                          border: `1px solid rgba(103,232,249,0.13)`,
                          borderRadius: '10px', color: colors.textMuted,
                          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                          fontFamily: fonts.ui, outline: 'none',
                        }}
                      >
                        View {connectedInsights.length - 3} more {connectedInsights.length - 3 === 1 ? 'insight' : 'insights'}
                      </button>
                    )}
                  </div>
                )}

                {/* ── Key Signals — curated priority biomarkers ── */}
                {!activeFilter && keyBiomarkers.length > 0 && (
                  <div style={{ marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                      <p style={{
                        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: colors.textMuted, margin: 0,
                      }}>
                        Key Signals
                      </p>
                      <span style={{ fontSize: '11px', color: colors.textMuted, opacity: 0.6 }}>
                        Tap any to explore
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {keyBiomarkers.map(b => {
                        const s = getStateStyles(b.state ?? '')
                        const resolvedRange = !b.flag_error ? resolveDisplayRange(b.marker_name, b.reference_range_min, b.reference_range_max, b.unit, bioProfile) : null
                        const why = BIOMARKER_CONTEXT[b.marker_name]?.why
                        const sentence = why ? why.split('.')[0] + '.' : null
                        const bIsAbnormal = isOutOfRangeState(b.state) || b.state === 'Watch'
                        return (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBiomarker(b)}
                            style={{
                              padding: '16px 18px', borderRadius: '14px', cursor: 'pointer',
                              backgroundColor: colors.cardBg,
                              border: `1px solid ${bIsAbnormal ? s.dot + '25' : colors.cardBorder}`,
                              backdropFilter: 'blur(24px)',
                              WebkitBackdropFilter: 'blur(24px)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                              <p style={{ fontSize: '13px', fontWeight: 700, color: colors.text, margin: 0, flex: 1, minWidth: 0 }}>
                                {markerDisplayName(b.marker_name)}
                                {bIsAbnormal && (
                                  <span style={{ fontSize: '12px', fontWeight: 400, color: s.dot, marginLeft: '6px' }}>
                                    · {s.label}
                                  </span>
                                )}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', flexShrink: 0 }}>
                                <span style={{ fontFamily: fonts.heading, fontSize: '22px', fontWeight: 700, color: bIsAbnormal ? s.dot : colors.text }}>
                                  {b.value}
                                </span>
                                {b.unit && <span style={{ fontSize: '11px', color: colors.textMuted }}>{b.unit}</span>}
                              </div>
                            </div>
                            {resolvedRange ? (
                              renderClinicalReferenceBar(b.value, resolvedRange.min, resolvedRange.max, b.unit || undefined)
                            ) : (
                              <div style={{ width: '100%', paddingTop: '4px' }}>
                                <div style={{ height: '7px', borderRadius: '6px', background: TRACK_UNKNOWN }} />
                              </div>
                            )}
                            {sentence && (
                              <p style={{ fontSize: '11px', color: colors.textMuted, margin: '8px 0 0', lineHeight: 1.55 }}>
                                {sentence}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Status filter chips — tap to filter, tap again to clear */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '10px',
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
                      {totalStateCounts.Optimal} Normal
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
                      {totalStateCounts.Watch} Tracking
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
                      {totalStateCounts.Attention} Review
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

                {/* ── View Full Clinical Data expand / collapse ── */}
                {!activeFilter && (
                  <button
                    onClick={() => setFullClinicalExpanded(prev => !prev)}
                    style={{
                      width: '100%', marginBottom: '20px', padding: '13px 18px',
                      backgroundColor: fullClinicalExpanded ? 'rgba(45,212,191,0.05)' : colors.cardBg,
                      border: `1px solid ${fullClinicalExpanded ? 'rgba(45,212,191,0.22)' : colors.cardBorder}`,
                      borderRadius: '12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontFamily: fonts.ui, outline: 'none',
                      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: fullClinicalExpanded ? colors.teal : colors.textSoft }}>
                      {fullClinicalExpanded ? 'Hide full clinical data' : 'View full clinical data'}
                    </span>
                    <span style={{
                      fontSize: '16px', color: colors.textMuted, display: 'inline-block',
                      transform: fullClinicalExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}>›</span>
                  </button>
                )}

                {/* Filtered view OR full clinical view */}
                {activeFilter ? (

                  /* ── Status-filtered list ── */
                  <div style={{ marginBottom: '8px' }}>
                    <p style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                      {{ Optimal: 'Normal', Watch: 'Tracking', Attention: 'Review', Critical: 'Critical' }[activeFilter ?? ''] ?? activeFilter} Biomarkers
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
                                // Sprint 2: resolve range via 3-tier hierarchy (stored → canonical → null).
                                const resolvedRange = !b.flag_error ? resolveDisplayRange(b.marker_name, b.reference_range_min, b.reference_range_max, b.unit, bioProfile) : null
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
                                    <div style={{ marginBottom: '4px' }}>
                                      <span style={{ fontSize: '22px', fontWeight: 800, color: colors.text, lineHeight: '1' }}>{b.value}</span>
                                      {b.unit && <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: '5px' }}>{b.unit}</span>}
                                    </div>
                                    {resolvedRange ? (
                                      <BiomarkerRangeBar value={b.value} refMin={resolvedRange.min} refMax={resolvedRange.max} />
                                    ) : (
                                      <div style={{ width: '100%', paddingTop: '6px' }}>
                                        <div style={{ height: '8px', borderRadius: '6px', background: TRACK_UNKNOWN, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.28)' }} />
                                      </div>
                                    )}
                                    {(() => {
                                      const why = BIOMARKER_CONTEXT[b.marker_name]?.why
                                      if (!why) return null
                                      const sentence = why.split('.')[0] + '.'
                                      return (
                                        <p style={{ fontSize: '11px', color: colors.textMuted, margin: '6px 0 0', lineHeight: 1.5 }}>
                                          {sentence}
                                        </p>
                                      )
                                    })()}
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

                ) : fullClinicalExpanded ? (
                  <>
                    {/* ── View mode control ── */}
                    <div style={{ marginBottom: '20px', marginTop: '32px' }}>
                      <p style={{
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em',
                        color: colors.textMuted, textTransform: 'uppercase',
                        margin: '0 0 10px',
                      }}>
                        View Mode
                      </p>
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
                        <button
                          onClick={() => { setSnapshotViewMode('clinical_panels'); setOptimalExpanded(new Set()) }}
                          style={{
                            padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer', fontFamily: fonts.ui, outline: 'none', border: 'none',
                            backgroundColor: snapshotViewMode === 'clinical_panels' ? 'rgba(45,212,191,0.14)' : 'transparent',
                            color: snapshotViewMode === 'clinical_panels' ? colors.teal : colors.textMuted,
                            transition: 'background 0.15s ease, color 0.15s ease',
                            letterSpacing: '0.01em',
                            boxShadow: snapshotViewMode === 'clinical_panels' ? 'inset 0 1px 0 rgba(45,212,191,0.18)' : 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Clinical Panels
                        </button>
                        <button
                          onClick={() => { setSnapshotViewMode('signal_map'); setOptimalExpanded(new Set()) }}
                          style={{
                            padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer', fontFamily: fonts.ui, outline: 'none', border: 'none',
                            backgroundColor: snapshotViewMode === 'signal_map' ? 'rgba(45,212,191,0.14)' : 'transparent',
                            color: snapshotViewMode === 'signal_map' ? colors.teal : colors.textMuted,
                            transition: 'background 0.15s ease, color 0.15s ease',
                            letterSpacing: '0.01em',
                            boxShadow: snapshotViewMode === 'signal_map' ? 'inset 0 1px 0 rgba(45,212,191,0.18)' : 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Signal Map
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', lineHeight: 1.5 }}>
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
                          const abnormal    = group.markers.filter(b => isOutOfRangeState(b.state) || b.state === 'Watch')
                          const optimal     = group.markers.filter(b => isInRangeState(b.state))
                          const optKey      = `${snapshotViewMode}::${group.key}`
                          const isOptExp    = optimalExpanded.has(optKey)
                          const hiddenOpt   = Math.max(0, optimal.length - OPTIMAL_SHOW_LIMIT)
                          // Sprint 4.1 T002: auto-expand when only 1 marker would be hidden — no CTA for a single hidden item
                          const autoExpand  = hiddenOpt <= 1
                          const visibleOpt  = (isOptExp || autoExpand) ? optimal : optimal.slice(0, OPTIMAL_SHOW_LIMIT)
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
                                  <span style={{ fontSize: '11px', flexShrink: 0 }}>
                                    {sc.Critical > 0 && <span style={{ color: '#F87171', fontWeight: 600 }}>{sc.Critical} critical</span>}
                                    {sc.Critical > 0 && (sc.Attention > 0 || sc.Watch > 0) && <span style={{ color: colors.textMuted, opacity: 0.4 }}> · </span>}
                                    {sc.Attention > 0 && <span style={{ color: '#FB923C', fontWeight: 600 }}>{sc.Attention} review</span>}
                                    {sc.Attention > 0 && sc.Watch > 0 && <span style={{ color: colors.textMuted, opacity: 0.4 }}> · </span>}
                                    {sc.Watch > 0 && <span style={{ color: '#FCD34D' }}>{sc.Watch} tracking</span>}
                                    {(sc.Critical > 0 || sc.Attention > 0 || sc.Watch > 0) && sc.Optimal > 0 && <span style={{ color: colors.textMuted, opacity: 0.4 }}> · </span>}
                                    {sc.Optimal > 0 && <span style={{ color: colors.textMuted }}>{sc.Optimal} normal</span>}
                                  </span>
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
                                      // Sprint 2: resolve range via 3-tier hierarchy (stored → canonical → null).
                                      const resolvedRange = !b.flag_error ? resolveDisplayRange(b.marker_name, b.reference_range_min, b.reference_range_max, b.unit, bioProfile) : null
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
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, flex: 1, minWidth: 0 }}>
                                              {markerDisplayName(b.marker_name)}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                              <span style={{ fontSize: '15px', fontWeight: 700, color: s.dot }}>{b.value}</span>
                                              {b.unit && <span style={{ fontSize: '11px', color: colors.textMuted }}>{b.unit}</span>}
                                              <span style={{ fontSize: '13px', color: colors.textMuted, opacity: 0.4, lineHeight: 1 }}>›</span>
                                            </div>
                                          </div>
                                          {resolvedRange ? (
                                            renderClinicalReferenceBar(b.value, resolvedRange.min, resolvedRange.max, b.unit || undefined)
                                          ) : (
                                            <div style={{ width: '100%', paddingTop: '6px' }}>
                                              <div style={{ height: '8px', borderRadius: '6px', background: TRACK_UNKNOWN, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.28)' }} />
                                            </div>
                                          )}
                                          {(() => {
                                            const why = BIOMARKER_CONTEXT[b.marker_name]?.why
                                            if (!why) return null
                                            const sentence = why.split('.')[0] + '.'
                                            return (
                                              <p style={{ fontSize: '11px', color: colors.textMuted, margin: '6px 0 0', lineHeight: 1.5 }}>
                                                {sentence}
                                              </p>
                                            )
                                          })()}
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
                                      // Sprint 2: compact bar — resolve range via 3-tier hierarchy.
                                      const s = getStateStyles(b.state ?? '')
                                      const resolvedRange = !b.flag_error ? resolveDisplayRange(b.marker_name, b.reference_range_min, b.reference_range_max, b.unit, bioProfile) : null
                                      return (
                                        <div
                                          key={b.id}
                                          onClick={() => setSelectedBiomarker(b)}
                                          style={{
                                            padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                                            backgroundColor: 'rgba(45,212,191,0.03)',
                                            border: '1px solid rgba(45,212,191,0.09)',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: resolvedRange ? '2px' : '0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, minWidth: '100px' }}>
                                              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: s.dot, flexShrink: 0 }} />
                                              <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textSoft }}>{markerDisplayName(b.marker_name)}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                              <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>{b.value}</span>
                                              {b.unit && <span style={{ fontSize: '11px', color: colors.textMuted }}>{b.unit}</span>}
                                              <span style={{ fontSize: '13px', color: colors.textMuted, opacity: 0.4, lineHeight: 1 }}>›</span>
                                            </div>
                                          </div>
                                          {resolvedRange && renderClinicalReferenceBar(b.value, resolvedRange.min, resolvedRange.max, b.unit || undefined)}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* Progressive disclosure — Sprint 4.1 T003: CTA only when hiddenOpt >= 2 */}
                                {!isOptExp && hiddenOpt >= 2 && (
                                  <button
                                    onClick={() => toggleOptimalExpand(optKey)}
                                    style={{
                                      marginTop: '8px', width: '100%', padding: '8px', borderRadius: '8px',
                                      background: 'transparent', border: `1px solid rgba(45,212,191,0.12)`,
                                      color: colors.textMuted, fontSize: '12px', fontWeight: 600,
                                      cursor: 'pointer', fontFamily: fonts.ui, outline: 'none', textAlign: 'center',
                                    }}
                                  >
                                    View {hiddenOpt} more normal {hiddenOpt === 1 ? 'marker' : 'markers'}
                                  </button>
                                )}
                                {isOptExp && hiddenOpt >= 2 && (
                                  <button
                                    onClick={() => toggleOptimalExpand(optKey)}
                                    style={{
                                      marginTop: '8px', width: '100%', padding: '8px', borderRadius: '8px',
                                      background: 'transparent', border: `1px solid rgba(45,212,191,0.12)`,
                                      color: colors.textMuted, fontSize: '12px', fontWeight: 600,
                                      cursor: 'pointer', fontFamily: fonts.ui, outline: 'none', textAlign: 'center',
                                    }}
                                  >
                                    Hide normal markers
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                  </>
                ) : null}
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
                  <p style={{ fontSize: '13px', color: colors.textMuted, margin: '0 0 14px', lineHeight: 1.5 }}>
                    Your confirmed lab results over time.
                  </p>
                  {/* Snapshot / Timeline toggle */}
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
                                          // Sprint 2: unified card layout — always render a bar for every marker.
                                          // Range resolved via 3-tier hierarchy: stored → canonical → null (neutral track).
                                          // Sprint 3 T006: categorical urinalysis markers (qualitative dipstick/microscopy)
                                          // are explicitly excluded from range-bar logic regardless of stored values.
                                          const s = histGetStateStyle(b.state)
                                          const resolvedRange = (!b.flag_error && !isUrinalysisCategorical(b.marker_name))
                                            ? resolveDisplayRange(b.marker_name, b.reference_range_min, b.reference_range_max, b.unit, bioProfile)
                                            : null
                                          return (
                                            <div key={b.id} style={{ backgroundColor: b.flag_error ? 'rgba(248,113,113,0.06)' : 'rgba(232,248,245,0.055)', border: `1px solid ${b.flag_error ? '#F87171' : s.dot}30`, borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.18)' }} onClick={() => setHistSelectedBiomarker(b)}>
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, flex: 1, minWidth: 0 }}>{histMarkerDisplayName(b.marker_name)}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                  {b.flag_error && <span style={{ padding: '2px 7px', backgroundColor: colors.critical, border: `1px solid ${colors.criticalBorder}`, borderRadius: '5px', fontSize: '10px', fontWeight: 700, color: '#F87171', letterSpacing: '0.04em' }}>FLAGGED</span>}
                                                  {!b.flag_error && b.state && <span style={{ padding: '2px 8px', backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: '5px', fontSize: '10px', fontWeight: 700, color: s.dot, letterSpacing: '0.04em' }}>{s.label}</span>}
                                                  <span style={{ fontSize: '14px', color: colors.textMuted, opacity: 0.45, lineHeight: 1 }}>›</span>
                                                </div>
                                              </div>
                                              <div style={{ marginBottom: '4px' }}>
                                                <span style={{ fontSize: '22px', fontWeight: 800, color: colors.text, lineHeight: '1' }}>{b.value}</span>
                                                {b.unit && <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: '5px' }}>{b.unit}</span>}
                                              </div>
                                              {resolvedRange ? (
                                                renderClinicalReferenceBar(b.value, resolvedRange.min, resolvedRange.max, b.unit || undefined)
                                              ) : (
                                                <div style={{ width: '100%', paddingTop: '6px' }}>
                                                  <div style={{ height: '8px', borderRadius: '6px', background: TRACK_UNKNOWN, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.28)' }} />
                                                </div>
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
