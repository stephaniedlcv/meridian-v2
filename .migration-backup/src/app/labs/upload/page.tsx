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
import { useMeridianLanguage } from '@/lib/i18n'

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
  hba1c: 'Glycemic', insulin_fasting: 'Glycemic', glucose_fasting: 'Glycemic',
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
  amylase: 'Pancreatic Enzymes', lipase: 'Pancreatic Enzymes',
  hepatitis_a_igm_ab: 'Serology / Infectious Disease', hepatitis_b_core_igm: 'Serology / Infectious Disease', hepatitis_b_surface_antigen: 'Serology / Infectious Disease', hepatitis_c_ab: 'Serology / Infectious Disease', hiv_1_2_ab: 'Serology / Infectious Disease', rpr_syphilis: 'Serology / Infectious Disease',
  sodium: 'Electrolytes', potassium: 'Electrolytes', chloride: 'Electrolytes',
  co2: 'Electrolytes', calcium: 'Electrolytes', anion_gap: 'Electrolytes',
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
  'CBC', 'Lipid Panel', 'Glycemic', 'Kidney / Renal', 'Liver', 'Pancreatic Enzymes', 'Electrolytes',
  'Thyroid Panel', 'Vitamins & Nutrients',
  'Hormones', 'Inflammation / Cardiac Risk', 'Serology / Infectious Disease', 'Urinalysis', 'Other',
]

// ── Snapshot view mode ────────────────────────────────────────────────────────
type SnapshotViewMode = 'clinical_panels' | 'signal_map'

// How many Optimal markers to show before progressive disclosure
const OPTIMAL_SHOW_LIMIT = 5

// Marker state sort priority (Critical first)
// Sprint 1: Clinical Stability Phase — new states sort alongside legacy equivalents.
// Critical (0) → Bajo/Alto (1) → Attention (2) → Watch (3) → Normal/Optimal (4)
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
  amylase: 'Pancreatic Enzymes', lipase: 'Pancreatic Enzymes',
  hepatitis_a_igm_ab: 'Serology / Infectious Disease', hepatitis_b_core_igm: 'Serology / Infectious Disease', hepatitis_b_surface_antigen: 'Serology / Infectious Disease', hepatitis_c_ab: 'Serology / Infectious Disease', hiv_1_2_ab: 'Serology / Infectious Disease', rpr_syphilis: 'Serology / Infectious Disease',
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
  'CBC', 'Lipid Panel', 'Glycemic', 'Kidney / Renal', 'Liver', 'Pancreatic Enzymes', 'Electrolytes',
  'Thyroid Panel', 'Vitamins & Nutrients', 'Hormones', 'Inflammation / Cardiac Risk',
  'Serology / Infectious Disease', 'Urinalysis', 'Other',
]

const CLINICAL_PANEL_EDUCATION: Record<string, string> = {
  'CBC':                         'Tu CBC le da a Meridian una ventana hacia tu actividad inmune, capacidad de transportar oxígeno y patrones de células rojas y blancas — señales que pueden cambiar con estrés, recuperación, nutrición y otros factores.',
  'Lipid Panel':                 'Los marcadores de colesterol cuentan cómo tu cuerpo transporta grasas. Meridian observa las tendencias con el tiempo porque una lectura aislada rara vez captura todo el panorama cardiovascular.',
  'Glycemic':                    'La regulación de azúcar en sangre influye en energía, metabolismo y salud de los tejidos a largo plazo. Meridian observa los marcadores glucémicos juntos porque el patrón entre varios resultados importa más que un solo número.',
  'Kidney / Renal':              'Marcadores de filtración renal y eliminación de desechos que Meridian observa con el tiempo — porque la capacidad renal tiende a cambiar gradualmente y las tendencias tienen más señal que una lectura aislada.',
  'Liver':                       'Marcadores de enzimas y proteínas hepáticas que pueden reflejar cómo el hígado responde al estrés, recuperación, nutrición y demandas metabólicas con el tiempo.',
  'Electrolytes':                'El balance de electrolitos regula líquidos, química ácido-base y señalización celular. Meridian los observa en conjunto porque un cambio en uno a menudo refleja ajustes en el sistema completo.',
  'Thyroid Panel':               'Tu tiroides influye en metabolismo, energía, regulación de temperatura y recuperación. Meridian sigue estas señales con el tiempo porque la función tiroidea suele cambiar de forma gradual.',
  'Vitamins & Nutrients':        'Los niveles de micronutrientes — incluyendo reservas de hierro — pueden influir silenciosamente en energía, inmunidad, ánimo y recuperación. Meridian observa tendencias porque las deficiencias suelen desarrollarse lentamente.',
  'Hormones':                    'Las señales hormonales moldean energía, recuperación, respuesta al estrés, libido y ánimo. Meridian las observa como un sistema conectado porque ninguna hormona funciona completamente aislada.',
  'Inflammation / Cardiac Risk': 'La inflamación de bajo grado es una señal de fondo relacionada con riesgo cardiovascular, salud metabólica y recuperación. Meridian la observa con el tiempo porque una elevación sostenida puede importar más que un resultado aislado.',
  'Urinalysis':                  'Los hallazgos de orina le dan a Meridian una vista de salud renal y urinaria, balance de hidratación y patrones químicos que complementan el contexto de sangre.',
  'Other':                       'Estos marcadores añaden contexto adicional a tu perfil biológico. Meridian los sigue junto con señales relacionadas para construir un panorama más completo.',
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
  hepatitis_a_igm_ab: 'Immune', hepatitis_b_core_igm: 'Immune', hepatitis_b_surface_antigen: 'Immune', hepatitis_c_ab: 'Immune', hiv_1_2_ab: 'Immune', rpr_syphilis: 'Immune',
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
  'Cardiovascular':       'Señales de transporte de lípidos y riesgo vascular. Meridian observa cómo se mueven juntas con el tiempo, en lugar de reaccionar a una sola lectura.',
  'Metabolic':            'Regulación de azúcar en sangre, balance de electrolitos y energía celular. Los cambios aquí pueden conectar con dieta, hidratación, estrés y salud metabólica a largo plazo.',
  'Renal / Filtration':   'Marcadores de filtración renal que reflejan qué tan bien el cuerpo elimina desechos y maneja el balance de líquidos con el tiempo.',
  'Liver':                'Patrones de enzimas y proteínas hepáticas que pueden reflejar estrés celular, recuperación, nutrición y cambios en función hepática con el tiempo.',
  'Thyroid / Energy':     'Señales tiroideas que influyen en metabolismo, producción de energía y recuperación. Las tendencias aquí suelen importar más que lecturas aisladas.',
  'Blood / Oxygen':       'Tamaño, cantidad y capacidad de transporte de oxígeno de las células rojas. Estas señales pueden conectar con hierro, disponibilidad de nutrientes y recuperación.',
  'Immune':               'Conteos de células blancas y patrones del diferencial que pueden reflejar activación inmune, estrés de recuperación o adaptación fisiológica.',
  'Vitamins & Nutrients': 'Estado de micronutrientes que moldea silenciosamente energía, inmunidad, ánimo y función celular con el tiempo.',
  'Hormones':             'Señales hormonales conectadas con energía, recuperación, respuesta al estrés y balance metabólico. Meridian las observa como sistema, no de forma aislada.',
  'Inflammation':         'Señales de inflamación sistémica que conectan con riesgo cardiovascular, salud metabólica y cómo el cuerpo maneja estrés y recuperación.',
  'Urinary':              'Marcadores renales y urinarios que añaden contexto sobre filtración, hidratación y patrones de salud urinaria.',
  'Other':                'Señales adicionales que añaden contexto a tu perfil biológico más amplio.',
}

const PANEL_EDUCATION: Record<string, string> = {
  'CBC':                         'Tu CBC ayuda a Meridian a entender patrones de células sanguíneas, transporte de oxígeno y distribución de células inmunes — señales que pueden cambiar con estrés, nutrición, recuperación y otros factores.',
  'Lipid Panel':                 'Tu panel de lípidos ayuda a Meridian a entender cómo tu cuerpo transporta colesterol y grasas. Aquí, las tendencias importan más que una lectura aislada.',
  'Glycemic':                    'Tus marcadores glucémicos ayudan a Meridian a entender la regulación de azúcar en sangre y los patrones de glucosa a largo plazo que pueden conectar con salud metabólica y energía.',
  'Kidney / Renal':              'Estos marcadores le dan a Meridian contexto sobre filtración renal, balance de hidratación y eliminación de desechos — señales que tienden a cambiar gradualmente con el tiempo.',
  'Liver':                       'Tus marcadores hepáticos ayudan a Meridian a entender patrones de enzimas y metabolismo de proteínas que pueden reflejar cómo tu hígado responde al estrés, recuperación, medicamentos y hábitos de estilo de vida.',
  'Electrolytes':                'Tus electrolitos le dan a Meridian contexto sobre balance de líquidos, regulación ácido-base y señalización celular — el ambiente químico que sostiene gran parte de los procesos fisiológicos.',
  'Thyroid Panel':               'Tu panel tiroideo le da a Meridian contexto sobre señales hormonales que influyen en metabolismo, energía, regulación de temperatura y patrones de recuperación con el tiempo.',
  'Vitamins & Nutrients':        'Tus marcadores nutricionales — incluyendo reservas de hierro — ayudan a Meridian a entender tu estado de micronutrientes, que puede afectar silenciosamente energía, inmunidad, estado de ánimo y recuperación con el tiempo.',
  'Hormones':                    'Tus marcadores hormonales le dan a Meridian contexto sobre señales que moldean energía, recuperación, respuesta al estrés y balance metabólico como un sistema integrado.',
  'Inflammation / Cardiac Risk': 'Tus marcadores de inflamación y riesgo cardíaco ayudan a Meridian a entender inflamación sistémica de bajo grado y patrones cardiovasculares con el tiempo.',
  'Serology / Infectious Disease': 'Los marcadores de serología añaden contexto cualitativo para patrones de cernimiento infeccioso. Meridian los sigue como resultados de estilo diagnóstico, no como biomarcadores numéricos.',
  'Urinalysis':                  'Tu urinalysis añade contexto sobre salud renal y urinaria, hidratación y patrones químicos que complementan tus laboratorios de sangre.',
  'Other':                       'Estos marcadores añaden contexto adicional a tu perfil biológico más amplio junto con señales relacionadas.',
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
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-PR', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-PR', {
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
    case 'Low':       return { bg: colors.attention, border: colors.attentionBorder, label: 'Bajo',      dot: '#FB923C' }
    case 'High':      return { bg: colors.attention, border: colors.attentionBorder, label: 'Alto',     dot: '#FB923C' }
    case 'Critical':  return { bg: colors.critical,  border: colors.criticalBorder,  label: 'Crítico', dot: '#F87171' }
    // ── Legacy states (backward compat for existing DB records) ───────────────
    case 'Optimal':   return { bg: colors.optimal,   border: colors.optimalBorder,   label: 'Normal',   dot: '#2DD4BF' }
    case 'Watch':     return { bg: colors.watch,      border: colors.watchBorder,     label: 'En seguimiento', dot: '#FCD34D' }
    case 'Attention': return { bg: colors.attention,  border: colors.attentionBorder, label: 'Revisión',   dot: '#FB923C' }
    default:          return { bg: colors.cardBg,     border: colors.cardBorder,      label: '—',        dot: colors.textMuted }
  }
}

// Returns a small contextual descriptor shown beneath the badge in detail sheets.
// Explains Meridian's interpretation intent vs the clinical range bar — two distinct signals.
function getStateBadgeMeta(state: string): string | null {
  switch (state) {
    case 'Watch':     return 'Meridian está observando un patrón contextual'
    case 'Attention': return 'Fuera del rango clínico de referencia'
    case 'Low':       return 'Por debajo del rango clínico de referencia'
    case 'High':      return 'Por encima del rango clínico de referencia'
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
  wbc: "WBC le da a Meridian una ventana hacia la actividad inmune: cuántos glóbulos blancos circulan y, junto con el diferencial, qué tipos están elevados o bajos. Los cambios pueden conectar con activación inmune, recuperación, estrés fisiológico o adaptación.",
  rbc: "Los glóbulos rojos llevan oxígeno desde los pulmones hacia los tejidos. Meridian sigue este conteo porque sus cambios pueden conectar con hierro, nutrientes, actividad de médula ósea y eficiencia del transporte de oxígeno.",
  hemoglobin: "La hemoglobina transporta oxígeno por la sangre y es central para cómo tu cuerpo produce energía. Meridian la sigue junto con RBC y ferritina para entender capacidad de transporte de oxígeno y su tendencia.",
  hematocrit: "El hematocrito refleja qué proporción del volumen de sangre está compuesta por glóbulos rojos. Meridian lo observa como parte del panorama de oxígeno, hidratación, reservas de hierro y producción celular.",
  mcv: "MCV mide el tamaño promedio de tus glóbulos rojos. Meridian lo observa porque el tamaño celular puede reflejar disponibilidad de hierro, B12 y folato, a veces antes de que otros marcadores cambien.",
  mch: "MCH refleja cuánta hemoglobina contiene cada glóbulo rojo en promedio. Meridian lo sigue junto con MCV y MCHC para entender calidad celular y eficiencia del transporte de oxígeno.",
  mchc: "MCHC mide la concentración de hemoglobina dentro de los glóbulos rojos. Meridian lo observa junto con MCV y MCH para entender si las células se producen y transportan oxígeno eficientemente.",
  rdw: "RDW mide la variación en el tamaño de los glóbulos rojos. Meridian lo observa porque una variación elevada puede conectar con hierro, B12, folato o cambios tempranos en producción celular.",
  platelets: "Las plaquetas son esenciales para coagulación y reparación vascular. Meridian sigue su conteo porque cambios en cualquier dirección pueden conectar con actividad inmune, inflamación y salud sanguínea general.",
  neutrophils_pct: "Los neutrófilos son respondedores principales del sistema inmune. Meridian observa su proporción porque puede reflejar actividad inmune aguda, estrés fisiológico o patrones persistentes según el contexto.",
  neutrophils_abs: "El conteo absoluto de neutrófilos muestra cuántas células inmunes de primera respuesta están circulando. Meridian lo interpreta mejor junto con el diferencial completo.",
  lymphocytes_pct: "Los linfocitos coordinan defensas específicas, incluyendo células T y B. Meridian observa su proporción porque puede conectar con resiliencia inmune, recuperación y demandas fisiológicas.",
  lymphocytes_abs: "El conteo absoluto de linfocitos refleja el nivel circulante de defensa inmune específica. Meridian lo observa por su relación con resiliencia inmune y recuperación.",
  monocytes_pct: "Los monocitos patrullan la sangre antes de madurar a macrófagos en tejidos. Meridian sigue su proporción porque puede conectar con inflamación de bajo grado, activación inmune o recuperación.",
  monocytes_abs: "El conteo absoluto de monocitos refleja cuántas células inmunes patrulleras circulan. Meridian lo lee junto con el diferencial completo para contexto inflamatorio e inmune.",
  eosinophils_pct: "Los eosinófilos participan en respuestas alérgicas y ciertos tipos de inflamación tisular. Meridian los observa porque elevaciones persistentes pueden conectar con patrones alérgicos o inflamatorios.",
  eosinophils_abs: "El conteo absoluto de eosinófilos muestra cuántas células relacionadas con alergias circulan. Meridian lo observa especialmente cuando las elevaciones son persistentes.",
  basophils_pct: "Los basófilos son glóbulos blancos poco abundantes relacionados con señales alérgicas e inflamatorias. Meridian los lee dentro del diferencial completo.",
  basophils_abs: "El conteo absoluto de basófilos se interpreta mejor como parte del diferencial completo. Meridian lo usa como una pieza pequeña del patrón inmune.",
  mpv: "MPV refleja el tamaño promedio de las plaquetas. Meridian lo observa porque puede conectar con producción plaquetaria, inflamación o contexto cardiovascular.",
  hdl: "HDL ayuda a transportar colesterol fuera de los vasos sanguíneos. Meridian lo observa junto con triglicéridos, inflamación y tendencias metabólicas.",
  ldl: "LDL es uno de los principales marcadores de transporte de colesterol. Meridian lo sigue como parte de un panorama cardiovascular más amplio, donde la tendencia importa más que una lectura aislada.",
  triglycerides: "Los triglicéridos reflejan cuánta grasa circula en sangre. Meridian los observa junto con HDL y marcadores metabólicos por su relación con sensibilidad a la insulina, dieta y riesgo cardiovascular.",
  total_cholesterol: "El colesterol total por sí solo cuenta una historia incompleta. Meridian lo usa como punto de partida junto con HDL, LDL, triglicéridos e inflamación.",
  vldl: "VLDL transporta triglicéridos por la sangre. Meridian lo sigue porque puede conectar con patrones metabólicos como resistencia a la insulina y triglicéridos elevados.",
  non_hdl: "El colesterol no-HDL captura partículas aterogénicas como LDL y VLDL. Meridian lo observa porque puede dar un panorama cardiovascular más completo que LDL solo.",
  ldl_hdl_ratio: "La razón LDL/HDL refleja el balance entre una partícula aterogénica clave y su contraparte protectora. Meridian la sigue porque puede aportar señal cardiovascular adicional.",
  chol_hdl_ratio: "La razón colesterol total/HDL refleja qué proporción del colesterol total está en forma protectora. Meridian sigue su tendencia porque puede ser más útil que un valor aislado.",
  glucose_fasting: "La glucosa en ayunas refleja tu azúcar en sangre en reposo. Meridian la sigue junto con A1c e insulina para entender patrones de regulación glucémica.",
  sodium: "El sodio es el electrolito principal del balance de líquidos. Meridian lo observa por su relación con hidratación, riñón, señales adrenales y manejo de líquidos.",
  potassium: "El potasio es crítico para ritmo cardíaco, contracción muscular y energía celular. Meridian lo observa porque desviaciones pueden tener implicaciones cardiovasculares y renales.",
  chloride: "El cloruro trabaja con sodio y bicarbonato para mantener balance de líquidos y ácido-base. Meridian lo interpreta dentro del sistema de electrolitos.",
  co2: "CO₂ o bicarbonato refleja cómo el cuerpo maneja el balance ácido-base. Meridian lo observa porque puede conectar con metabolismo, riñón, respiración e hidratación.",
  calcium: "El calcio apoya huesos, músculo, señales nerviosas y corazón. Meridian lo observa porque está fuertemente regulado y cambios persistentes pueden tener contexto metabólico.",
  anion_gap: "El anion gap es un valor calculado que refleja el balance de partículas cargadas. Meridian lo observa porque puede señalar acumulación de ácido metabólico no evidente en electrolitos individuales.",
  creatinine: "La creatinina es un desecho que los riñones filtran continuamente. Meridian la observa junto con eGFR y BUN para entender filtración renal y metabolismo muscular.",
  egfr: "eGFR estima qué tan eficientemente tus riñones filtran desechos. Meridian lo sigue con el tiempo porque la función renal suele cambiar gradualmente.",
  egfr_african_american: "Este eGFR ajustado estima capacidad de filtración renal considerando variación biológica en producción de creatinina. Meridian lo usa como contexto renal longitudinal.",
  egfr_non_african_american: "Este eGFR estima la eficiencia de filtración renal. Meridian lo sigue porque las tendencias direccionales suelen importar más que una lectura individual.",
  bun: "BUN refleja cómo los riñones filtran desechos de proteína. Meridian lo observa junto con creatinina porque su razón también aporta contexto de hidratación y proteína dietaria.",
  bun_creatinine_ratio: "La razón BUN/creatinina aporta contexto sobre función renal relativa a hidratación y masa muscular. Puede ayudar a distinguir por qué cambian los marcadores renales.",
  ast: "AST es una enzima que se libera cuando células del hígado, corazón o músculos están bajo estrés. Meridian la observa junto con ALT para entender el origen del patrón.",
  alt: "ALT se libera cuando el hígado está bajo irritación o carga. Meridian la observa porque sus cambios pueden reflejar inflamación, recuperación, medicamentos, alcohol o estrés metabólico.",
  alkaline_phosphatase: "La fosfatasa alcalina se produce en hígado, vías biliares y hueso. Meridian la observa con otros marcadores para entender si el origen parece hepático, biliar, óseo o inflamatorio.",
  bilirubin_total: "La bilirrubina es un subproducto del recambio de glóbulos rojos que el hígado procesa. Meridian la observa por su relación con hígado, bilis y recambio celular.",
  albumin: "La albúmina es la proteína más abundante en sangre y la produce el hígado. Meridian la observa como señal de nutrición, función hepática sintética y balance proteico.",
  globulin: "Las globulinas incluyen anticuerpos y proteínas transportadoras. Meridian las observa por su relación con actividad inmune, función hepática, inflamación y balance proteico.",
  total_protein: "La proteína total resume albúmina y globulinas. Meridian la usa para entender balance proteico, nutrición, función hepática, actividad inmune y recuperación.",
  ag_ratio: "La razón A/G refleja el balance entre albúmina y globulinas. Meridian la observa porque puede dar contexto temprano sobre hígado, actividad inmune o inflamación.",
  hba1c: "A1c le da a Meridian una vista del promedio de exposición a azúcar en sangre durante aproximadamente tres meses. Es una ventana importante hacia regulación glucémica y salud metabólica.",
  insulin_fasting: "La insulina en ayunas revela cuánto trabaja tu cuerpo para mantener estable el azúcar entre comidas. Meridian la observa porque puede cambiar antes que glucosa o A1c.",
  tsh: "TSH es la señal que tu cerebro envía para regular la tiroides. Meridian lo observa porque sus cambios pueden conectar con metabolismo, energía, temperatura, sueño y recuperación.",
  free_t4: "Free T4 es la forma principal de almacenamiento de hormona tiroidea en sangre. Meridian lo sigue porque refleja la materia prima que el cuerpo convierte en hormona activa.",
  free_t3: "Free T3 es la hormona tiroidea activa que impulsa directamente el uso de energía celular. Meridian lo observa porque puede mostrar cómo el cuerpo usa las hormonas tiroideas día a día.",
  total_t3: "Total T3 refleja el nivel circulante total de la principal hormona tiroidea activa. Meridian lo observa dentro del panorama tiroideo, especialmente si Free T3 no está disponible.",
  tpo_antibodies: "Los anticuerpos TPO son proteínas inmunes que pueden atacar tejido tiroideo. Meridian los observa porque elevaciones persistentes se asocian con patrones tiroideos autoinmunes.",
  vitamin_d: "La vitamina D participa en señales inmunes, recuperación, salud ósea, ánimo y metabolismo. Meridian sigue tendencias porque niveles bajos pueden solaparse con recuperación, inflamación y energía.",
  vitamin_b12: "La vitamina B12 apoya función nerviosa, producción de glóbulos rojos y metabolismo energético celular. Meridian la sigue porque la deficiencia puede desarrollarse de forma silenciosa.",
  ferritin: "La ferritina refleja reservas de hierro. Meridian la observa porque reservas bajas pueden afectar energía, transporte de oxígeno e inmunidad antes de que aparezca anemia.",
  folate: "El folato es esencial para reparación de ADN, división celular y producción de glóbulos rojos. Meridian lo observa por su relación con homocisteína y salud celular.",
  magnesium: "El magnesio participa en cientos de reacciones, incluyendo energía, músculo, señales nerviosas y sueño. Meridian lo observa por su relación con fatiga, recuperación y patrones cardiovasculares.",
  testosterone_total: "La testosterona participa en energía, recuperación, masa muscular, ánimo y metabolismo. Meridian la observa junto con cortisol y DHEA-S porque las hormonas rara vez actúan aisladas.",
  cortisol_am: "El cortisol matutino refleja la primera ola diaria de respuesta al estrés y energía. Meridian lo observa por su relación con recuperación, inmunidad, metabolismo y señal adrenal.",
  dhea_s: "DHEA-S es una hormona adrenal asociada con resiliencia y reserva hormonal. Meridian la sigue porque tiende a cambiar gradualmente con edad y estrés.",
  acth: "ACTH es la señal pituitaria que le indica a las glándulas adrenales producir cortisol. Meridian lo sigue junto con cortisol para entender la señalización de estrés.",
  crp_hs: "La hs-CRP es un marcador que Meridian observa para inflamación sistémica de bajo grado. Elevaciones persistentes pueden conectar con riesgo cardiovascular, estrés metabólico y recuperación.",
  homocysteine: "La homocisteína es un aminoácido que puede acumularse cuando el metabolismo de vitaminas B está comprometido. Meridian la observa por su relación con riesgo cardiovascular e inflamación vascular.",
}

function getInterpretation(slug: string): string {
  return INTERPRETATIONS[slug] ?? 'Este biomarcador forma parte del panorama que Meridian está construyendo con el tiempo. Los patrones entre marcadores relacionados suelen tener más peso que una sola lectura.'
}

// ── Micro-intelligence layer ───────────────────────────────────────────────────
interface BiomarkerIntel { why: string; context: string }
const BIOMARKER_CONTEXT: Record<string, BiomarkerIntel> = {
  // ── Thyroid ─────────────────────────────────────────────────────────────────
  tsh: {
    why: 'TSH es la señal que tu cerebro envía para regular cuánta hormona tiroidea produce tu cuerpo. Meridian lo observa porque sus cambios con el tiempo pueden conectar con metabolismo, energía sostenida, regulación de temperatura, calidad de sueño y recuperación — muchas veces antes de que los síntomas sean obvios.',
    context: 'En contexto con Free T3, Free T4 y cortisol, Meridian observa si un cambio en TSH refleja un patrón del sistema tiroideo o una fluctuación temporal. Cuando varias señales tiroideas se mueven juntas, el patrón tiene más peso interpretativo que una lectura individual.',
  },
  free_t4: {
    why: 'Free T4 es la principal forma de almacenamiento de hormona tiroidea que circula en la sangre. Meridian lo sigue porque refleja la materia prima que tu cuerpo convierte en la hormona activa que impulsa el metabolismo celular y la energía.',
    context: 'Un cambio aislado en Free T4 puede significar algo distinto a un cambio que ocurre junto con TSH o Free T3. Meridian observa si el cluster tiroideo cuenta una historia consistente — o si parece ser una fluctuación dentro de una sola parte del sistema.',
  },
  free_t3: {
    why: 'Free T3 es la hormona tiroidea activa que impulsa directamente el uso de energía celular. Meridian lo observa porque los niveles de T3 pueden cambiar incluso cuando TSH parece estable, y puede reflejar mejor cómo tu cuerpo está usando realmente las hormonas tiroideas día a día.',
    context: 'En contexto con TSH y Free T4, un patrón de Free T3 puede revelar más sobre cómo el cuerpo está usando las hormonas tiroideas que TSH por sí solo. Meridian observa si los cambios en T3 persisten entre lecturas o si aparecen como fluctuaciones aisladas — esa diferencia suele importar más que un solo valor.',
  },
  total_t3: {
    why: 'Total T3 refleja el nivel circulante general de la principal hormona tiroidea activa del cuerpo. Meridian lo observa como parte del panorama tiroideo — especialmente cuando Free T3 no está disponible — para entender patrones de señalización metabólica y energética con el tiempo.',
    context: 'Como parte del cluster tiroideo, Total T3 añade peso interpretativo cuando se mueve en alineación con cambios en TSH y T4. Meridian observa si el panorama tiroideo se ve consistente entre marcadores relacionados — o si representa una fluctuación aislada en una sola parte del sistema.',
  },
  // ── CBC ─────────────────────────────────────────────────────────────────────
  wbc: {
    why: "Los glóbulos blancos son los primeros respondedores del sistema inmune. Meridian observa el conteo total junto con el diferencial porque el patrón de tipos celulares elevados o bajos puede dar contexto sobre activación inmune, estrés de recuperación o adaptación fisiológica.",
    context: "Junto con el diferencial y los marcadores inflamatorios, un cambio en WBC puede ayudar a distinguir activación inmune temporal — como enfermedad reciente o estrés físico — de un patrón más persistente. Qué tipos de células están cambiando suele contar una historia más completa que el conteo total solo.",
  },
  rbc: {
    why: "Los glóbulos rojos transportan oxígeno desde los pulmones hacia cada tejido. Meridian sigue el conteo RBC porque sus cambios pueden conectar con disponibilidad de nutrientes, hierro, actividad de médula ósea y eficiencia del suministro de oxígeno.",
    context: "En contexto con hemoglobina, hematocrito y ferritina, un cambio en RBC puede reflejar disponibilidad de hierro o nutrientes. Meridian observa si esto representa un patrón de transporte de oxígeno en evolución o una fluctuación aislada; el cluster completo suele ser más informativo.",
  },
  hemoglobin: {
    why: "La hemoglobina es la proteína dentro de los glóbulos rojos que transporta oxígeno. Meridian la observa porque es central para cómo el cuerpo se energiza; sus cambios pueden conectar con energía, resistencia, recuperación y estado de hierro o nutrientes.",
    context: "En contexto con RBC, hematocrito y ferritina, un cambio en hemoglobina puede parecer más consistente con hierro o nutrientes que con un problema sanguíneo estructural. Meridian observa si el patrón persiste o se resuelve y cómo se mueven las señales relacionadas.",
  },
  hematocrit: {
    why: "El hematocrito refleja qué proporción de la sangre está compuesta por glóbulos rojos. Meridian lo sigue como parte del panorama de transporte de oxígeno, ya que puede conectar con hidratación, reservas de hierro y producción celular.",
    context: "Cuando el hematocrito cambia junto con hemoglobina y RBC, Meridian puede evaluar si refleja un patrón consistente de transporte de oxígeno o una fluctuación temporal, a veces relacionada con hidratación o hierro. La persistencia del cluster tiene más peso.",
  },
  mcv: {
    why: "MCV mide el tamaño promedio de los glóbulos rojos. Meridian lo observa porque el tamaño celular puede reflejar disponibilidad de hierro, B12 y folato, y puede cambiar antes que otros marcadores.",
    context: "Un cambio en MCV se interpreta mejor con ferritina, B12 y folato. Si MCV se mueve con ferritina baja, puede emerger un patrón relacionado con hierro; si se mueve con B12 o folato bajos, puede apuntar a otra vía nutricional.",
  },
  mch: {
    why: "MCH refleja cuánta hemoglobina contiene cada glóbulo rojo en promedio. Meridian lo sigue porque añade contexto sobre calidad celular y eficiencia de transporte de oxígeno junto con otros marcadores CBC.",
    context: "MCH rara vez tiene fuerte señal por sí solo, pero junto con MCV, MCHC y marcadores nutricionales puede añadir textura al panorama de células rojas. Meridian observa si refleja un patrón de producción o variación biológica normal.",
  },
  mchc: {
    why: "MCHC mide la concentración de hemoglobina dentro de los glóbulos rojos. Meridian lo observa junto con MCV y MCH porque estos índices muestran si las células se producen eficientemente y transportan oxígeno de forma óptima.",
    context: "Cuando MCHC se mueve junto con MCV y MCH, el patrón combinado puede ayudar a distinguir tipos de cambios en células rojas. Un cambio aislado suele reflejar variación normal; un movimiento consistente del cluster puede merecer seguimiento.",
  },
  rdw: {
    why: "RDW mide cuánta variación hay en el tamaño de los glóbulos rojos. Meridian lo observa porque una variación elevada puede conectar con deficiencia de hierro, B12 o cambios tempranos en producción celular.",
    context: "RDW elevado puede ser una señal temprana de un patrón nutricional. En contexto con ferritina, B12 y MCV, Meridian observa si apunta a hierro, vitaminas B o una fluctuación temporal. Cuando varios marcadores se mueven juntos, el patrón gana peso.",
  },
  platelets: {
    why: "Las plaquetas son esenciales para coagulación y reparación vascular. Meridian sigue su conteo porque cambios importantes pueden aportar contexto sobre actividad inmune, inflamación y salud sanguínea general.",
    context: "Junto con otros marcadores CBC e inflamatorios, cambios en plaquetas pueden reflejar activación inmune o estrés de recuperación más que un problema plaquetario primario. Meridian observa si el cambio es aislado o parte de un patrón mayor.",
  },
  // ── Glycemic ────────────────────────────────────────────────────────────────
  hba1c: {
    why: "A1c refleja la exposición promedio a azúcar en sangre durante aproximadamente tres meses. Meridian lo observa porque es una ventana clara hacia regulación de glucosa, energía, salud metabólica y resiliencia tisular.",
    context: "En contexto con glucosa en ayunas e insulina, A1c ayuda a evaluar si el panorama glucémico mejora, se desplaza o se mantiene estable. A1c estable con glucosa variable puede reflejar variación de corto plazo más que tendencia persistente.",
  },
  insulin_fasting: {
    why: "La insulina en ayunas revela cuánto trabaja el cuerpo para mantener estable el azúcar entre comidas. Meridian la observa porque puede elevarse antes de que cambien glucosa o A1c, conectando con eficiencia metabólica y riesgo cardiovascular.",
    context: "En contexto con glucosa en ayunas y A1c, una insulina elevada puede sugerir que el cuerpo trabaja más de lo esperado para mantener estabilidad glucémica. Meridian observa si se resuelve o persiste, porque la trayectoria tiene más señal que un solo valor.",
  },
  glucose_fasting: {
    why: "La glucosa en ayunas le da a Meridian una foto de cómo el cuerpo maneja azúcar en reposo. Las tendencias pequeñas pero sostenidas pueden conectar con energía, resiliencia metabólica y salud a largo plazo.",
    context: "Aislada puede parecer leve, pero junto con A1c e insulina, Meridian puede evaluar si refleja variación temporal o un patrón más amplio de regulación de glucosa. Cambios consistentes entre visitas pueden merecer seguimiento.",
  },
  // ── Lipid Panel ─────────────────────────────────────────────────────────────
  total_cholesterol: {
    why: "El colesterol total refleja la suma de las partículas de colesterol en sangre. Por sí solo cuenta una historia incompleta; Meridian lo usa como punto de partida dentro del contexto de HDL, LDL, triglicéridos e inflamación.",
    context: "Su valor interpretativo viene de sus componentes. En contexto con HDL, LDL, triglicéridos y hs-CRP, Meridian observa si el panorama parece metabólicamente favorable o si amerita atención con las tendencias.",
  },
  hdl: {
    why: "HDL ayuda a llevar exceso de colesterol fuera de los vasos y de vuelta al hígado. Meridian lo observa porque HDL bajo junto con triglicéridos altos e inflamación puede conectar con patrones cardiometabólicos que un número solo no captura.",
    context: "Meridian observa HDL junto con triglicéridos, inflamación y tendencias metabólicas. HDL bajo con triglicéridos altos puede sugerir contexto metabólico más amplio; HDL estable o en aumento dentro de un cluster favorable suele ser una señal tranquilizadora.",
  },
  ldl: {
    why: "LDL transporta colesterol hacia tejidos y es uno de los marcadores cardiovasculares más seguidos. Meridian lo observa con el tiempo porque las tendencias, no lecturas aisladas, aportan el contexto más útil.",
    context: "En contexto con razón HDL, triglicéridos y hs-CRP, un cambio en LDL puede significar cosas distintas. LDL alto con triglicéridos e inflamación altos puede ser más significativo que LDL alto en un panorama metabólico favorable.",
  },
  vldl: {
    why: "VLDL transporta triglicéridos por la sangre. Meridian lo sigue porque VLDL elevado puede solaparse con patrones metabólicos como resistencia a la insulina, triglicéridos altos y riesgo cardiovascular.",
    context: "VLDL suele moverse de cerca con triglicéridos. Cuando ambos están elevados, Meridian observa si el patrón combinado refleja señal metabólica más amplia, como sensibilidad a la insulina o patrones dietarios, en lugar de una fluctuación aislada.",
  },
  triglycerides: {
    why: "Los triglicéridos reflejan cuánta grasa circula en sangre tras el ayuno. Meridian los observa porque elevaciones sostenidas pueden conectar con dieta, sensibilidad a la insulina, salud metabólica y riesgo cardiovascular, especialmente junto con HDL bajo.",
    context: "En contexto con HDL e insulina, un cambio en triglicéridos puede sugerir un patrón metabólico más amplio. Triglicéridos altos junto con HDL bajo es un cluster que Meridian observa cuidadosamente.",
  },
  non_hdl: {
    why: "El colesterol no-HDL captura todas las partículas que pueden contribuir a acumulación arterial, incluyendo LDL y VLDL. Meridian lo observa porque puede dar un panorama cardiovascular más completo que LDL solo.",
    context: "Non-HDL añade profundidad cuando se considera junto con LDL y VLDL. En contexto con el cluster lipídico y hs-CRP, Meridian observa si refleja un patrón aterogénico consistente o si las señales globales siguen favorables.",
  },
  ldl_hdl_ratio: {
    why: "La razón LDL/HDL refleja el balance entre una partícula aterosclerótica clave y su contraparte protectora. Meridian la observa porque puede llevar más señal que cualquiera de los dos valores por separado.",
    context: "Esta razón puede llevar más señal cardiovascular que los marcadores individuales. Meridian observa si se mueve en dirección favorable o desfavorable junto con inflamación y metabolismo; la tendencia pesa más que un valor aislado.",
  },
  chol_hdl_ratio: {
    why: "La razón colesterol total/HDL es una señal cardiovascular que refleja cuánto del colesterol total está en una forma protectora. Meridian la sigue junto con valores absolutos para una imagen más completa.",
    context: "En contexto con lípidos e inflamación, esta razón muestra el balance cardiovascular global. Si empeora junto con triglicéridos o inflamación, puede sugerir un patrón más amplio; si mejora con lípidos favorables, suele ser alentador.",
  },
  // ── Hormones ────────────────────────────────────────────────────────────────
  testosterone_total: {
    why: "La testosterona participa en energía, mantenimiento muscular, recuperación, libido, ánimo y metabolismo en hombres y mujeres. Meridian la observa porque cambios sostenidos pueden conectar con estrés, recuperación y balance hormonal.",
    context: "En contexto con cortisol y DHEA-S, un cambio en testosterona puede reflejar balance hormonal sistémico. Cortisol alto con testosterona baja es un patrón que Meridian observa por posible relación con carga de estrés o recuperación.",
  },
  cortisol_am: {
    why: "El cortisol matutino representa la primera ola diaria de respuesta al estrés y activación. Meridian lo observa porque cambios sostenidos pueden conectar con recuperación, inmunidad, metabolismo, sueño y señal adrenal.",
    context: "En contexto con tiroides, glucosa e inflamación, el cortisol matutino ayuda a evaluar si el panorama estrés-recuperación está balanceado o desplazado. Una fluctuación aislada pesa menos que un cluster consistente.",
  },
  dhea_s: {
    why: "DHEA-S es una hormona adrenal precursora de hormonas sexuales y asociada con resiliencia, recuperación y reserva hormonal. Meridian la observa porque la tendencia suele ser más informativa que un valor aislado.",
    context: "En contexto con cortisol y testosterona, DHEA-S ayuda a evaluar el balance adrenal y hormonal. DHEA-S descendente junto con cortisol persistentemente elevado puede sugerir un patrón adrenal a monitorear.",
  },
  // ── Inflammation / Cardiac Risk ─────────────────────────────────────────────
  crp_hs: {
    why: "La hs-CRP es uno de los marcadores más sensibles que Meridian observa para inflamación sistémica de bajo grado. Elevaciones persistentes pueden conectar con riesgo cardiovascular, estrés metabólico y recuperación.",
    context: "En contexto con lípidos, metabolismo y hormonas, una hs-CRP sostenida puede sugerir que la inflamación forma parte de un patrón biológico más amplio. Meridian observa si aparece junto con otros cambios o aislada.",
  },
  homocysteine: {
    why: "La homocisteína es un aminoácido que se acumula cuando el metabolismo de vitaminas B está comprometido. Meridian la observa porque niveles elevados se han asociado con riesgo cardiovascular, inflamación vascular y metilación.",
    context: "En contexto con B12, folato e inflamación, homocisteína elevada puede reflejar una vía nutricional o una señal cardiovascular más compleja. Meridian observa si los nutrientes apoyan un patrón de metilación o vitaminas B.",
  },
  // ── Vitamins & Nutrients ────────────────────────────────────────────────────
  vitamin_d: {
    why: "La vitamina D participa en señalización inmune, recuperación, salud ósea, ánimo y metabolismo. Meridian observa tendencias porque niveles bajos sostenidos pueden solaparse con recuperación, inflamación, inmunidad y energía.",
    context: "En contexto con inflamación y hormonas, vitamina D baja persistente puede formar parte de señales inmunes y de recuperación más amplias. Meridian observa si es una deficiencia aislada o parte de un patrón mayor.",
  },
  vitamin_b12: {
    why: "La vitamina B12 apoya conducción nerviosa, producción de glóbulos rojos, síntesis de ADN y energía celular. Meridian la observa porque la deficiencia puede desarrollarse silenciosamente y conectar con fatiga, cognición y señales neurológicas.",
    context: "En contexto con folato, homocisteína y CBC — especialmente MCV y RDW — B12 ayuda a evaluar si el estado nutricional afecta producción celular o señal neurológica.",
  },
  folate: {
    why: "El folato es esencial para reparación de ADN, división celular y producción de glóbulos rojos. Meridian lo observa porque niveles bajos pueden conectar con homocisteína elevada, cambios en células rojas, recuperación y salud celular.",
    context: "En contexto con B12 y homocisteína, un cambio en folato ayuda a evaluar si emerge un patrón de metilación o vitaminas B. Cuando se mueven juntos, la señal combinada gana significado.",
  },
  magnesium: {
    why: "El magnesio participa en más de 300 reacciones enzimáticas, incluyendo producción de energía, contracción muscular, señal nerviosa y sueño. Meridian lo observa por su relación con fatiga, recuperación muscular, estrés y patrones cardiovasculares.",
    context: "El magnesio sérico no siempre refleja reservas intracelulares, por eso Meridian lo observa junto con electrolitos y metabolismo. Un patrón bajo-normal persistente puede merecer seguimiento en contexto.",
  },
  ferritin: {
    why: "La ferritina refleja reservas de hierro: el respaldo que el cuerpo usa antes de que la anemia sea evidente. Meridian la observa porque ferritina baja puede conectar con fatiga, recuperación pobre, niebla mental e inmunidad.",
    context: "En contexto con hemoglobina, RBC y MCV, ferritina ayuda a evaluar si la disponibilidad de hierro afecta transporte de oxígeno o recuperación. Ferritina baja con hemoglobina estable puede reflejar depleción temprana.",
  },
  // ── Kidney / Renal ──────────────────────────────────────────────────────────
  creatinine: {
    why: "La creatinina es un desecho de actividad muscular que los riñones filtran continuamente. Meridian la observa como proxy de eficiencia de filtración renal; tendencias al alza pueden señalar cambios en eliminación de desechos.",
    context: "En contexto con eGFR y BUN, creatinina puede parecer más relacionada con hidratación o carga muscular que con función renal si eGFR está estable. Cuando creatinina y eGFR se mueven juntos, el patrón pesa más.",
  },
  bun: {
    why: "BUN refleja cómo los riñones filtran desechos proteicos de la sangre. Meridian lo observa junto con creatinina porque la relación entre ambos aporta contexto de hidratación y metabolismo de proteína.",
    context: "En contexto con creatinina y eGFR, BUN ayuda a distinguir entre cambio de filtración renal y variación de hidratación o proteína. BUN aislado con creatinina/eGFR estables suele apuntar más a hidratación o dieta.",
  },
  bun_creatinine_ratio: {
    why: "La razón BUN/creatinina da contexto adicional sobre función renal relativa a masa muscular e hidratación. Puede ayudar a distinguir diferentes razones por las que cambian los marcadores renales.",
    context: "Leída con el cluster renal completo, esta razón ayuda a interpretar el origen probable del cambio. Una razón alta con eGFR estable puede sugerir deshidratación o alto recambio proteico.",
  },
  egfr: {
    why: "eGFR estima qué tan bien los riñones filtran desechos de la sangre, una de las medidas más directas de función renal en laboratorios estándar. Meridian lo observa porque la capacidad renal suele cambiar gradualmente.",
    context: "Meridian observa eGFR con el tiempo porque una lectura aislada es una foto; una deriva consistente entre visitas tiene más peso. Junto con creatinina y BUN, muestra si el panorama renal está estable, mejora o requiere seguimiento.",
  },
  egfr_african_american: {
    why: "Este cálculo de eGFR toma en cuenta variación biológica en producción de creatinina y ofrece una estimación ajustada de filtración renal. Meridian lo observa como contexto renal longitudinal.",
    context: "En contexto con creatinina y BUN, Meridian usa este eGFR ajustado para evaluar patrones de filtración renal. Una lectura es una foto; las tendencias consistentes entre visitas importan más.",
  },
  egfr_non_african_american: {
    why: "eGFR estima qué tan bien los riñones filtran desechos de la sangre. Meridian lo observa con el tiempo porque la capacidad renal tiende a cambiar gradualmente.",
    context: "En contexto con creatinina y BUN, Meridian usa esta estimación para evaluar patrones de filtración renal. Las tendencias direccionales consistentes pesan más que una lectura aislada.",
  },
  // ── Liver ───────────────────────────────────────────────────────────────────
  ast: {
    why: "AST es una enzima presente en hígado, corazón y músculos que se libera cuando las células están bajo estrés o daño. Meridian la observa por su relación con hígado, estrés muscular, recuperación e inflamación tisular.",
    context: "En contexto con ALT y fosfatasa alcalina, AST ayuda a evaluar si un cambio parece hepático o de origen no hepático. AST sin ALT puede conectar con músculo; AST y ALT juntos apuntan más a hígado.",
  },
  alt: {
    why: "ALT es uno de los marcadores que el hígado libera cuando está bajo irritación o carga. Meridian lo observa porque sus cambios pueden revelar respuesta a inflamación, recuperación, medicamentos, alcohol, metabolismo o estrés hepático.",
    context: "En contexto con otros marcadores hepáticos, ALT puede parecer más consistente con inflamación metabólica, estrés de recuperación o dieta que con un problema persistente, especialmente si el cambio es leve.",
  },
  alkaline_phosphatase: {
    why: "La fosfatasa alcalina se produce en hígado, vías biliares y hueso. Meridian la observa porque niveles elevados pueden conectar con hígado, bilis, recambio óseo o inflamación.",
    context: "En contexto con AST, ALT y bilirrubina, un cambio en fosfatasa alcalina ayuda a evaluar si se relaciona con hígado/bilis, hueso o señal inflamatoria. El cluster define mejor el origen.",
  },
  bilirubin_total: {
    why: "La bilirrubina es un subproducto del recambio de glóbulos rojos que el hígado procesa y elimina. Meridian la observa porque puede conectar con procesamiento hepático, flujo biliar o recambio celular.",
    context: "En contexto con AST, ALT y CBC, bilirrubina ayuda a evaluar si el patrón conecta con hígado, bilis o recambio de glóbulos rojos. Si cambia aislada, el recambio celular puede ser más probable.",
  },
  albumin: {
    why: "La albúmina es la proteína más abundante en sangre y la produce el hígado. Meridian la observa porque refleja nutrición, función hepática sintética y balance proteico.",
    context: "En contexto con proteína total, razón A/G y marcadores hepáticos, albúmina puede reflejar cambios de síntesis hepática, nutrición o inflamación. Albúmina baja con globulina alta puede sugerir señal inflamatoria o inmune.",
  },
  globulin: {
    why: "Las globulinas son proteínas que incluyen anticuerpos y proteínas transportadoras. Meridian las observa porque pueden dar contexto sobre actividad inmune, función hepática, inflamación crónica y balance proteico.",
    context: "En contexto con albúmina y A/G, globulina ayuda a evaluar si un patrón proteico refleja activación inmune, inflamación crónica o cambios hepáticos. Globulina alta con albúmina baja puede ser significativo.",
  },
  total_protein: {
    why: "La proteína total refleja albúmina y globulinas juntas, dando una vista amplia de producción y mantenimiento de proteína. Puede conectar con nutrición, hígado, inmunidad y recuperación.",
    context: "En contexto con albúmina y globulina, proteína total resume el balance proteico. Cuando albúmina y globulina se mueven en direcciones opuestas con proteína total estable, Meridian observa un cambio de balance.",
  },
  ag_ratio: {
    why: "La razón albúmina/globulina refleja el balance entre dos grandes grupos de proteínas. Meridian la observa porque sus cambios pueden dar contexto temprano sobre hígado, inmunidad o inflamación crónica.",
    context: "Cuando cambia la razón A/G, Meridian observa qué componente — albúmina o globulina — impulsa el cambio. Una caída persistente junto con otras señales hepáticas o inmunes puede tener más peso.",
  },
  // ── CMP electrolytes ────────────────────────────────────────────────────────
  sodium: {
    why: "El sodio es el electrolito principal que gobierna balance de líquidos. Meridian lo observa porque cambios sutiles pueden conectar con hidratación, regulación renal, señal adrenal y manejo de líquidos celulares.",
    context: "En contexto con potasio, cloruro y CO2, sodio ayuda a evaluar si el balance de líquidos está estable o si forma parte de un patrón de electrolitos. Cambios múltiples pesan más que sodio aislado.",
  },
  potassium: {
    why: "El potasio es crítico para ritmo cardíaco, contracción muscular y energía celular. Meridian lo observa porque desviaciones importantes pueden tener implicaciones cardiovasculares y dar contexto renal/adrenal.",
    context: "En contexto con sodio y electrolitos, un cambio en potasio ayuda a evaluar si parece hidratación, dieta o señal renal/adrenal persistente. Cambios fuera de rango o junto con otros electrolitos se observan más de cerca.",
  },
  chloride: {
    why: "El cloruro trabaja junto con sodio y bicarbonato para mantener balance de líquidos y ácido-base. Meridian lo observa dentro del sistema de electrolitos, donde el patrón importa más que un valor aislado.",
    context: "En contexto con sodio y CO2, cloruro ayuda a evaluar si el panorama ácido-base y de electrolitos está balanceado. Un cambio aislado suele ser transitorio; junto con CO2 puede apuntar a patrón ácido-base.",
  },
  co2: {
    why: "CO2 reportado como bicarbonato refleja cómo el cuerpo maneja el balance ácido-base, el equilibrio químico que sostiene procesos celulares. Meridian lo observa por su relación con metabolismo, riñón, respiración e hidratación.",
    context: "En contexto con cloruro y anion gap, CO2 ayuda a evaluar si el ácido-base está estable o mostrando dirección. CO2 bajo con anion gap alto puede tener más significado que un valor aislado.",
  },
  calcium: {
    why: "El calcio apoya huesos, contracción muscular, señal nerviosa y función cardíaca. Meridian lo observa porque el calcio en sangre está muy regulado y desviaciones pueden reflejar vitamina D, paratiroides u otros patrones metabólicos.",
    context: "El calcio en sangre está fuertemente regulado, por eso cambios persistentes se observan en contexto con vitamina D y metabolismo. Meridian evalúa si el cambio es aislado o conectado a señales relacionadas.",
  },
  anion_gap: {
    why: "El anion gap es un valor calculado que refleja el balance de partículas cargadas en sangre. Meridian lo observa porque elevaciones pueden señalar acumulación de ácido metabólico no evidente en electrolitos individuales.",
    context: "En contexto con CO2 y cloruro, anion gap elevado puede ayudar a evaluar carga ácida metabólica. Cuando sube junto con CO2 bajo, el patrón puede tener más peso que una lectura aislada.",
  },
  // ── CBC Differential ────────────────────────────────────────────────────────
  neutrophils_pct: {
    why: "Los neutrófilos son los respondedores más abundantes del sistema inmune, movilizados rápidamente ante infección o inflamación. Meridian sigue su proporción dentro del diferencial porque el balance de tipos celulares cuenta mejor la historia inmune.",
    context: "En contexto con el diferencial completo y hs-CRP, un cambio de neutrófilos ayuda a distinguir respuesta temporal — estrés físico o enfermedad reciente — de activación inmune persistente.",
  },
  neutrophils_abs: {
    why: "El conteo absoluto de neutrófilos refleja cuántas células de primera respuesta están circulando. Meridian lo sigue junto con el porcentaje para una imagen más completa de actividad inmune.",
    context: "En contexto con otros marcadores diferenciales y hs-CRP, un cambio absoluto ayuda a evaluar si el patrón inmune parece transitorio o persistente. Los conteos absolutos son más útiles dentro del cluster completo.",
  },
  lymphocytes_pct: {
    why: "Los linfocitos son células de defensa específica, incluyendo células T y B. Meridian observa su proporción porque puede conectar con resiliencia inmune, recuperación y manejo de demandas fisiológicas.",
    context: "En contexto con WBC y otros diferenciales, linfocitos ayudan a evaluar si el panorama inmune refleja una respuesta transitoria o persistente. Linfocitos relativamente bajos con neutrófilos altos puede sugerir estrés o recuperación.",
  },
  lymphocytes_abs: {
    why: "El conteo absoluto de linfocitos refleja el nivel circulante de defensa inmune específica. Meridian lo observa porque puede conectar con resiliencia inmune, respuesta y recuperación.",
    context: "En contexto con otros diferenciales e inflamación, un cambio absoluto de linfocitos es más significativo como patrón que aislado. Meridian observa si persiste o parece actividad inmune temporal.",
  },
  monocytes_pct: {
    why: "Los monocitos circulan antes de madurar en macrófagos tisulares. Meridian los observa porque elevaciones pueden conectar con inflamación de bajo grado, activación inmune o recuperación, especialmente con otros marcadores inflamatorios.",
    context: "En contexto con el diferencial y hs-CRP, los monocitos añaden textura al panorama inmune. Elevaciones junto con señales inflamatorias pueden sugerir activación más persistente.",
  },
  monocytes_abs: {
    why: "El conteo absoluto de monocitos refleja cuántas células inmunes patrulleras circulan. Meridian lo sigue porque cambios pueden conectar con actividad inflamatoria o señales inmunes.",
    context: "En contexto con el diferencial y hs-CRP, monocitos absolutos añaden contexto. Meridian observa si aparecen aislados o como parte de un patrón inflamatorio más amplio.",
  },
  eosinophils_pct: {
    why: "Los eosinófilos participan en alergias, defensa parasitaria y ciertos tipos de inflamación tisular. Meridian los sigue porque elevaciones persistentes pueden conectar con patrones alérgicos o inflamatorios.",
    context: "En contexto con otros diferenciales CBC, eosinófilos ayudan a evaluar si el patrón puede conectar con alergias, ambiente o respuesta inmune. Elevación aislada leve suele ser transitoria.",
  },
  eosinophils_abs: {
    why: "El conteo absoluto de eosinófilos refleja cuántas células relacionadas con alergias circulan. Meridian lo observa porque elevaciones persistentes pueden conectar con inflamación alérgica o patrones inmunes.",
    context: "En contexto con el diferencial e inflamación, los eosinófilos absolutos importan más cuando persisten o coinciden con otros cambios. Una elevación aislada suele pesar menos.",
  },
  basophils_pct: {
    why: "Los basófilos son los glóbulos blancos menos abundantes y participan en señales alérgicas e inflamatorias. Meridian los sigue como parte del panorama inmune completo.",
    context: "En contexto con el diferencial y eosinófilos, un cambio de basófilos es más significativo como parte de un patrón inmune que aislado. Meridian observa el cluster completo.",
  },
  basophils_abs: {
    why: "El conteo absoluto de basófilos suele ser muy bajo y es más relevante dentro del diferencial completo. Meridian lo sigue como un pequeño componente del patrón inmune.",
    context: "Los basófilos absolutos tienen más valor en contexto con el diferencial completo y señales inflamatorias. Meridian los interpreta como una pieza del panorama inmune amplio.",
  },
  // ── Additional CBC ────────────────────────────────────────────────────────────
  mpv: {
    why: "MPV refleja el tamaño promedio de las plaquetas. Meridian lo observa como parte del panorama plaquetario porque cambios pueden conectar con producción plaquetaria, inflamación o contexto cardiovascular.",
    context: "En contexto con plaquetas y CBC, MPV añade textura. Plaquetas bajas con MPV alto puede sugerir producción activa; MPV aislado se observa como variación o parte de patrón mayor.",
  },
  rdw_sd: {
    why: "RDW-SD mide la desviación estándar del tamaño de glóbulos rojos, complementando RDW-CV. Meridian lo sigue porque variación elevada puede conectar con cambios nutricionales o de producción celular.",
    context: "En contexto con RDW-CV, ferritina, B12 y MCV, RDW-SD añade textura al tamaño celular. Meridian evalúa ambos RDW junto con nutrientes para detectar patrones de producción.",
  },
  // ── Additional Thyroid ─────────────────────────────────────────────────────
  tpo_antibodies: {
    why: "Los anticuerpos TPO son proteínas inmunes que pueden atacar la peroxidasa tiroidea, enzima clave para producir hormona tiroidea. Meridian los observa porque elevaciones persistentes se asocian con patrones autoinmunes tiroideos.",
    context: "En contexto con TSH, Free T4 y Free T3, TPO ayuda a entender si cambios tiroideos pueden tener componente autoinmune. Anticuerpos elevados sin disfunción hormonal actual pueden ameritar seguimiento.",
  },
  // ── Additional Hormones ────────────────────────────────────────────────────
  acth: {
    why: "ACTH es una hormona pituitaria que le indica a las adrenales producir cortisol. Meridian la observa porque ACTH y cortisol juntos dan contexto sobre señalización adrenal y de estrés.",
    context: "En contexto con cortisol AM y DHEA-S, ACTH ayuda a evaluar si el panorama adrenal está balanceado o desplazado. ACTH y cortisol moviéndose en direcciones opuestas puede sugerir origen pituitario/adrenal.",
  },
  // ── Urinalysis — Physical ────────────────────────────────────────────────
  urine_color: {
    why: "El color de orina es una propiedad física simple que Meridian sigue dentro del urinalysis completo. Aunque varía con hidratación, dieta y medicamentos, cambios inusuales o persistentes pueden añadir contexto.",
    context: "El color tiene más valor junto con hidratación y marcadores químicos. Cambios por dieta o hidratación rara vez requieren atención; hallazgos inusuales persistentes junto con otros marcadores pesan más.",
  },
  urine_clarity: {
    why: "La claridad de la orina refleja si la muestra está clara o turbia. Meridian la sigue porque turbidez puede coincidir con células elevadas o bacterias, aunque aislada suele tener poco peso.",
    context: "En contexto con microscopía y químicos, la turbidez puede alinearse con células o señales de infección. Si es el único hallazgo en un urinalysis normal, suele ser menos significativa.",
  },
  urine_specific_gravity: {
    why: "La densidad específica refleja qué tan concentrada está la orina: cuánto material disuelto retienen o liberan los riñones respecto al agua. Meridian la sigue por hidratación y capacidad de concentración renal.",
    context: "La densidad específica varía mucho con líquidos e hidratación. En contexto con sodio y marcadores renales, un patrón alto o bajo persistente puede reflejar hábitos de hidratación o función de concentración renal.",
  },
  urine_ph: {
    why: "El pH urinario refleja acidez o alcalinidad de la orina. Meridian lo observa como propiedad física porque puede dar contexto sobre dieta, metabolismo y química urinaria, aunque varía con factores normales.",
    context: "El pH fluctúa con dieta, hidratación y hora del día, por eso Meridian no pesa una lectura aislada. Patrones persistentemente alcalinos o ácidos pueden añadir contexto cuando se ven con otros marcadores.",
  },
  // ── Urinalysis — Chemical (Dipstick) ────────────────────────────────────
  urine_protein_ua: {
    why: "La proteína no suele estar presente en cantidades significativas en orina; los riñones están diseñados para mantenerla en sangre. Meridian la observa porque un patrón puede conectar con salud de filtración renal.",
    context: "En contexto con creatinina, eGFR y BUN, proteína urinaria ayuda a evaluar si el panorama renal está estable o si forma parte de un patrón. Un hallazgo leve aislado puede ser transitorio.",
  },
  urine_blood_ua: {
    why: "La presencia de sangre en orina es algo que Meridian observa cuidadosamente. Puede tener causas benignas como ejercicio, irritación o timing de la muestra, pero también aporta contexto si persiste o aparece con otros hallazgos.",
    context: "En contexto con WBC, bacterias y proteína, sangre en orina ayuda a evaluar si el patrón conecta con infección, causa benigna o hallazgo urinario a seguir. La persistencia da más peso.",
  },
  urine_glucose_ua: {
    why: "La glucosa normalmente no aparece en orina. Meridian la observa porque su presencia puede indicar que el azúcar en sangre alcanzó niveles donde los riñones comienzan a eliminarla.",
    context: "En contexto con glucosa, A1c e insulina, glucosa urinaria ayuda a evaluar si la regulación glucémica puede estar cambiando de formas aún no visibles completamente en sangre.",
  },
  urine_ketones_ua: {
    why: "Las cetonas en orina indican que el cuerpo usa grasa como combustible en lugar de glucosa. Meridian las observa porque pueden conectar con dieta, ayuno, ejercicio intenso o patrones metabólicos.",
    context: "En contexto con glucosa y A1c, cetonas ayudan a distinguir un patrón dietario/ayuno de algo que merece más atención. Cetonas altas con glucosa elevada se observan más de cerca.",
  },
  urine_nitrite_ua: {
    why: "El nitrito en orina puede formarse cuando ciertas bacterias metabolizan compuestos en el tracto urinario. Meridian lo observa porque un resultado positivo puede conectar con patrón de infección urinaria.",
    context: "En contexto con leukocyte esterase, WBC y bacterias, nitrito positivo añade peso a posible actividad inmune urinaria. Nitrito negativo no descarta infección porque algunas bacterias no lo producen.",
  },
  urine_leukocyte_esterase_ua: {
    why: "Leukocyte esterase es una enzima liberada por glóbulos blancos. Meridian la observa porque su presencia en orina puede indicar actividad inmune en el tracto urinario.",
    context: "En contexto con nitrito, WBC y bacterias, leukocyte esterase ayuda a evaluar actividad de glóbulos blancos urinarios. Es más significativa cuando persiste o aparece con otros hallazgos.",
  },
  urine_bilirubin_ua: {
    why: "La bilirrubina normalmente no está presente en orina. Meridian la observa porque puede reflejar procesamiento hepático o flujo biliar, especialmente junto con marcadores hepáticos de sangre.",
    context: "En contexto con bilirrubina sérica, AST y ALT, bilirrubina urinaria añade contexto hepático. Un hallazgo aislado sin cambios en sangre pesa menos, pero se sigue si persiste.",
  },
  urine_urobilinogen_ua: {
    why: "El urobilinógeno es un subproducto del metabolismo de bilirrubina que aparece en pequeñas cantidades en orina. Meridian lo observa porque valores fuera de rango pueden dar contexto sobre hígado, bilis o recambio de glóbulos rojos.",
    context: "En contexto con bilirrubina sérica, AST, ALT y CBC, urobilinógeno añade una capa al panorama hepático y de glóbulos rojos. Elevación leve suele ser común; persistencia con otras señales pesa más.",
  },
  // ── Urinalysis — Microscopy ──────────────────────────────────────────────
  urine_wbc_hpf: {
    why: "El conteo de WBC en orina refleja cuántos glóbulos blancos hay en un campo microscópico. Meridian lo observa porque elevaciones pueden indicar actividad inmune en el tracto urinario.",
    context: "En contexto con leukocyte esterase, nitrito y bacterias, WBC urinario da precisión cuantitativa. Elevación junto con señales positivas pesa más que cualquier hallazgo aislado.",
  },
  urine_rbc_hpf: {
    why: "El conteo de RBC en orina refleja cuántos glóbulos rojos aparecen en microscopía. Meridian lo observa porque números pequeños pueden ser benignos, pero elevaciones persistentes merecen seguimiento.",
    context: "En contexto con sangre, proteína y otros marcadores urinarios, RBC añade precisión al panorama de sangre en orina. La persistencia o presencia junto con otros hallazgos da más peso.",
  },
  urine_bacteria_hpf: {
    why: "Bacterias en microscopía de orina pueden reflejar infección urinaria o factores de colección de muestra. Meridian las observa junto con marcadores químicos relacionados con infección.",
    context: "En contexto con nitrito, leukocyte esterase y WBC, bacterias añaden peso al patrón. Aisladas sin otras señales pueden reflejar colección de muestra más que infección activa.",
  },
  urine_epithelial_cells_hpf: {
    why: "Las células epiteliales en orina vienen del revestimiento urinario. Pequeñas cantidades son normales; Meridian observa elevaciones porque pueden reflejar actividad local o factores de muestra.",
    context: "En contexto con otros hallazgos microscópicos, células epiteliales añaden textura. Elevaciones leves suelen ser benignas o de colección; junto con señales de infección pueden ser más significativas.",
  },
  urine_casts_hpf: {
    why: "Los cilindros urinarios son estructuras proteicas que se forman en túbulos renales y pueden aparecer en orina. Meridian los observa porque ciertos tipos dan contexto renal, aunque muchos son benignos.",
    context: "El tipo y número de cilindros importa mucho. Cilindros hialinos tras ejercicio son comunes; otros tipos requieren contexto clínico. Meridian los lee junto con creatinina y eGFR.",
  },
  urine_mucus_hpf: {
    why: "El mucus en orina es común y suele reflejar secreciones normales del tracto urinario. Meridian lo sigue como parte del urinalysis completo, aunque rara vez es significativo aislado.",
    context: "El mucus aislado suele ser benigno. En contexto con otros hallazgos microscópicos o de infección, mucus persistente o abundante puede añadir textura, aunque suele tener bajo peso interpretativo.",
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
  amylase: 'Pancreatic Enzymes', lipase: 'Pancreatic Enzymes',
  hepatitis_a_igm_ab: 'Serology / Infectious Disease', hepatitis_b_core_igm: 'Serology / Infectious Disease', hepatitis_b_surface_antigen: 'Serology / Infectious Disease', hepatitis_c_ab: 'Serology / Infectious Disease', hiv_1_2_ab: 'Serology / Infectious Disease', rpr_syphilis: 'Serology / Infectious Disease',
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
  'CBC', 'Lipid Panel', 'Glycemic', 'Kidney / Renal', 'Liver', 'Pancreatic Enzymes', 'Electrolytes',
  'Thyroid Panel', 'Vitamins & Nutrients', 'Hormones', 'Inflammation / Cardiac Risk',
  'Serology / Infectious Disease', 'Urinalysis', 'Other',
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
    case 'Low':       return { bg: colors.attention, border: colors.attentionBorder, dot: '#FB923C', label: 'Bajo'      }
    case 'High':      return { bg: colors.attention, border: colors.attentionBorder, dot: '#FB923C', label: 'Alto'     }
    case 'Critical':  return { bg: colors.critical,  border: colors.criticalBorder,  dot: '#F87171', label: 'Crítico' }
    // ── Legacy states (backward compat for existing DB records) ───────────────
    case 'Optimal':   return { bg: colors.optimal,   border: colors.optimalBorder,   dot: '#2DD4BF', label: 'Normal'   }
    case 'Watch':     return { bg: colors.watch,      border: colors.watchBorder,     dot: '#FCD34D', label: 'En seguimiento' }
    case 'Attention': return { bg: colors.attention,  border: colors.attentionBorder, dot: '#FB923C', label: 'Revisión'   }
    default:          return { bg: colors.cardBg,     border: colors.cardBorder,      dot: colors.textMuted, label: '—' }
  }
}

// Canonical explanation source: HIST_INTERPRETATIONS points to the same dict as INTERPRETATIONS.
// Both Snapshot and Timeline detail sheets draw from the same single source of truth.
const HIST_INTERPRETATIONS = INTERPRETATIONS
function histGetInterpretation(slug: string): string {
  return HIST_INTERPRETATIONS[slug] ?? 'Este biomarcador forma parte del panorama que Meridian está construyendo con el tiempo. Los patrones entre marcadores relacionados suelen tener más peso que una sola lectura.'
}

function histUtcDateKey(isoString: string): string { return isoString.split('T')[0] }
function histFormatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}
function histFormatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-PR', { year: 'numeric', month: 'long', timeZone: 'UTC' })
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
    return new Date(iso).toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
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
              Fecha de muestra {fmtDate(biomarker.collected_at)}
            </p>
          </div>

          {/* Range card — always rendered; optimal range removed in Sprint 1 */}
          <div style={cardStyle}>
            <p style={labelStyle}>Referencia clínica</p>
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
            <p style={labelStyle}>Tendencia</p>
            {prev ? (
              <div>
                <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 4px' }}>
                  Anterior: <span style={{ fontWeight: 700, color: colors.text }}>{prev.value}{prev.unit ? ` ${prev.unit}` : ''}</span>
                  <span style={{ color: colors.textMuted }}>{' '}el {fmtDate(prev.collected_at)}</span>
                </p>
                {delta !== null && (
                  <p style={{ fontSize: '13px', margin: trendProps.contextLine ? '0 0 3px' : '0', fontWeight: 600, color: trendProps.color }}>
                    {delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '— '}{delta} desde el resultado anterior
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
                Nota de seguridad
              </p>
              <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: '0 0 10px' }}>
                Meridian marcó este resultado para revisión clínica. Cuando un marcador llega a este nivel, Meridian reduce la interpretación y te recomienda compartir este resultado con tu médico o equipo de cuidado.
              </p>
              <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>
                Este contexto es educativo únicamente — no es un diagnóstico. Si este resultado es nuevo o inesperado, o si tienes síntomas, consúltalo con un profesional de la salud.
              </p>
            </div>
          ) : (
            <>
              {/* Why it matters */}
              <div style={cardStyle}>
                <p style={labelStyle}>Por qué importa</p>
                <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: 0 }}>
                  {intel?.why ?? 'Este biomarcador es una de las señales que Meridian sigue con el tiempo. Los cambios en contexto junto con marcadores relacionados suelen ser más informativos que una sola lectura.'}
                </p>
              </div>

              {/* Meridian context */}
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <p style={labelStyle}>Contexto Meridian</p>
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
    return new Date(iso).toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
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
            <p style={{ fontSize: '12px', color: colors.textMuted, marginTop: '6px', marginBottom: 0 }}>Fecha de muestra {fmtDate(biomarker.collected_at)}</p>
          </div>
          {/* Range card — optimal range removed in Sprint 1 */}
          <div style={cardStyle}>
            <p style={labelStyle}>Referencia clínica</p>
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
            <p style={labelStyle}>Tendencia</p>
            {prev ? (
              <div>
                <p style={{ fontSize: '13px', color: colors.textSoft, margin: '0 0 4px' }}>Anterior: <span style={{ fontWeight: 700, color: colors.text }}>{prev.value}{prev.unit ? ` ${prev.unit}` : ''}</span><span style={{ color: colors.textMuted }}>{' '}el {fmtDate(prev.collected_at)}</span></p>
                {delta !== null && <p style={{ fontSize: '13px', margin: histTrendProps.contextLine ? '0 0 3px' : '0', fontWeight: 600, color: histTrendProps.color }}>{delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '— '}{delta} desde el resultado anterior</p>}
                {histTrendProps.contextLine && (
                  <p style={{ fontSize: '12px', margin: 0, color: histTrendProps.color, opacity: 0.82, lineHeight: 1.55 }}>{histTrendProps.contextLine}</p>
                )}
              </div>
            ) : <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>No previous result yet.</p>}
          </div>
          {isCritical ? (
            <div style={{ backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: '14px', padding: '14px 16px', marginBottom: 0 }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F87171', marginBottom: '8px', marginTop: 0 }}>Nota de seguridad</p>
              <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: '0 0 8px' }}>Meridian marcó este resultado para revisión clínica. Cuando un marcador llega a este nivel, Meridian reduce la interpretación y te recomienda compartir este resultado con tu médico o equipo de cuidado.</p>
              <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>Este contexto es educativo únicamente — no es un diagnóstico. Si este resultado es nuevo o inesperado, o si tienes síntomas, consúltalo con un profesional de la salud.</p>
            </div>
          ) : (
            <>
              <div style={cardStyle}>
                <p style={labelStyle}>Por qué importa</p>
                <p style={{ fontSize: '13px', color: colors.textSoft, lineHeight: 1.65, margin: 0 }}>{intel?.why ?? interp}</p>
              </div>
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <p style={labelStyle}>Contexto Meridian</p>
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
        title: 'Cluster metabólico',
        tagline: 'Señales lipídicas · glucémicas',
        synthesis: 'Triglicéridos, HDL y marcadores glucémicos forman parte del mismo panorama metabólico. Cuando se mueven juntos, la señal combinada suele tener más peso interpretativo que cualquier marcador aislado — Meridian observa este cluster para identificar consistencia direccional entre lecturas.',
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
        title: 'Transporte de oxígeno',
        tagline: 'Hierro · señales de células rojas',
        synthesis: 'Las reservas de hierro y los marcadores de células rojas están conectados por el mismo sistema de transporte de oxígeno. Cuando ferritina, hemoglobina o marcadores de tamaño celular cambian juntos, el patrón puede conectar con energía, capacidad de recuperación y eficiencia del cuerpo para mantener su suministro de oxígeno.',
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
        title: 'Eje tiroideo',
        tagline: 'TSH · señales tiroideas',
        synthesis: 'TSH y las hormonas tiroideas forman un circuito de retroalimentación conectado. Cuando varios marcadores de este cluster se mueven en la misma dirección, Meridian le da más peso al patrón — un cambio aislado puede significar algo distinto a un movimiento dentro de todo el panorama tiroideo.',
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
        title: 'Señal inflamatoria',
        tagline: 'CRP · marcadores inmunes',
        synthesis: 'Los marcadores inflamatorios e inmunes se están moviendo en conjunto — una combinación que Meridian observa dentro del panorama más amplio de estrés, recuperación y riesgo cardiovascular, no como valores aislados.',
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
        title: 'Balance hormonal',
        tagline: 'Cortisol · señales hormonales sexuales',
        synthesis: 'Cortisol, DHEA-S y testosterona están conectados a través del sistema adrenal y de reserva hormonal. Cuando cambian juntos, el patrón combinado puede reflejar carga de estrés, capacidad de recuperación o balance hormonal — señales que una sola hormona no mostraría con claridad por sí sola.',
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
        title: 'Vía de metilación',
        tagline: 'Vitaminas B · señales de homocisteína',
        synthesis: 'B12, folato y homocisteína operan dentro de la misma vía metabólica. Cuando se mueven en una dirección consistente, el patrón puede reflejar una señal de disponibilidad nutricional — algo que una lectura individual puede pasar por alto si se mira de forma aislada.',
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
        title: 'Función renal',
        tagline: 'Señales de filtración renal',
        synthesis: 'Creatinina, eGFR y BUN son ventanas al mismo sistema de filtración renal. Cuando se mueven en conjunto, el patrón tiene más peso interpretativo que cualquier lectura individual — Meridian observa las tendencias direccionales de este cluster con el tiempo.',
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
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
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
  const [lang] = useMeridianLanguage()
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
            setHistError(lang === 'es' ? 'No se pudo cargar tu línea de tiempo. Inténtalo nuevamente.' : 'Could not load your Timeline. Please try again.')
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
        if (!data.success) { setError(data.error || (lang === 'es' ? 'No se pudo procesar el PDF' : 'Failed to process PDF')); setUploading(false); return }
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
      setHistError(lang === 'es' ? 'No se pudo cargar tu línea de tiempo. Inténtalo nuevamente.' : 'Could not load your Timeline. Please try again.')
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
  // No Watch-guardrail transform needed; new engine only produces Normal/Bajo/Alto/Critical.
  const snapshotBiomarkersDisplay = snapshotBiomarkers
  const totalStateCounts = {
    // New engine: Normal → Optimal bucket; Bajo/Alto → Attention bucket.
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
            {/* Page context label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '20px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.6)', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>
                {lang === 'es' ? 'Señales de biomarcadores' : 'Biomarker Signals'}
              </span>
            </div>
            <h1 style={{
              fontFamily: fonts.heading,
              fontSize: 'clamp(26px, 5vw, 32px)',
              fontWeight: 700,
              color: colors.text,
              marginBottom: '16px',
              lineHeight: 1.2,
            }}>
              {hasRecentLabs ? (lang === 'es' ? 'Laboratorios' : 'Labs') : (lang === 'es' ? 'Subir laboratorios' : 'Upload your labs')}
            </h1>
            <p style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '2px' }}>
              {lang === 'es' ? 'Tus marcadores clínicos.' : 'Your clinical markers.'}
            </p>
            <p style={{ fontSize: '14px', color: colors.textSoft, marginBottom: hasRecentLabs ? '24px' : '20px' }}>
              Traducido en señales biológicas.
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
              {lang === 'es' ? 'Subir laboratorios' : 'Upload your labs'}
            </h1>
            <p style={{ fontSize: '15px', color: colors.textSoft, marginBottom: '20px', lineHeight: 1.6 }}>
              {lang === 'es' ? 'Sube un PDF de tu laboratorio. Meridian extraerá tus biomarcadores automáticamente.' : 'Upload a PDF from your lab provider. Meridian will extract your biomarkers automatically.'}
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
                {lang === 'es' ? 'Revisa los biomarcadores extraídos abajo. Haz clic en confirmar para guardarlos.' : 'Review your extracted biomarkers below. Click confirm to save them.'}
              </p>

              {/* Lab Date */}
              <div style={{
                padding: '16px 20px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
                borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
              }}>
                <div>
                  <span style={{ fontSize: '13px', color: colors.textMuted, display: 'block', marginBottom: '4px' }}>Fecha de muestra — corrige si hace falta</span>
                  <span style={{ fontSize: '15px', color: colors.text, fontWeight: 600 }}>
                    {labDate ? new Date(labDate + 'T12:00:00').toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No detectada'}
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
                                ? (String(b.slug || '').startsWith('urine_') ? 'URINALYSIS' : 'SEROLOGY')
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
                            {lang === 'es' ? 'Clasificación pendiente' : 'Pending Classification'}
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
                const isBajo = level === 'low'
                return (
                  <div style={{
                    padding: '14px 18px',
                    backgroundColor: isBajo ? 'rgba(45,212,191,0.06)' : 'rgba(250,204,21,0.07)',
                    border: `1px solid ${isBajo ? 'rgba(45,212,191,0.25)' : 'rgba(250,204,21,0.28)'}`,
                    borderRadius: '12px',
                    marginBottom: '16px',
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: isBajo ? colors.teal : '#FCD34D', margin: '0 0 5px' }}>
                      {level === 'low' ? 'Same-day lab panel detected'
                        : level === 'high' ? 'Possible duplicate upload'
                        : 'Possible overlap detected'}
                    </p>
                    <p style={{ fontSize: '13px', color: colors.textSoft, margin: `0 0 ${isBajo ? '10px' : '14px'}`, lineHeight: 1.5 }}>
                      {level === 'low'
                        ? 'Some markers from this date may already exist. Meridian can save this PDF and add the new markers to your Lab Snapshot.'
                        : level === 'high'
                        ? 'Most markers in this PDF appear to already exist for this date. Save anyway only if this is a corrected or separate file.'
                        : lang === 'es' ? 'Algunos biomarcadores de esta fecha podrían existir ya. Revisa antes de guardar, o guarda de todos modos si es un panel de laboratorio separado.' : 'Some biomarkers from this date may already exist. Review before saving, or save anyway if this is a separate lab panel.'}
                    </p>
                    {isBajo ? (
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
                          {lang === 'es' ? 'Cancelar' : 'Cancel'}
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
                      ? `${qualCount} qualitative ${qualCount === 1 ? 'result' : 'results'} included — these will be saved alongside your ${quantCount} numeric ${quantCount === 1 ? 'biomarker' : 'biomarkers'}.`
                      : `${qualCount} qualitative ${qualCount === 1 ? 'result' : 'results'} detected — these will be saved to your record.`
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
                    return lang === 'es'
                      ? `Confirmar ${total} ${total === 1 ? 'resultado' : 'resultados'}`
                      : `Confirm ${total} ${total === 1 ? 'result' : 'results'}`
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
                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
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
              Tus biomarcadores confirmados fueron añadidos a tu resumen de laboratorios.{' '}
              <span style={{ color: colors.textMuted }}>
                {lang === 'es' ? 'Sube otro PDF si esta visita de laboratorio incluyó más de un archivo.' : 'Upload another PDF if this lab visit included more than one file.'}
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
                {lang === 'es' ? 'Subir otro PDF' : 'Upload another PDF'}
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
                {lang === 'es' ? 'Ver laboratorios' : 'View Labs'}
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
                {/* Editorial snapshot header */}
                <div style={{ marginBottom: '20px' }}>
                  <p style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    color: colors.textMuted, textTransform: 'uppercase', margin: '0 0 6px',
                  }}>
                    {lang === 'es' ? 'Última toma de laboratorio' : 'Latest lab collection'}
                  </p>
                  <p style={{
                    fontFamily: fonts.heading, fontSize: '26px', fontWeight: 700,
                    color: colors.text, margin: '0 0 5px', lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                  }}>
                    {latestDate ? formatDateLong(latestDate) : '—'}
                  </p>
                  <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0, lineHeight: 1.5 }}>
                    {lang === 'es' ? `${snapshotBiomarkers.length} biomarcadores en ${panelSummaries.length} ${panelSummaries.length === 1 ? 'panel' : 'paneles'}` : `${snapshotBiomarkers.length} biomarkers across ${panelSummaries.length} ${panelSummaries.length === 1 ? 'panel' : 'panels'}`}
                  </p>
                </div>

                {/* View selector */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                  {(['snapshot', 'history'] as const).map((view, i) => {
                    const isActive = labsView === view
                    return (
                      <div key={view} style={{ display: 'flex', alignItems: 'center' }}>
                        {i > 0 && (
                          <span style={{
                            fontSize: '11px', color: colors.textMuted, opacity: 0.35,
                            userSelect: 'none', margin: '0 10px', lineHeight: 1,
                          }}>·</span>
                        )}
                        <button
                          onClick={() => {
                            setLabsView(view)
                            if (view === 'history' && !histFetched) loadHistoryData()
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            borderBottom: isActive
                              ? `1.5px solid ${colors.teal}`
                              : '1.5px solid transparent',
                            padding: '0 0 3px',
                            cursor: 'pointer',
                            fontFamily: fonts.ui,
                            fontSize: '13px',
                            fontWeight: isActive ? 700 : 400,
                            color: isActive ? colors.text : colors.textMuted,
                            letterSpacing: '-0.01em',
                            transition: 'color 0.2s ease, border-color 0.2s ease',
                            outline: 'none',
                            lineHeight: 1.4,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {view === 'snapshot' ? (lang === 'es' ? 'Resumen' : 'Snapshot') : (lang === 'es' ? 'Línea de tiempo' : 'Timeline')}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* ── Connected Insights — primary intelligence layer ── */}
                {!activeFilter && connectedInsights.length > 0 && (
                  <div style={{ marginBottom: '36px', marginTop: '20px' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{
                        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: colors.textMuted, margin: '0 0 8px',
                      }}>
                        Insights conectados
                      </p>
                      <h2 style={{
                        fontFamily: fonts.heading, fontSize: '22px', fontWeight: 700,
                        color: colors.text, margin: 0, lineHeight: 1.25,
                      }}>
                        Lo que tu biología está mostrando
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
                                {insight.severity === 'attention' ? '· patrón detectado' : '· en seguimiento'}
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
                        {lang === 'es' ? `Ver ${connectedInsights.length - 3} ${connectedInsights.length - 3 === 1 ? 'insight más' : 'insights más'}` : `View ${connectedInsights.length - 3} more ${connectedInsights.length - 3 === 1 ? 'insight' : 'insights'}`}
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
                        {lang === 'es' ? 'Señales clave' : 'Key Signals'}
                      </p>
                      <span style={{ fontSize: '11px', color: colors.textMuted, opacity: 0.6 }}>
                        Toca cualquiera para explorar
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
                      {totalStateCounts.Optimal} {lang === 'es' ? 'Normal' : 'Normal'}
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
                      {totalStateCounts.Watch} {lang === 'es' ? 'En seguimiento' : 'Tracking'}
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
                      {totalStateCounts.Attention} {lang === 'es' ? 'Revisar' : 'Review'}
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
                      {totalStateCounts.Critical} {lang === 'es' ? 'Crítico' : 'Critical'}
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
                      {fullClinicalExpanded ? (lang === 'es' ? 'Ocultar datos clínicos completos' : 'Hide full clinical data') : (lang === 'es' ? 'Ver datos clínicos completos' : 'View full clinical data')}
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
                      {lang === 'es' ? ({ Optimal: 'Normales', Watch: 'En seguimiento', Attention: 'Para revisar', Critical: 'Críticos' }[activeFilter ?? ''] ?? activeFilter) : ({ Optimal: 'Normal', Watch: 'Tracking', Attention: 'Review', Critical: 'Critical' }[activeFilter ?? ''] ?? activeFilter)} {lang === 'es' ? 'biomarcadores' : 'Biomarkers'}
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
                        {lang === 'es' ? 'Modo de vista' : 'View Mode'}
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
                          {lang === 'es' ? 'Paneles clínicos' : 'Clinical Panels'}
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
                          {lang === 'es' ? 'Mapa de señales' : 'Signal Map'}
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
                        Marcadores actuales
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
                                    {sc.Critical > 0 && <span style={{ color: '#F87171', fontWeight: 600 }}>{sc.Critical} {lang === 'es' ? 'crítico' : 'critical'}</span>}
                                    {sc.Critical > 0 && (sc.Attention > 0 || sc.Watch > 0) && <span style={{ color: colors.textMuted, opacity: 0.4 }}> · </span>}
                                    {sc.Attention > 0 && <span style={{ color: '#FB923C', fontWeight: 600 }}>{sc.Attention} en revisión</span>}
                                    {sc.Attention > 0 && sc.Watch > 0 && <span style={{ color: colors.textMuted, opacity: 0.4 }}> · </span>}
                                    {sc.Watch > 0 && <span style={{ color: '#FCD34D' }}>{sc.Watch} en seguimiento</span>}
                                    {(sc.Critical > 0 || sc.Attention > 0 || sc.Watch > 0) && sc.Optimal > 0 && <span style={{ color: colors.textMuted, opacity: 0.4 }}> · </span>}
                                    {sc.Optimal > 0 && <span style={{ color: colors.textMuted }}>{sc.Optimal} {lang === 'es' ? 'normal' : 'normal'}</span>}
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
                                    {lang === 'es' ? `Ver ${hiddenOpt} ${hiddenOpt === 1 ? 'marcador normal más' : 'marcadores normales más'}` : `View ${hiddenOpt} more normal ${hiddenOpt === 1 ? 'marker' : 'markers'}`}
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
                    {lang === 'es' ? 'Tus resultados confirmados están guardados en la línea de tiempo.' : 'Your confirmed results are saved in Timeline.'}
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
                  {lang === 'es' ? 'Ver línea de tiempo →' : 'View Timeline →'}
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
                    {lang === 'es' ? 'Línea de tiempo' : 'Timeline'}
                  </p>
                  <p style={{ fontSize: '13px', color: colors.textMuted, margin: '0 0 14px', lineHeight: 1.5 }}>
                    Tus resultados confirmados de laboratorio a través del tiempo.
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
                          {view === 'snapshot' ? (lang === 'es' ? 'Resumen' : 'Snapshot') : (lang === 'es' ? 'Línea de tiempo' : 'Timeline')}
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
                    <p style={{ fontSize: '13px', color: colors.textMuted }}>{lang === 'es' ? 'Sube un PDF de laboratorio para ver tus biomarcadores aquí.' : 'Upload a lab PDF to see your biomarkers here.'}</p>
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
                                  <button onClick={() => setDeleteConfirmDate(null)} style={{ padding: '6px 14px', backgroundColor: 'transparent', border: `1px solid ${colors.cardBorder}`, borderRadius: '7px', color: colors.textMuted, fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>{lang === 'es' ? 'Cancelar' : 'Cancel'}</button>
                                  <button onClick={() => handleDeleteSession(dateGroup.dateKey)} disabled={deleteLoading} style={{ padding: '6px 14px', backgroundColor: 'rgba(248,113,113,0.13)', border: '1px solid rgba(248,113,113,0.38)', borderRadius: '7px', color: '#F87171', fontFamily: fonts.ui, fontSize: '12px', fontWeight: 600, cursor: deleteLoading ? 'not-allowed' : 'pointer', outline: 'none' }}>
                                    {deleteLoading ? (lang === 'es' ? 'Eliminando…' : 'Deleting…') : (lang === 'es' ? 'Eliminar sesión' : 'Delete session')}
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
                    {lang === 'es' ? 'Subir nuevo laboratorio' : 'Upload New Lab'}
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
                        {hasRecentLabs ? (lang === 'es' ? 'Subir otro PDF de laboratorio' : 'Upload another lab PDF') : (lang === 'es' ? 'Elegir archivo PDF' : 'Choose PDF file')}
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
