// Meridian — Panel Reconstruction Engine (Sprint 3)
//
// Canonical panel definitions, deterministic snapshot reconstruction, duplicate
// resolution, and panel integrity scoring for the lab history rendering layer.
//
// Sprint 3 tasks implemented here:
//   T001 — Canonical panel definitions (CANONICAL_PANELS, CanonicalPanelDef)
//   T002 — Panel reconstruction (buildClinicalSnapshot, groupMarkersIntoPanels, reconstructPanel)
//   T003 — Duplicate biomarker resolution (resolveDuplicate, dupScore)
//   T005 — Partial panel detection (panelIntegrityScore, PanelIntegrityResult)
//   T006 — Urinalysis type separation (isUrinalysisQuantitative, isUrinalysisCategorical)
//   T007 — Historical determinism (canonicalMarkerOrder, stable marker_name tiebreaker)
//
// Design constraints:
//   - Pure functions only — no side effects, no React, no async
//   - All sort operations use marker_name as stable secondary key (T007)
//   - No new dependencies outside workspace lib

import { isSaneRange } from './range-resolver'

// ── Minimal biomarker record interface ───────────────────────────────────────
// HistBiomarkerRow in upload/page.tsx satisfies this interface structurally.
// panel-reconstruction does not import from page.tsx; callers pass compatible rows.
export interface BiomarkerRecord {
  id: string
  marker_name: string
  value: number
  unit: string | null
  state: string | null
  reference_range_min: number | null
  reference_range_max: number | null
  collected_at: string
  created_at: string
  flag_error: boolean
}

// ── T001: Canonical panel definitions ────────────────────────────────────────
// Each definition encodes:
//   canonicalOrder — display order within the panel (T007 stable sort key)
//   required       — slugs whose absence makes the panel partial (T005 scoring)
//   optional       — valid panel members that do not affect completeness
export interface CanonicalPanelDef {
  name: string
  canonicalOrder: readonly string[]
  required: readonly string[]
  optional: readonly string[]
}

export const CANONICAL_PANELS: Record<string, CanonicalPanelDef> = {

  CBC: {
    name: 'CBC',
    canonicalOrder: [
      'wbc', 'rbc', 'hemoglobin', 'hematocrit',
      'mcv', 'mch', 'mchc', 'rdw', 'rdw_sd', 'mpv', 'platelets',
      'neutrophils_pct', 'neutrophils_abs',
      'lymphocytes_pct', 'lymphocytes_abs',
      'monocytes_pct', 'monocytes_abs',
      'eosinophils_pct', 'eosinophils_abs',
      'basophils_pct', 'basophils_abs',
      'immature_granulocytes_pct', 'immature_granulocytes_abs',
      'nrbc_pct', 'nrbc_abs',
    ],
    required: [
      'wbc', 'rbc', 'hemoglobin', 'hematocrit',
      'mcv', 'mch', 'mchc', 'rdw', 'platelets',
    ],
    optional: [
      'rdw_sd', 'mpv',
      'neutrophils_pct', 'neutrophils_abs',
      'lymphocytes_pct', 'lymphocytes_abs',
      'monocytes_pct', 'monocytes_abs',
      'eosinophils_pct', 'eosinophils_abs',
      'basophils_pct', 'basophils_abs',
      'immature_granulocytes_pct', 'immature_granulocytes_abs',
      'nrbc_pct', 'nrbc_abs',
    ],
  },

  'Serology / Infectious Disease': {
    name: 'Serology / Infectious Disease',
    canonicalOrder: ['hepatitis_a_igm_ab', 'hepatitis_b_core_igm', 'hepatitis_b_surface_antigen', 'hepatitis_c_ab', 'hiv_1_2_ab', 'rpr_syphilis'],
    required: [],
    optional: ['hepatitis_a_igm_ab', 'hepatitis_b_core_igm', 'hepatitis_b_surface_antigen', 'hepatitis_c_ab', 'hiv_1_2_ab', 'rpr_syphilis'],
  },

  'Pancreatic Enzymes': {
    name: 'Pancreatic Enzymes',
    canonicalOrder: ['amylase', 'lipase'],
    required: [],
    optional: ['amylase', 'lipase'],
  },

  CMP: {
    name: 'CMP',
    canonicalOrder: [
      'glucose_fasting',
      'bun', 'creatinine', 'bun_creatinine_ratio',
      'egfr', 'egfr_non_african_american', 'egfr_african_american',
      'sodium', 'potassium', 'chloride', 'co2', 'anion_gap', 'calcium',
      'total_protein', 'albumin', 'globulin', 'ag_ratio',
      'bilirubin_total', 'ast', 'alt', 'alkaline_phosphatase',
    ],
    required: [
      'glucose_fasting', 'bun', 'creatinine', 'egfr',
      'sodium', 'potassium', 'chloride', 'co2', 'calcium',
      'total_protein', 'albumin', 'bilirubin_total', 'ast', 'alt', 'alkaline_phosphatase',
    ],
    optional: [
      'bun_creatinine_ratio', 'globulin', 'ag_ratio', 'anion_gap',
      'egfr_non_african_american', 'egfr_african_american',
    ],
  },

  'Lipid Panel': {
    name: 'Lipid Panel',
    canonicalOrder: [
      'total_cholesterol', 'hdl', 'ldl', 'vldl', 'non_hdl',
      'triglycerides', 'ldl_hdl_ratio', 'chol_hdl_ratio',
    ],
    required: ['total_cholesterol', 'hdl', 'ldl', 'triglycerides'],
    optional: ['vldl', 'non_hdl', 'ldl_hdl_ratio', 'chol_hdl_ratio'],
  },

  'Glycemic Panel': {
    name: 'Glycemic Panel',
    canonicalOrder: ['hba1c', 'glucose_fasting', 'insulin_fasting'],
    required: ['hba1c'],
    optional: ['glucose_fasting', 'insulin_fasting'],
  },

  'Thyroid Panel': {
    name: 'Thyroid Panel',
    canonicalOrder: ['tsh', 'free_t4', 'free_t3', 'total_t3', 'tpo_antibodies'],
    required: ['tsh'],
    optional: ['free_t4', 'free_t3', 'total_t3', 'tpo_antibodies'],
  },

  'Vitamin & Nutrient Panel': {
    name: 'Vitamin & Nutrient Panel',
    canonicalOrder: ['vitamin_d', 'vitamin_b12', 'folate', 'magnesium', 'ferritin'],
    required: [],
    optional: ['vitamin_d', 'vitamin_b12', 'folate', 'magnesium', 'ferritin'],
  },

  'Iron Panel': {
    name: 'Iron Panel',
    canonicalOrder: ['ferritin'],
    required: ['ferritin'],
    optional: [],
  },

  'Hormone Panel': {
    name: 'Hormone Panel',
    canonicalOrder: ['testosterone_total', 'dhea_s', 'cortisol_am', 'acth'],
    required: [],
    optional: ['testosterone_total', 'dhea_s', 'cortisol_am', 'acth'],
  },

  'Inflammation / Cardiac Risk': {
    name: 'Inflammation / Cardiac Risk',
    canonicalOrder: ['crp_hs', 'homocysteine'],
    required: [],
    optional: ['crp_hs', 'homocysteine'],
  },

  Urinalysis: {
    name: 'Urinalysis',
    canonicalOrder: [
      // Quantitative physical properties (T006: quantitative precedes categorical)
      'urine_specific_gravity', 'urine_ph',
      // Visual / physical qualitative
      'urine_color', 'urine_clarity',
      // Dipstick chemical qualitative
      'urine_glucose_ua', 'urine_protein_ua', 'urine_blood_ua', 'urine_ketones_ua',
      'urine_bilirubin_ua', 'urine_urobilinogen_ua',
      'urine_nitrite_ua', 'urine_leukocyte_esterase_ua',
      // Microscopy
      'urine_wbc_hpf', 'urine_rbc_hpf', 'urine_bacteria_hpf',
      'urine_epithelial_cells_hpf', 'urine_casts_hpf', 'urine_mucus_hpf',
    ],
    required: [],
    optional: [
      'urine_specific_gravity', 'urine_ph',
      'urine_color', 'urine_clarity',
      'urine_glucose_ua', 'urine_protein_ua', 'urine_blood_ua', 'urine_ketones_ua',
      'urine_bilirubin_ua', 'urine_urobilinogen_ua',
      'urine_nitrite_ua', 'urine_leukocyte_esterase_ua',
      'urine_wbc_hpf', 'urine_rbc_hpf', 'urine_bacteria_hpf',
      'urine_epithelial_cells_hpf', 'urine_casts_hpf', 'urine_mucus_hpf',
    ],
  },

}

// ── Panel slug map — source of truth for slug → panel assignment ──────────────
// Matches the naming convention in upload/page.tsx (HIST_SLUG_TO_PANEL).
// histGroupRows imports resolvePanel from here (T004 compliance).
const PANEL_SLUG_MAP: Record<string, string> = {
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
  // CMP (Comprehensive Metabolic Panel)
  glucose_fasting: 'CMP', bun: 'CMP', creatinine: 'CMP', bun_creatinine_ratio: 'CMP',
  egfr: 'CMP', egfr_african_american: 'CMP', egfr_non_african_american: 'CMP',
  ast: 'CMP', alt: 'CMP', alkaline_phosphatase: 'CMP', bilirubin_total: 'CMP',
  albumin: 'CMP', globulin: 'CMP', ag_ratio: 'CMP', total_protein: 'CMP',
  sodium: 'CMP', potassium: 'CMP', chloride: 'CMP', co2: 'CMP',
  calcium: 'CMP', anion_gap: 'CMP',
  // Pancreatic Enzymes
  amylase: 'Pancreatic Enzymes', lipase: 'Pancreatic Enzymes',
  // Lipid Panel
  total_cholesterol: 'Lipid Panel', hdl: 'Lipid Panel', ldl: 'Lipid Panel',
  vldl: 'Lipid Panel', non_hdl: 'Lipid Panel', triglycerides: 'Lipid Panel',
  ldl_hdl_ratio: 'Lipid Panel', chol_hdl_ratio: 'Lipid Panel',
  // Glycemic Panel
  hba1c: 'Glycemic Panel', insulin_fasting: 'Glycemic Panel',
  // Thyroid Panel
  tsh: 'Thyroid Panel', free_t4: 'Thyroid Panel', free_t3: 'Thyroid Panel',
  total_t3: 'Thyroid Panel', tpo_antibodies: 'Thyroid Panel',
  // Vitamin & Nutrient Panel
  vitamin_d: 'Vitamin & Nutrient Panel', vitamin_b12: 'Vitamin & Nutrient Panel',
  folate: 'Vitamin & Nutrient Panel', magnesium: 'Vitamin & Nutrient Panel',
  ferritin: 'Vitamin & Nutrient Panel',
  // Hormone Panel
  testosterone_total: 'Hormone Panel', cortisol_am: 'Hormone Panel',
  dhea_s: 'Hormone Panel', acth: 'Hormone Panel',
  // Inflammation / Cardiac Risk
  crp_hs: 'Inflammation / Cardiac Risk', homocysteine: 'Inflammation / Cardiac Risk',
  // Serology / Infectious Disease
  hepatitis_a_igm_ab: 'Serology / Infectious Disease', hepatitis_b_core_igm: 'Serology / Infectious Disease', hepatitis_b_surface_antigen: 'Serology / Infectious Disease', hepatitis_c_ab: 'Serology / Infectious Disease', hiv_1_2_ab: 'Serology / Infectious Disease', rpr_syphilis: 'Serology / Infectious Disease',
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

// Maps a canonical slug to its panel name.
// Returns 'Other' for unknown slugs (never null, for safe downstream use).
export function resolvePanel(slug: string): string {
  return PANEL_SLUG_MAP[slug] ?? 'Other'
}

// ── Panel display order ───────────────────────────────────────────────────────
// Source of truth for panel sort order in the history view.
// Matches HIST_PANEL_DISPLAY_ORDER in upload/page.tsx for UI consistency.
export const PANEL_DISPLAY_ORDER: readonly string[] = [
  'CBC', 'Lipid Panel', 'CMP', 'Pancreatic Enzymes', 'Glycemic Panel', 'Thyroid Panel',
  'Hormone Panel', 'Vitamin & Nutrient Panel', 'Inflammation / Cardiac Risk',
  'Serology / Infectious Disease', 'Urinalysis', 'Other',
]

export function panelSortIndex(name: string): number {
  const i = PANEL_DISPLAY_ORDER.indexOf(name)
  return i === -1 ? PANEL_DISPLAY_ORDER.length : i
}

// ── T006: Urinalysis type separation ─────────────────────────────────────────
// Quantitative: numeric with clinical reference ranges (pH, specific gravity).
// Categorical: qualitative dipstick / microscopy results (Negative, Trace, etc.).
//
// Categorical markers must NOT enter the BiomarkerRangeBar rendering path.
// The resolveDisplayRange guard in range-resolver.ts already returns null for
// these (normalF/M = {0,0}), but this explicit check prevents future regressions
// and makes the intent self-documenting.
export const URINALYSIS_QUANTITATIVE_SLUGS = new Set<string>([
  'urine_specific_gravity',
  'urine_ph',
])

export const URINALYSIS_CATEGORICAL_SLUGS = new Set<string>([
  'urine_color', 'urine_clarity',
  'urine_glucose_ua', 'urine_protein_ua', 'urine_blood_ua', 'urine_ketones_ua',
  'urine_bilirubin_ua', 'urine_urobilinogen_ua',
  'urine_nitrite_ua', 'urine_leukocyte_esterase_ua',
  'urine_wbc_hpf', 'urine_rbc_hpf', 'urine_bacteria_hpf',
  'urine_epithelial_cells_hpf', 'urine_casts_hpf', 'urine_mucus_hpf',
])

export function isUrinalysisQuantitative(slug: string): boolean {
  return URINALYSIS_QUANTITATIVE_SLUGS.has(slug)
}

export function isUrinalysisCategorical(slug: string): boolean {
  return URINALYSIS_CATEGORICAL_SLUGS.has(slug)
}

// ── T007: Canonical marker ordering ──────────────────────────────────────────
// Sorts rows by the canonical panel order for their panel.
// Markers not in canonicalOrder fall to the end, sorted alphabetically.
// marker_name is always used as a stable secondary sort key so the same input
// set always produces the same order regardless of insertion sequence (T007).
export function canonicalMarkerOrder<T extends Pick<BiomarkerRecord, 'marker_name'>>(
  panelName: string,
  rows: T[]
): T[] {
  const def = CANONICAL_PANELS[panelName]
  if (!def) {
    // Unknown panel — alphabetical sort for determinism
    return [...rows].sort((a, b) => a.marker_name.localeCompare(b.marker_name))
  }
  const idx = new Map<string, number>(def.canonicalOrder.map((s, i) => [s, i]))
  return [...rows].sort((a, b) => {
    const ai = idx.get(a.marker_name) ?? def.canonicalOrder.length
    const bi = idx.get(b.marker_name) ?? def.canonicalOrder.length
    if (ai !== bi) return ai - bi
    return a.marker_name.localeCompare(b.marker_name) // stable tiebreak (T007)
  })
}

// ── T003: Duplicate biomarker resolution ─────────────────────────────────────
// Resolves the canonical representative when multiple rows exist for the same
// (marker_name, collection_date) combination within a snapshot.
//
// Priority scoring (higher score wins):
//   P1 (+8): stored range passes isSaneRange — PDF range is physiologically valid
//   P2 (+4): record is not flagged as erroneous (flag_error = false)
// Tiebreaker: newest created_at ISO string (P3 — latest extraction wins).
// P4 (canonical unit compatibility) is handled implicitly: isSaneRange rejects
// corrupt values that often result from wrong-unit OCR extraction.
function dupScore(row: BiomarkerRecord): number {
  let score = 0
  if (isSaneRange(row.marker_name, row.reference_range_min, row.reference_range_max)) score += 8
  if (!row.flag_error) score += 4
  return score
}

export function resolveDuplicate<T extends BiomarkerRecord>(candidates: T[]): T {
  if (candidates.length === 1) return candidates[0]
  return candidates.reduce((best, row) => {
    const bs = dupScore(best)
    const rs = dupScore(row)
    if (rs > bs) return row
    if (rs === bs && row.created_at > best.created_at) return row // P3: newest wins
    return best
  })
}

// ── T005: Panel integrity score ───────────────────────────────────────────────
// Quantifies how complete a panel is relative to its canonical required markers.
// Exposed as metadata only — NO visual changes required in Sprint 3.
//
// Examples (CBC, 9 required markers):
//   9/9 present → integrityScore: 1.0,  isPartial: false
//   7/9 present → integrityScore: 0.78, isPartial: true
//   4/9 present → integrityScore: 0.44, isPartial: true
export interface PanelIntegrityResult {
  integrityScore: number    // 0.0–1.0 fraction of required markers present
  isPartial: boolean        // true when any required marker is absent
  missingMarkers: string[]  // slugs of required markers not in the snapshot
}

export function panelIntegrityScore(
  presentSlugs: string[],
  panelName: string
): PanelIntegrityResult {
  const def = CANONICAL_PANELS[panelName]
  if (!def || def.required.length === 0) {
    return { integrityScore: 1.0, isPartial: false, missingMarkers: [] }
  }
  const presentSet = new Set(presentSlugs)
  const missingMarkers = def.required.filter(s => !presentSet.has(s))
  const integrityScore = (def.required.length - missingMarkers.length) / def.required.length
  return { integrityScore, isPartial: missingMarkers.length > 0, missingMarkers }
}

// ── T002/T004: Panel reconstruction ──────────────────────────────────────────

// Return type for a fully reconstructed panel within a clinical snapshot.
export interface ReconstructedPanel<T extends BiomarkerRecord> {
  panel: string
  items: T[]
  integrity: PanelIntegrityResult
}

// groupMarkersIntoPanels — T002
// Groups a flat array of biomarker rows into panel buckets using resolvePanel.
// Does NOT deduplicate — call reconstructPanel or buildClinicalSnapshot for that.
export function groupMarkersIntoPanels<T extends BiomarkerRecord>(
  rows: T[]
): Map<string, T[]> {
  const byPanel = new Map<string, T[]>()
  for (const row of rows) {
    const panel = resolvePanel(row.marker_name)
    if (!byPanel.has(panel)) byPanel.set(panel, [])
    byPanel.get(panel)!.push(row)
  }
  return byPanel
}

// reconstructPanel — T002
// Deduplicates and canonically orders all rows for a single panel.
// Safe to call with rows from a single date or across multiple dates (dedup
// by marker_name always keeps the best-scoring representative).
export function reconstructPanel<T extends BiomarkerRecord>(
  panelName: string,
  rows: T[]
): ReconstructedPanel<T> {
  // Group by marker_name, then pick the best candidate per marker (T003)
  const byMarker = new Map<string, T[]>()
  for (const row of rows) {
    if (!byMarker.has(row.marker_name)) byMarker.set(row.marker_name, [])
    byMarker.get(row.marker_name)!.push(row)
  }
  const deduped: T[] = Array.from(byMarker.values()).map(resolveDuplicate)
  // Apply canonical ordering (T007)
  const items = canonicalMarkerOrder(panelName, deduped)
  // Compute integrity metadata (T005)
  const integrity = panelIntegrityScore(items.map(r => r.marker_name), panelName)
  return { panel: panelName, items, integrity }
}

// buildClinicalSnapshot — T002/T004
// Canonical entry point for ALL history rendering paths (T004).
// Takes the flat biomarker rows for a SINGLE collection date.
//
// Returns panels in PANEL_DISPLAY_ORDER, each with:
//   - duplicate-safe merge per marker (T003)
//   - canonical marker ordering within each panel (T007)
//   - panel integrity metadata for future display (T005)
//
// Determinism guarantee (T007): the same set of input rows always produces
// the same output regardless of row insertion order, OCR extraction order,
// or upload order — because grouping uses slug lookup and sorting uses
// stable comparators with marker_name as the tiebreaker.
export function buildClinicalSnapshot<T extends BiomarkerRecord>(
  dateRows: T[]
): ReconstructedPanel<T>[] {
  const byPanel = groupMarkersIntoPanels(dateRows)
  return Array.from(byPanel.entries())
    .map(([panel, rows]) => reconstructPanel(panel, rows))
    .sort((a, b) => panelSortIndex(a.panel) - panelSortIndex(b.panel))
}
