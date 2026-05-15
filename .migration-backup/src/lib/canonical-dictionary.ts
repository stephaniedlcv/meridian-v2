// MERIDIAN — Canonical Biomarker Dictionary v3
// Fixes: LDL/VLDL confusion, added ratios, absolute counts, anion gap
// Improved fuzzy matching with protected terms
// Phase 1 hardening: expanded aliases, TSH/CBC/CMP/Thyroid/Vitamins/HbA1c normalization
//
// ── Future evolution hooks (NOT YET IMPLEMENTED) ─────────────────────────────
// - Alias learning from pending_biomarkers admin review console
// - Admin classification UI for resolving unmatched markers
// - upload_session_id linkage for per-session alias traceability
// - source_pdf_hash for deduplication across identical lab PDFs
// - International lab format support (UK, European, Asian naming conventions)
// - Multilingual alias expansion (Spanish, Portuguese, French, German, Japanese)
// - Confidence scoring per alias match (exact > alias > partial > heuristic)
// - Canonical dictionary version history for audit trails
// ─────────────────────────────────────────────────────────────────────────────

export type RiskProfile = 'linear-high' | 'linear-low' | 'u-shaped' | 'context'

// result_type: distinguishes numeric biomarkers from qualitative clinical tests.
export type ResultType = 'quantitative' | 'qualitative'

// extraction_status: lifecycle state of a single extracted value before it is saved.
//   parsed          — numeric value extracted, validated, and classified successfully
//   unreadable      — value could not be reliably parsed from the source PDF
//   partial         — value extracted but failed plausibility validation
//   qualitative_only — marker is inherently qualitative; no numeric value exists
export type ExtractionStatus = 'parsed' | 'unreadable' | 'partial' | 'qualitative_only'

// marker_category: clinical domain classification for routing and UI grouping.
export type MarkerCategory =
  | 'quantitative'
  | 'qualitative'
  | 'urinalysis'
  | 'infectious_disease'
  | 'pathology'
  | 'microbiology'

// derived_metric_type: classifies computed / ratio markers by domain.
export type DerivedMetricType =
  | 'lipid_ratio'
  | 'insulin_resistance_ratio'
  | 'inflammatory_ratio'
  | 'renal_ratio'
  | 'hepatic_ratio'

// panel_membership: standard clinical panels this marker belongs to.
// A marker may appear in multiple panels (e.g. sodium is in both CMP and BMP).
// Used for panel-level grouping, bulk import, and result context display.
export type PanelType =
  | 'CMP'          // Comprehensive Metabolic Panel
  | 'BMP'          // Basic Metabolic Panel
  | 'CBC'          // Complete Blood Count
  | 'Lipid'        // Lipid Panel
  | 'HbA1c'        // Glycated Hemoglobin
  | 'Thyroid'      // Thyroid Panel
  | 'Urinalysis'   // Urinalysis Panel
  | 'Iron'         // Iron Studies
  | 'Inflammation' // Inflammatory Markers
  | 'Nutrients'    // Vitamin / Mineral Panel
  | 'Hormones'     // Reproductive / Adrenal Hormones
  | 'Coagulation'  // Coagulation Panel
  | 'Infectious'   // Infectious Disease / Serology

// match_confidence: describes how a raw marker name was resolved to a canonical slug.
// Exposed via matchMarkerToSlugWithConfidence() for display and audit purposes.
//   exact    — exact alias lookup after baseline normalization
//   alias    — matched via parenthetical strip, hyphen variant, or abbreviation expansion
//   semantic — matched by semantic pattern detection (e.g. ratio/risk-factor context)
//   fuzzy    — matched by substring inclusion or Jaccard word-set similarity (≥ 0.60)
export type MatchConfidence = 'exact' | 'alias' | 'semantic' | 'fuzzy'
export interface SlugMatch { slug: string; confidence: MatchConfidence }

export interface CanonicalMarker {
  slug: string
  name: string
  unit: string
  aliases: string[]
  system: string
  result_type?: ResultType
  marker_category?: MarkerCategory
  // Classifies this marker as a derived / computed ratio metric.
  derived_metric_type?: DerivedMetricType
  // Standard clinical panels this marker belongs to.
  panel_membership?: PanelType[]
  // Semantic equivalence group — links markers that are clinically interchangeable
  // or measured by different methods but represent the same analyte
  // (e.g. CO2 ↔ Bicarbonate, Total T4 ↔ Free T4 context, etc.).
  marker_equivalence_group?: string
  // Per-marker state mapping for qualitative values.
  qualitative_state_map?: Record<string, 'Optimal' | 'Watch' | 'Attention'>
  riskProfile: RiskProfile
  normalF: { min: number; max: number }
  normalM: { min: number; max: number }
  optimalF: { min: number; max: number }
  optimalM: { min: number; max: number }
  impossibleMin: number
  impossibleMax: number
  priorityWeight: number
}

export const CANONICAL_DICTIONARY: Record<string, CanonicalMarker> = {
  // ===== THYROID =====
  tsh: {
    slug: 'tsh',
    name: 'TSH',
    unit: 'mIU/L',
    panel_membership: ['Thyroid'],
    aliases: [
      'tsh', 'thyrotropin', 't.s.h.', 'serum tsh',
      'thyroid stimulating hormone', 'hormona tiroestimulante', 'tirotropina',
      // 3rd-generation assay variants — parens and commas stripped by normalizer
      'tsh 3rd gen', 'tsh 3rd generation',
      // "Ultra" / "3 Generation Ultra" variants (e.g. "TSH-3 GENERATION ULTRA")
      'tsh ultra',
      'tsh 3 gen ultra', 'tsh-3 gen ultra',
      'tsh 3 generation ultra', 'tsh-3 generation ultra',
      'tsh 3rd generation ultra', 'tsh-3rd generation ultra',
      'tsh third generation ultra',
    ],
    system: 'thyroid',
    riskProfile: 'u-shaped',
    normalF: { min: 0.4, max: 4.0 },
    normalM: { min: 0.4, max: 4.0 },
    optimalF: { min: 0.5, max: 2.5 },
    optimalM: { min: 0.5, max: 2.5 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 5,
  },
  free_t4: {
    slug: 'free_t4',
    name: 'Free T4',
    unit: 'ng/dL',
    panel_membership: ['Thyroid'],
    aliases: ['free t4', 'ft4', 'free thyroxine', 'free thyroxine ft4', 't4 libre', 'tiroxina libre', 't4 free', 'thyroxine free',
      // additional real-world lab report variants
      't4 free thyroxine', 'thyroxine, free', 't4, free', 'free thyroxin', 't4 direct',
    ],
    system: 'thyroid',
    riskProfile: 'u-shaped',
    normalF: { min: 0.8, max: 1.8 },
    normalM: { min: 0.8, max: 1.8 },
    optimalF: { min: 1.0, max: 1.5 },
    optimalM: { min: 1.0, max: 1.5 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 4,
  },
  free_t3: {
    slug: 'free_t3',
    name: 'Free T3',
    unit: 'pg/mL',
    aliases: ['free t3', 'ft3', 'triiodothyronine free', 't3 libre', 'triiodotironina libre', 't3 free',
      // additional real-world lab report variants
      't3, free', 'triiodothyronine, free', 'free triiodothyronine', 't3 free serum', 't3 direct',
    ],
    system: 'thyroid',
    riskProfile: 'u-shaped',
    normalF: { min: 2.0, max: 4.4 },
    normalM: { min: 2.0, max: 4.4 },
    optimalF: { min: 2.8, max: 3.8 },
    optimalM: { min: 2.8, max: 3.8 },
    impossibleMin: 0,
    impossibleMax: 20,
    priorityWeight: 4,
  },
  total_t3: {
    slug: 'total_t3',
    name: 'Total T3',
    unit: 'ng/mL',
    aliases: ['total t3', 't3 total', 'triiodothyronine', 'triiodotironina',
      // additional real-world lab report variants
      't3, total', 'total triiodothyronine', 't3 total serum', 'triiodothyronine total',
    ],
    system: 'thyroid',
    riskProfile: 'u-shaped',
    normalF: { min: 0.6, max: 1.81 },
    normalM: { min: 0.6, max: 1.81 },
    optimalF: { min: 0.8, max: 1.5 },
    optimalM: { min: 0.8, max: 1.5 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 3,
  },
  tpo_antibodies: {
    slug: 'tpo_antibodies',
    name: 'TPO Antibodies',
    unit: 'IU/mL',
    aliases: [
      'tpo antibodies', 'tpo ab', 'anti-tpo', 'anti tpo',
      'thyroid peroxidase antibodies', 'thyroid peroxidase ab', 'thyroid peroxidase antibody',
      'microsomal antibodies tpo', 'microsomal antibodies',
      'anticuerpos microsomales tpo', 'anticuerpos microsomales',
      'anticuerpos tpo', 'anticuerpos anti-tpo',
      'anti-tpo antibodies', 'antithyroperoxidase',
    ],
    system: 'thyroid',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 35 },
    normalM: { min: 0, max: 35 },
    optimalF: { min: 0, max: 9 },
    optimalM: { min: 0, max: 9 },
    impossibleMin: 0,
    impossibleMax: 10000,
    priorityWeight: 3,
  },

  // ===== METABOLIC =====
  hba1c: {
    slug: 'hba1c',
    name: 'Hemoglobin A1c',
    unit: '%',
    panel_membership: ['HbA1c'],
    aliases: [
      'hba1c', 'a1c', 'hemoglobin a1c', 'hb a1c',
      // Glycated / glycosylated variants — same substance, different vendor terminology
      'glycated hemoglobin', 'glycated hb', 'glycated hemoglobin a1c',
      'glycosylated hemoglobin', 'glycosylated hb', 'glycosylated hemoglobin a1c',
      // Hgb abbreviation variants — "Hgb" is vendor-shorthand for "Hemoglobin"
      'hgb a1c', 'glycosylated hgb', 'glycated hgb',
      'total glycosylated hgb a1c', 'total glycosylated hemoglobin a1c',
      'total glycosylated hgb', 'total glycosylated hemoglobin',
      'total glycated hemoglobin', 'total hba1c',
      // Spanish / multilingual
      'hemoglobina glicosilada', 'hemoglobina glucosilada',
      // Misc real-world lab report variants
      'glycohemoglobin', 'glycohaemoglobin',
      'hemoglobin a1c blood', 'a1c blood',
      'hemoglobin a1c level', 'hba1c level',
    ],
    system: 'metabolic',
    riskProfile: 'linear-high',
    normalF: { min: 4.0, max: 5.6 },
    normalM: { min: 4.0, max: 5.6 },
    optimalF: { min: 4.5, max: 5.2 },
    optimalM: { min: 4.5, max: 5.2 },
    impossibleMin: 2,
    impossibleMax: 20,
    priorityWeight: 5,
  },
  glucose_fasting: {
    slug: 'glucose_fasting',
    name: 'Fasting Glucose',
    unit: 'mg/dL',
    aliases: ['glucose', 'glucosa', 'glucose fasting', 'glucosa ayunas', 'blood sugar', 'glicemia', 'glucosa basal', 'fasting glucose', 'fasting blood sugar', 'blood glucose',
      // Phase 1 hardening — serum/plasma variants common on CMP printouts
      'serum glucose', 'glucose serum', 'plasma glucose', 'glucose plasma', 'glucose blood', 'glucose, serum', 'glucose, plasma',
    ],
    system: 'metabolic',
    riskProfile: 'u-shaped',
    normalF: { min: 70, max: 100 },
    normalM: { min: 70, max: 100 },
    optimalF: { min: 75, max: 90 },
    optimalM: { min: 75, max: 90 },
    impossibleMin: 10,
    impossibleMax: 800,
    priorityWeight: 5,
  },
  insulin_fasting: {
    slug: 'insulin_fasting',
    name: 'Fasting Insulin',
    unit: 'µIU/mL',
    aliases: ['insulin', 'insulina', 'fasting insulin', 'insulina ayunas', 'inmunorreactiva', 'serum insulin'],
    system: 'metabolic',
    riskProfile: 'linear-high',
    normalF: { min: 2.0, max: 25.0 },
    normalM: { min: 2.0, max: 25.0 },
    optimalF: { min: 2.5, max: 8.0 },
    optimalM: { min: 2.5, max: 8.0 },
    impossibleMin: 0,
    impossibleMax: 500,
    priorityWeight: 5,
  },

  // ===== CARDIOVASCULAR / LIPIDS =====
  total_cholesterol: {
    slug: 'total_cholesterol',
    name: 'Total Cholesterol',
    unit: 'mg/dL',
    panel_membership: ['Lipid', 'CMP'],
    aliases: [
      'total cholesterol', 'cholesterol total', 'colesterol total', 'cholesterol',
      // Serum / blood variants common on Lipid Panel printouts
      'cholesterol, serum', 'cholesterol serum', 'chol, serum', 'chol serum',
      'total chol', 'total chol serum', 'chol total',
      // Additional real-world spellings
      'cholesterol, total', 'tc', 'total cholesterol, serum',
    ],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 100, max: 200 },
    normalM: { min: 100, max: 200 },
    optimalF: { min: 120, max: 180 },
    optimalM: { min: 120, max: 180 },
    impossibleMin: 30,
    impossibleMax: 600,
    priorityWeight: 3,
  },
  hdl: {
    slug: 'hdl',
    name: 'HDL Cholesterol',
    unit: 'mg/dL',
    panel_membership: ['Lipid'],
    aliases: [
      'hdl', 'hdl chol', 'hdl cholesterol', 'hdl-c', 'hdl-cholesterol',
      'colesterol hdl', 'high density lipoprotein', 'lipoproteina alta densidad',
      // Additional real-world spellings
      'high-density lipoprotein', 'hdl cholesterol serum', 'hdl-c cholesterol',
      'hdl chol serum', 'hdl, direct',
    ],
    system: 'cardiovascular',
    riskProfile: 'linear-low',
    normalF: { min: 50, max: 100 },
    normalM: { min: 40, max: 100 },
    optimalF: { min: 60, max: 90 },
    optimalM: { min: 50, max: 80 },
    impossibleMin: 5,
    impossibleMax: 200,
    priorityWeight: 4,
  },
  ldl: {
    slug: 'ldl',
    name: 'LDL Cholesterol',
    unit: 'mg/dL',
    panel_membership: ['Lipid'],
    aliases: [
      'ldl', 'ldl chol', 'ldl cholesterol', 'ldl-c', 'ldl-cholesterol',
      'colesterol ldl', 'low density lipoprotein', 'lipoproteina baja densidad',
      'ldl calculated', 'ldl calc', 'ldl chol calc',
      // Additional real-world spellings
      'low-density lipoprotein', 'ldl cholesterol serum', 'ldl-c cholesterol',
      'ldl chol serum', 'ldl chol calculated', 'ldl direct',
      // Spelled-out with cholesterol suffix (parenthetical form handled by Step 0.25)
      'low density lipoprotein cholesterol', 'low-density lipoprotein cholesterol',
    ],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 130 },
    normalM: { min: 0, max: 130 },
    optimalF: { min: 0, max: 100 },
    optimalM: { min: 0, max: 100 },
    impossibleMin: 0,
    impossibleMax: 500,
    priorityWeight: 4,
  },
  vldl: {
    slug: 'vldl',
    name: 'VLDL Cholesterol',
    unit: 'mg/dL',
    aliases: ['vldl', 'vldl cholesterol', 'vldl-c', 'vldl calculated', 'vldl calc'],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 5, max: 40 },
    normalM: { min: 5, max: 40 },
    optimalF: { min: 5, max: 25 },
    optimalM: { min: 5, max: 25 },
    impossibleMin: 0,
    impossibleMax: 200,
    priorityWeight: 2,
  },
  non_hdl: {
    slug: 'non_hdl',
    name: 'Non-HDL Cholesterol',
    unit: 'mg/dL',
    aliases: [
      'non-hdl', 'non hdl', 'non hdl c', 'non-hdl c',
      'non-hdl cholesterol', 'non hdl cholesterol',
      'non-hdl calculate', 'non hdl calculate',
      'non-hdl calculated', 'non hdl calculated',
    ],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 160 },
    normalM: { min: 0, max: 160 },
    optimalF: { min: 0, max: 130 },
    optimalM: { min: 0, max: 130 },
    impossibleMin: 0,
    impossibleMax: 500,
    priorityWeight: 3,
  },
  triglycerides: {
    slug: 'triglycerides',
    name: 'Triglycerides',
    unit: 'mg/dL',
    panel_membership: ['Lipid'],
    aliases: [
      'triglycerides', 'trigliceridos', 'trig', 'tg', 'triacylglycerols',
      'triglycerides serum', 'triglyceride', 'trigs', 'tgs',
    ],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 150 },
    normalM: { min: 0, max: 150 },
    optimalF: { min: 40, max: 100 },
    optimalM: { min: 40, max: 100 },
    impossibleMin: 0,
    impossibleMax: 3000,
    priorityWeight: 4,
  },
  ldl_hdl_ratio: {
    slug: 'ldl_hdl_ratio',
    name: 'LDL/HDL Ratio',
    unit: 'ratio',
    derived_metric_type: 'lipid_ratio',
    aliases: [
      // Standard forms
      'ldl/hdl', 'ldl / hdl', 'ldl hdl',
      'ldl/hdl ratio', 'ldl hdl ratio',
      'ldl to hdl ratio',
      'ldl cholesterol / hdl cholesterol',
      // Colon-separator variants (some vendors)
      'ldl:hdl', 'ldl:hdl ratio', 'ldl:hdl cholesterol',
      // Spelled-out variants
      'ldl cholesterol hdl cholesterol ratio',
      'ldl cholesterol to hdl cholesterol ratio',
    ],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 3.5 },
    normalM: { min: 0, max: 3.5 },
    optimalF: { min: 0, max: 2.5 },
    optimalM: { min: 0, max: 2.5 },
    impossibleMin: 0,
    impossibleMax: 20,
    priorityWeight: 2,
  },
  chol_hdl_ratio: {
    slug: 'chol_hdl_ratio',
    name: 'Cholesterol/HDL Ratio',
    unit: 'ratio',
    derived_metric_type: 'lipid_ratio',
    aliases: [
      // Standard forms
      'cholesterol/hdl ratio', 'chol/hdl ratio',
      'total cholesterol/hdl ratio', 'tc/hdl ratio',
      // Slash variants without "ratio" suffix
      'cholesterol/hdl', 'chol/hdl',
      'total cholesterol/hdl', 'tc/hdl',
      'total chol/hdl ratio', 'total chol/hdl',
      // Colon-separator variants (some vendors)
      'chol:hdl', 'chol:hdl ratio', 'tc:hdl', 'tc:hdl ratio',
      'cholesterol:hdl', 'cholesterol:hdl ratio',
      // Space-separated
      'cholesterol hdl ratio', 'cholesterol to hdl ratio',
      'total cholesterol hdl ratio', 'total cholesterol to hdl ratio',
      // ── Vendor-specific / proprietary naming ─────────────────────────────
      // "HDL Risk Factor" — used by Quest, LabCorp variants, and legacy panels.
      // In clinical context this always refers to TC/HDL (Framingham Risk).
      'hdl risk factor',
      // Cardiac / coronary risk naming variants
      'cardiac risk ratio', 'cardiac risk factor',
      'coronary risk ratio', 'coronary risk factor',
      // "Cholesterol Risk Factor" — another common vendor synonym
      'cholesterol risk factor', 'cholesterol risk ratio',
      // Additional TC/HDL spellings found in real-world lab PDFs
      'total chol hdl ratio', 'total chol to hdl ratio',
      'chol hdl ratio', 'chol to hdl ratio',
    ],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 5.0 },
    normalM: { min: 0, max: 5.0 },
    optimalF: { min: 0, max: 3.5 },
    optimalM: { min: 0, max: 3.5 },
    impossibleMin: 0,
    impossibleMax: 20,
    priorityWeight: 2,
  },
  homocysteine: {
    slug: 'homocysteine',
    name: 'Homocysteine',
    unit: 'µmol/L',
    aliases: ['homocysteine', 'homocisteina', 'hcy', 'homocystine'],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 4.0, max: 15.0 },
    normalM: { min: 4.0, max: 15.0 },
    optimalF: { min: 5.0, max: 9.0 },
    optimalM: { min: 5.0, max: 9.0 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 4,
  },

  // ===== LIVER =====
  ast: {
    slug: 'ast',
    name: 'AST',
    unit: 'U/L',
    aliases: ['ast', 'asat', 'sgot', 'aspartato aminotransferasa', 'aspartate aminotransferase',
      // Phase 1 hardening — common CMP printout variants
      'got', 'ast serum', 'ast/sgot', 'aspartate transaminase',
    ],
    system: 'liver',
    riskProfile: 'linear-high',
    normalF: { min: 5, max: 35 },
    normalM: { min: 5, max: 40 },
    optimalF: { min: 10, max: 26 },
    optimalM: { min: 10, max: 30 },
    impossibleMin: 0,
    impossibleMax: 5000,
    priorityWeight: 3,
  },
  alt: {
    slug: 'alt',
    name: 'ALT',
    unit: 'U/L',
    aliases: ['alt', 'alat', 'sgpt', 'alanina aminotransferasa', 'alanine aminotransferase',
      // Phase 1 hardening — common CMP printout variants
      'gpt', 'alt serum', 'alt/sgpt', 'alanine transaminase',
    ],
    system: 'liver',
    riskProfile: 'linear-high',
    normalF: { min: 5, max: 35 },
    normalM: { min: 5, max: 45 },
    optimalF: { min: 7, max: 25 },
    optimalM: { min: 7, max: 30 },
    impossibleMin: 0,
    impossibleMax: 5000,
    priorityWeight: 3,
  },
  alkaline_phosphatase: {
    slug: 'alkaline_phosphatase',
    name: 'Alkaline Phosphatase',
    unit: 'U/L',
    aliases: ['alkaline phosphatase', 'alp', 'alk phos', 'fosfatasa alcalina', 'alkp',
      // Phase 1 hardening — real-world abbreviation variants
      'alk p', 'alkaline phos', 'alk phosphatase', 'alkaline phosphatase serum', 'alp serum',
    ],
    system: 'liver',
    riskProfile: 'u-shaped',
    normalF: { min: 35, max: 105 },
    normalM: { min: 40, max: 130 },
    optimalF: { min: 45, max: 85 },
    optimalM: { min: 50, max: 100 },
    impossibleMin: 0,
    impossibleMax: 2000,
    priorityWeight: 2,
  },
  bilirubin_total: {
    slug: 'bilirubin_total',
    name: 'Total Bilirubin',
    unit: 'mg/dL',
    aliases: ['total bilirubin', 'bilirubin total', 'bilirrubina total', 'bilirubin', 'tbil',
      // Phase 1 hardening — common CMP label variants
      'tbili', 't bili', 'total bili', 'bilirubin, total', 'bilirubin total serum',
    ],
    system: 'liver',
    riskProfile: 'linear-high',
    normalF: { min: 0.1, max: 1.2 },
    normalM: { min: 0.1, max: 1.2 },
    optimalF: { min: 0.2, max: 0.8 },
    optimalM: { min: 0.2, max: 0.8 },
    impossibleMin: 0,
    impossibleMax: 40,
    priorityWeight: 2,
  },
  total_protein: {
    slug: 'total_protein',
    name: 'Total Protein',
    unit: 'g/dL',
    aliases: ['total protein', 'proteina total', 'protein total', 'tp',
      // Phase 1 hardening — CMP printout variants
      'protein serum', 'total protein serum', 'protein, total', 'protein total serum',
    ],
    system: 'liver',
    riskProfile: 'u-shaped',
    normalF: { min: 6.0, max: 8.3 },
    normalM: { min: 6.0, max: 8.3 },
    optimalF: { min: 6.5, max: 7.5 },
    optimalM: { min: 6.5, max: 7.5 },
    impossibleMin: 1,
    impossibleMax: 15,
    priorityWeight: 2,
  },
  albumin: {
    slug: 'albumin',
    name: 'Albumin',
    unit: 'g/dL',
    aliases: ['albumin', 'albumina', 'alb', 'serum albumin',
      // Phase 1 hardening — CMP printout variants
      'albumin blood', 'alb serum', 'albumin serum', 'albumin, serum',
    ],
    system: 'liver',
    riskProfile: 'linear-low',
    normalF: { min: 3.5, max: 5.5 },
    normalM: { min: 3.5, max: 5.5 },
    optimalF: { min: 4.0, max: 5.0 },
    optimalM: { min: 4.0, max: 5.0 },
    impossibleMin: 0,
    impossibleMax: 8,
    priorityWeight: 2,
  },
  globulin: {
    slug: 'globulin',
    name: 'Globulin',
    unit: 'g/dL',
    panel_membership: ['CMP'],
    aliases: [
      'globulin', 'globulina',
      // Common CMP printout variants
      'glob', 'globulin serum', 'globulin calculated', 'globulin calc',
      'globulin, calculated', 'total globulin', 'serum globulin',
    ],
    system: 'liver',
    riskProfile: 'u-shaped',
    normalF: { min: 1.5, max: 4.5 },
    normalM: { min: 1.5, max: 4.5 },
    optimalF: { min: 2.0, max: 3.5 },
    optimalM: { min: 2.0, max: 3.5 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 1,
  },
  ag_ratio: {
    slug: 'ag_ratio',
    name: 'Albumin/Globulin Ratio',
    unit: 'ratio',
    derived_metric_type: 'hepatic_ratio',
    panel_membership: ['CMP'],
    aliases: [
      'albumin/globulin ratio', 'a/g ratio', 'ag ratio', 'a:g ratio',
      // Abbreviated forms used by LabCorp, Quest, and regional labs
      'alb/glob ratio', 'alb/glob', 'alb glob ratio', 'alb glob',
      // Unslashed variants (for Jaccard and substring matching)
      'albumin globulin ratio', 'albumin to globulin ratio',
      'albumin/globulin', 'alb/globulin ratio', 'albumin/glob ratio',
    ],
    system: 'liver',
    riskProfile: 'u-shaped',
    normalF: { min: 1.0, max: 2.5 },
    normalM: { min: 1.0, max: 2.5 },
    optimalF: { min: 1.2, max: 2.0 },
    optimalM: { min: 1.2, max: 2.0 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 1,
  },

  // ===== KIDNEY =====
  egfr: {
    slug: 'egfr',
    name: 'eGFR',
    unit: 'mL/min/1.73 m²',
    aliases: [
      'egfr', 'gfr', 'e-gfr', 'tfg',
      'filtrado glomerular', 'glomerular filtration rate',
      'estimated gfr', 'estimated glomerular filtration rate',
      'gfr ckd-epi', 'egfr ckd-epi',
      // Phase 1 hardening — hyphen-stripped and additional CKD-EPI variants
      'egfr ckd epi', 'gfr ckd epi', 'creatinine based egfr', 'egfr creatinine',
    ],
    system: 'kidney',
    riskProfile: 'linear-low',
    normalF: { min: 90, max: 200 },
    normalM: { min: 90, max: 200 },
    optimalF: { min: 100, max: 150 },
    optimalM: { min: 100, max: 150 },
    impossibleMin: 0,
    impossibleMax: 300,
    priorityWeight: 4,
  },
  egfr_african_american: {
    slug: 'egfr_african_american',
    name: 'eGFR African American',
    unit: 'mL/min/1.73 m²',
    aliases: [
      'gfr afro american', 'gfr afro-american',
      'gfr afro-americans', 'gfr afro americans',
      'gfr african american', 'gfr african-american',
      'egfr afro american', 'egfr afro-american',
      'egfr african american', 'egfr african-american',
      'egfr afro-americans', 'egfr afro americans',
      'gfr if african am', 'egfr if african am',
    ],
    system: 'kidney',
    riskProfile: 'linear-low',
    normalF: { min: 90, max: 200 },
    normalM: { min: 90, max: 200 },
    optimalF: { min: 100, max: 150 },
    optimalM: { min: 100, max: 150 },
    impossibleMin: 0,
    impossibleMax: 300,
    priorityWeight: 3,
  },
  egfr_non_african_american: {
    slug: 'egfr_non_african_american',
    name: 'eGFR Non-African American',
    unit: 'mL/min/1.73 m²',
    aliases: [
      'gfr non afro american', 'gfr non afro-american',
      'gfr non afro-americans', 'gfr non afro americans',
      'gfr non african american', 'gfr non-african american',
      'gfr non african-american', 'gfr non-african-american',
      'egfr non afro american', 'egfr non afro-american',
      'egfr non african american', 'egfr non-african american',
      'egfr non african-american', 'egfr non-african-american',
      'egfr non afro-americans', 'egfr non afro americans',
      'egfr if non-african am', 'egfr if nonafr. am',
      'gfr if non-african am', 'gfr if non african am',
    ],
    system: 'kidney',
    riskProfile: 'linear-low',
    normalF: { min: 90, max: 200 },
    normalM: { min: 90, max: 200 },
    optimalF: { min: 100, max: 150 },
    optimalM: { min: 100, max: 150 },
    impossibleMin: 0,
    impossibleMax: 300,
    priorityWeight: 3,
  },
  creatinine: {
    slug: 'creatinine',
    name: 'Creatinine',
    unit: 'mg/dL',
    aliases: ['creatinine', 'creatinina', 'creat', 's-creatinina', 'serum creatinine',
      // Phase 1 hardening — CMP printout variants
      'creatinine blood', 'creat serum', 'creatinine serum', 'creatinina serica',
    ],
    system: 'kidney',
    riskProfile: 'linear-high',
    normalF: { min: 0.5, max: 1.1 },
    normalM: { min: 0.6, max: 1.2 },
    optimalF: { min: 0.6, max: 0.9 },
    optimalM: { min: 0.7, max: 1.0 },
    impossibleMin: 0,
    impossibleMax: 30,
    priorityWeight: 3,
  },
  bun: {
    slug: 'bun',
    name: 'BUN',
    unit: 'mg/dL',
    panel_membership: ['CMP', 'BMP'],
    aliases: [
      'bun', 'blood urea nitrogen', 'urea nitrogen', 'urea', 'nitrogeno ureico',
      // CMP printout variants
      'bun serum', 'urea nitrogen serum', 'bun blood', 'urea nitrogen blood',
      // Serum-qualified forms
      'serum urea nitrogen', 'serum bun', 'urea nitrogen, serum',
      // UK clinical terminology
      'urea', 'blood urea',
    ],
    system: 'kidney',
    riskProfile: 'u-shaped',
    normalF: { min: 6, max: 20 },
    normalM: { min: 7, max: 20 },
    optimalF: { min: 8, max: 16 },
    optimalM: { min: 9, max: 18 },
    impossibleMin: 0,
    impossibleMax: 200,
    priorityWeight: 2,
  },
  bun_creatinine_ratio: {
    slug: 'bun_creatinine_ratio',
    name: 'BUN/Creatinine Ratio',
    unit: 'ratio',
    derived_metric_type: 'renal_ratio',
    aliases: ['bun/creatinine ratio', 'bun creatinine ratio', 'bun/creat ratio'],
    system: 'kidney',
    riskProfile: 'u-shaped',
    normalF: { min: 10, max: 20 },
    normalM: { min: 10, max: 20 },
    optimalF: { min: 12, max: 18 },
    optimalM: { min: 12, max: 18 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 1,
  },

  // ===== ELECTROLYTES =====
  sodium: {
    slug: 'sodium',
    name: 'Sodium',
    unit: 'mmol/L',
    aliases: ['sodium', 'sodio', 'na+', 'serum sodium',
      // Phase 1 hardening — electrolyte shorthand and CMP printout variants
      'na', 'sodium serum', 'sodium blood', 'na serum',
    ],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 136, max: 145 },
    normalM: { min: 136, max: 145 },
    optimalF: { min: 138, max: 142 },
    optimalM: { min: 138, max: 142 },
    impossibleMin: 100,
    impossibleMax: 180,
    priorityWeight: 3,
  },
  potassium: {
    slug: 'potassium',
    name: 'Potassium',
    unit: 'mmol/L',
    aliases: ['potassium', 'potasio', 'k+', 'serum potassium',
      // Phase 1 hardening — electrolyte shorthand and CMP printout variants
      'k', 'potassium serum', 'potassium blood', 'k serum',
    ],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 3.5, max: 5.0 },
    normalM: { min: 3.5, max: 5.0 },
    optimalF: { min: 3.8, max: 4.5 },
    optimalM: { min: 3.8, max: 4.5 },
    impossibleMin: 1,
    impossibleMax: 10,
    priorityWeight: 3,
  },
  chloride: {
    slug: 'chloride',
    name: 'Chloride',
    unit: 'mmol/L',
    aliases: ['chloride', 'cloruro', 'cl-', 'serum chloride',
      // Phase 1 hardening — electrolyte shorthand and CMP printout variants
      'cl', 'chloride serum', 'chloride blood', 'cl serum',
    ],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 98, max: 106 },
    normalM: { min: 98, max: 106 },
    optimalF: { min: 100, max: 104 },
    optimalM: { min: 100, max: 104 },
    impossibleMin: 70,
    impossibleMax: 140,
    priorityWeight: 2,
  },
  co2: {
    slug: 'co2',
    name: 'CO2 (Bicarbonate)',
    unit: 'mmol/L',
    panel_membership: ['CMP', 'BMP'],
    marker_equivalence_group: 'co2_bicarbonate',
    aliases: [
      'co2', 'carbon dioxide', 'carbon dioxide total', 'bicarbonate', 'hco3', 'co2 total', 'total co2',
      // Phase 1 hardening — common shorthand seen on CMP printouts
      'bicarb', 'co2 serum', 'co2, bicarbonate', 'co2 bicarbonate', 'carbon dioxide serum',
      // Additional serum / total variants (parenthetical form handled by Step 0.25)
      'serum bicarbonate', 'serum co2', 'bicarbonate serum', 'hco3 serum',
      'co2/bicarbonate', 'co2 bicarbonate serum', 'total bicarbonate',
    ],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 20, max: 29 },
    normalM: { min: 20, max: 29 },
    optimalF: { min: 22, max: 27 },
    optimalM: { min: 22, max: 27 },
    impossibleMin: 5,
    impossibleMax: 50,
    priorityWeight: 2,
  },
  calcium: {
    slug: 'calcium',
    name: 'Calcium',
    unit: 'mg/dL',
    aliases: ['calcium', 'calcio', 'serum calcium', 'total calcium',
      // Phase 1 hardening — electrolyte shorthand and CMP printout variants
      'ca', 'calcium blood', 'ca serum', 'calcium, total', 'calcium serum',
    ],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 8.5, max: 10.5 },
    normalM: { min: 8.5, max: 10.5 },
    optimalF: { min: 9.0, max: 10.0 },
    optimalM: { min: 9.0, max: 10.0 },
    impossibleMin: 4,
    impossibleMax: 18,
    priorityWeight: 3,
  },
  anion_gap: {
    slug: 'anion_gap',
    name: 'Anion Gap',
    unit: 'mEq/L',
    panel_membership: ['CMP', 'BMP'],
    aliases: [
      'anion gap', 'agap', 'ag',
      'anion gap serum', 'anion gap calculated', 'anion gap calc',
      'anion gap, serum', 'anion gap mEq/L',
    ],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 3, max: 18 },
    normalM: { min: 3, max: 18 },
    optimalF: { min: 6, max: 14 },
    optimalM: { min: 6, max: 14 },
    impossibleMin: 0,
    impossibleMax: 50,
    priorityWeight: 2,
  },

  // ===== IRON =====
  ferritin: {
    slug: 'ferritin',
    name: 'Ferritin',
    unit: 'ng/mL',
    panel_membership: ['Iron'],
    aliases: [
      'ferritin', 'ferritina', 'fer', 's-ferritine', 'serum ferritin',
      'ferritin serum', 'ferritin blood', 'ferritin, serum',
    ],
    system: 'iron',
    riskProfile: 'u-shaped',
    normalF: { min: 12, max: 150 },
    normalM: { min: 30, max: 400 },
    optimalF: { min: 50, max: 120 },
    optimalM: { min: 75, max: 200 },
    impossibleMin: 0,
    impossibleMax: 5000,
    priorityWeight: 5,
  },

  // ===== INFLAMMATION =====
  crp_hs: {
    slug: 'crp_hs',
    name: 'hs-CRP',
    unit: 'mg/L',
    panel_membership: ['Inflammation'],
    aliases: [
      'crp', 'hs-crp', 'crp-hs', 'pcr', 'pcr-us', 'c reactive protein',
      'proteina c reactiva', 'high sensitivity crp', 'c-reactive protein',
      // Additional real-world naming variants
      'hs crp', 'crp high sensitivity', 'high sensitivity c reactive protein',
      'high sensitivity c-reactive protein', 'hsCRP', 'hscrp',
      'crp cardiac', 'cardiac crp', 'c-reactive protein high sensitivity',
      'crp, high sensitivity', 'c reactive protein high sensitivity',
    ],
    system: 'inflammation',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 3.0 },
    normalM: { min: 0, max: 3.0 },
    optimalF: { min: 0, max: 1.0 },
    optimalM: { min: 0, max: 1.0 },
    impossibleMin: 0,
    impossibleMax: 300,
    priorityWeight: 5,
  },

  // ===== NUTRIENTS =====
  vitamin_d: {
    slug: 'vitamin_d',
    name: 'Vitamin D',
    unit: 'ng/mL',
    aliases: ['vitamin d', 'vitamina d', '25-oh vitamin d', '25-hydroxyvitamin d', 'calcidiol', 'vit d3', '25-oh vitamina d', 'cholecalciferol', 'vitamin d 25-hydroxy', 'vitamin d 25-oh',
      // Phase 1 hardening — common abbreviated and alternate spellings
      'vit d', 'vitamin d3', '25 oh vitamin d', '25 hydroxyvitamin d', '25-hydroxy vitamin d',
      'vitamin d total', 'calcifediol', 'vitamin d 25 oh', 'd3 25-oh', '25(oh)vitamin d',
    ],
    system: 'nutrients',
    riskProfile: 'linear-low',
    normalF: { min: 30, max: 100 },
    normalM: { min: 30, max: 100 },
    optimalF: { min: 50, max: 80 },
    optimalM: { min: 50, max: 80 },
    impossibleMin: 0,
    impossibleMax: 300,
    priorityWeight: 4,
  },
  vitamin_b12: {
    slug: 'vitamin_b12',
    name: 'Vitamin B12',
    unit: 'pg/mL',
    aliases: ['vitamin b12', 'vitamina b12', 'b12', 'cobalamin', 'cyanocobalamin', 'cobalamina', 'vitamin b-12', 'b-12', 'vit b12', 'vit b-12',
      // Phase 1 hardening — methylcobalamin form and spacing variants
      'methylcobalamin', 'vitamin b 12', 'vit b 12', 'b12 serum', 'cobalamin serum',
    ],
    system: 'nutrients',
    riskProfile: 'linear-low',
    normalF: { min: 200, max: 900 },
    normalM: { min: 200, max: 900 },
    optimalF: { min: 500, max: 800 },
    optimalM: { min: 500, max: 800 },
    impossibleMin: 0,
    impossibleMax: 5000,
    priorityWeight: 3,
  },
  folate: {
    slug: 'folate',
    name: 'Folate',
    unit: 'ng/mL',
    panel_membership: ['Nutrients'],
    aliases: [
      'folate', 'folic acid', 'acido folico', 'folato',
      'folate serum', 'serum folate', 'folic acid serum',
      'folate, serum', 'folate rbc', 'red blood cell folate',
      'vitamin b9', 'vit b9',
    ],
    system: 'nutrients',
    riskProfile: 'linear-low',
    normalF: { min: 3.0, max: 20.0 },
    normalM: { min: 3.0, max: 20.0 },
    optimalF: { min: 10.0, max: 20.0 },
    optimalM: { min: 10.0, max: 20.0 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 3,
  },
  magnesium: {
    slug: 'magnesium',
    name: 'Magnesium',
    unit: 'mg/dL',
    panel_membership: ['Nutrients'],
    aliases: [
      'magnesium', 'magnesio', 'magnesio serico', 'serum magnesium',
      'magnesium serum', 'mg serum', 'magnesium, serum',
      'mg2+', 'mg blood', 'magnesium blood',
    ],
    system: 'nutrients',
    riskProfile: 'linear-low',
    normalF: { min: 1.7, max: 2.2 },
    normalM: { min: 1.7, max: 2.2 },
    optimalF: { min: 2.0, max: 2.2 },
    optimalM: { min: 2.0, max: 2.2 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 3,
  },

  // ===== ADRENAL =====
  cortisol_am: {
    slug: 'cortisol_am',
    name: 'Cortisol AM',
    unit: 'µg/dL',
    aliases: ['cortisol', 'cortisol am', 'cortisol matutino', 's-cortisol', 'morning cortisol', 'serum cortisol'],
    system: 'adrenal',
    riskProfile: 'u-shaped',
    normalF: { min: 6.0, max: 18.0 },
    normalM: { min: 6.0, max: 18.0 },
    optimalF: { min: 8.0, max: 15.0 },
    optimalM: { min: 8.0, max: 15.0 },
    impossibleMin: 0,
    impossibleMax: 80,
    priorityWeight: 4,
  },
  dhea_s: {
    slug: 'dhea_s',
    name: 'DHEA-S',
    unit: 'µg/dL',
    aliases: ['dhea-s', 'dhea sulfate', 'dheas', 'dehidroepiandrosterona', 'dhea'],
    system: 'adrenal',
    riskProfile: 'linear-low',
    normalF: { min: 35, max: 430 },
    normalM: { min: 80, max: 560 },
    optimalF: { min: 150, max: 350 },
    optimalM: { min: 250, max: 450 },
    impossibleMin: 0,
    impossibleMax: 1500,
    priorityWeight: 3,
  },
  acth: {
    slug: 'acth',
    name: 'ACTH',
    unit: 'pg/mL',
    aliases: [
      'acth', 'plasma acth', 'serum acth',
      'adrenocorticotropic hormone', 'adrenocorticotropic hormone acth',
      'adrenocorticotropin', 'corticotropin',
      'adrenocorticotropina', 'hormona adrenocorticotropica',
    ],
    system: 'adrenal',
    riskProfile: 'u-shaped',
    normalF: { min: 0, max: 46 },
    normalM: { min: 0, max: 46 },
    optimalF: { min: 7, max: 38 },
    optimalM: { min: 7, max: 38 },
    impossibleMin: 0,
    impossibleMax: 1000,
    priorityWeight: 3,
  },

  // ===== HORMONES =====
  testosterone_total: {
    slug: 'testosterone_total',
    name: 'Total Testosterone',
    unit: 'ng/dL',
    aliases: ['testosterone', 'testosterona', 'testosterone total', 'testosterona total', 'total testosterone'],
    system: 'hormones',
    riskProfile: 'linear-low',
    normalF: { min: 8, max: 60 },
    normalM: { min: 264, max: 916 },
    optimalF: { min: 20, max: 50 },
    optimalM: { min: 500, max: 800 },
    impossibleMin: 0,
    impossibleMax: 3000,
    priorityWeight: 4,
  },

  // ===== BLOOD / CBC =====
  hemoglobin: {
    slug: 'hemoglobin',
    name: 'Hemoglobin',
    unit: 'g/dL',
    panel_membership: ['CBC'],
    aliases: ['hemoglobin', 'hemoglobina', 'hgb', 'hb',
      // Phase 1 hardening — UK spelling and blood qualifier variants
      'haemoglobin', 'haemoglobina', 'hemoglobin blood',
    ],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 12.0, max: 16.0 },
    normalM: { min: 13.5, max: 17.5 },
    optimalF: { min: 13.0, max: 15.0 },
    optimalM: { min: 14.5, max: 16.5 },
    impossibleMin: 2,
    impossibleMax: 25,
    priorityWeight: 4,
  },
  hematocrit: {
    slug: 'hematocrit',
    name: 'Hematocrit',
    unit: '%',
    panel_membership: ['CBC'],
    aliases: ['hematocrit', 'hematocrito', 'hct',
      // Phase 1 hardening — UK spelling and packed-cell volume equivalents
      'haematocrit', 'pcv', 'packed cell volume',
    ],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 36, max: 46 },
    normalM: { min: 38, max: 50 },
    optimalF: { min: 38, max: 44 },
    optimalM: { min: 40, max: 48 },
    impossibleMin: 10,
    impossibleMax: 70,
    priorityWeight: 3,
  },
  rbc: {
    slug: 'rbc',
    name: 'Red Blood Cells',
    unit: 'M/µL',
    aliases: ['rbc', 'red blood cells', 'red blood cell count', 'eritrocitos', 'globulos rojos',
      // Phase 1 hardening — alternate clinical terms
      'red cell count', 'erythrocytes', 'erythrocyte count',
    ],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 3.9, max: 5.0 },
    normalM: { min: 4.3, max: 5.7 },
    optimalF: { min: 4.1, max: 4.8 },
    optimalM: { min: 4.5, max: 5.3 },
    impossibleMin: 1,
    impossibleMax: 10,
    priorityWeight: 3,
  },
  mcv: {
    slug: 'mcv',
    name: 'MCV',
    unit: 'fL',
    aliases: ['mcv', 'mean corpuscular volume',
      // Phase 1 hardening — "cell" vs "corpuscular" clinical synonym
      'mean cell volume', 'mcv blood',
    ],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 80, max: 100 },
    normalM: { min: 80, max: 100 },
    optimalF: { min: 82, max: 95 },
    optimalM: { min: 82, max: 95 },
    impossibleMin: 40,
    impossibleMax: 150,
    priorityWeight: 2,
  },
  mch: {
    slug: 'mch',
    name: 'MCH',
    unit: 'pg',
    aliases: ['mch', 'mean corpuscular hemoglobin',
      // Phase 1 hardening
      'mean cell hemoglobin',
    ],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 27, max: 33 },
    normalM: { min: 27, max: 33 },
    optimalF: { min: 28, max: 32 },
    optimalM: { min: 28, max: 32 },
    impossibleMin: 10,
    impossibleMax: 50,
    priorityWeight: 1,
  },
  mchc: {
    slug: 'mchc',
    name: 'MCHC',
    unit: 'g/dL',
    aliases: ['mchc', 'mean corpuscular hemoglobin concentration',
      // Phase 1 hardening
      'mean cell hemoglobin concentration',
    ],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 31, max: 37 },
    normalM: { min: 31, max: 37 },
    optimalF: { min: 33, max: 36 },
    optimalM: { min: 33, max: 36 },
    impossibleMin: 20,
    impossibleMax: 45,
    priorityWeight: 1,
  },
  rdw: {
    slug: 'rdw',
    name: 'RDW',
    unit: '%',
    aliases: ['rdw', 'red cell distribution width', 'rdw-cv',
      // Phase 1 hardening — SD variant and whitespace-normalized forms
      'rdw-sd', 'rdw sd', 'rdw cv', 'red blood cell distribution width',
    ],
    system: 'blood',
    riskProfile: 'linear-high',
    normalF: { min: 11.5, max: 14.5 },
    normalM: { min: 11.5, max: 14.5 },
    optimalF: { min: 11.5, max: 13.0 },
    optimalM: { min: 11.5, max: 13.0 },
    impossibleMin: 5,
    impossibleMax: 30,
    priorityWeight: 2,
  },
  mpv: {
    slug: 'mpv',
    name: 'MPV',
    unit: 'fL',
    aliases: ['mpv', 'mean platelet volume',
      // Phase 1 hardening — abbreviated forms seen on CBC printouts
      'mean platelet vol', 'platelet vol', 'platelet volume',
    ],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 7.5, max: 11.5 },
    normalM: { min: 7.5, max: 11.5 },
    optimalF: { min: 8.0, max: 10.5 },
    optimalM: { min: 8.0, max: 10.5 },
    impossibleMin: 3,
    impossibleMax: 20,
    priorityWeight: 1,
  },
  platelets: {
    slug: 'platelets',
    name: 'Platelets',
    unit: 'K/µL',
    panel_membership: ['CBC'],
    aliases: ['platelets', 'plaquetas', 'platelet count', 'trombocitos', 'plt',
      // Phase 1 hardening — common abbreviations and unit-qualified labels
      'plts', 'platelet', 'thrombocytes', 'platelet #', 'plt count', 'blood platelets',
    ],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 150, max: 400 },
    normalM: { min: 150, max: 400 },
    optimalF: { min: 200, max: 350 },
    optimalM: { min: 200, max: 350 },
    impossibleMin: 10,
    impossibleMax: 1500,
    priorityWeight: 3,
  },

  // ===== IMMUNE / WBC =====
  wbc: {
    slug: 'wbc',
    name: 'White Blood Cells',
    unit: 'K/µL',
    panel_membership: ['CBC'],
    aliases: ['wbc', 'white blood cells', 'leucocitos', 'globulos blancos', 'white blood cell count',
      // Phase 1 hardening — clinical synonym variants
      'white cell count', 'leukocytes', 'leukocyte count', 'total wbc',
    ],
    system: 'immune',
    riskProfile: 'u-shaped',
    normalF: { min: 4.5, max: 11.0 },
    normalM: { min: 4.5, max: 11.0 },
    optimalF: { min: 5.0, max: 8.0 },
    optimalM: { min: 5.0, max: 8.0 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 3,
  },
  neutrophils_pct: {
    slug: 'neutrophils_pct',
    name: 'Neutrophils %',
    unit: '%',
    aliases: ['neutrophils', 'neutrophils %', 'neut %', 'neutrofilos'],
    system: 'immune',
    riskProfile: 'u-shaped',
    normalF: { min: 40, max: 70 },
    normalM: { min: 40, max: 70 },
    optimalF: { min: 45, max: 65 },
    optimalM: { min: 45, max: 65 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 2,
  },
  neutrophils_abs: {
    slug: 'neutrophils_abs',
    name: 'Neutrophils #',
    unit: 'K/µL',
    aliases: ['neutrophils #', 'neutrophils abs', 'absolute neutrophils', 'neut #', 'neut abs', 'abs neutrophils'],
    system: 'immune',
    riskProfile: 'u-shaped',
    normalF: { min: 1.8, max: 7.7 },
    normalM: { min: 1.8, max: 7.7 },
    optimalF: { min: 2.0, max: 6.0 },
    optimalM: { min: 2.0, max: 6.0 },
    impossibleMin: 0,
    impossibleMax: 50,
    priorityWeight: 2,
  },
  lymphocytes_pct: {
    slug: 'lymphocytes_pct',
    name: 'Lymphocytes %',
    unit: '%',
    aliases: ['lymphocytes', 'lymphocytes %', 'lymph %', 'linfocitos'],
    system: 'immune',
    riskProfile: 'u-shaped',
    normalF: { min: 20, max: 40 },
    normalM: { min: 20, max: 40 },
    optimalF: { min: 25, max: 35 },
    optimalM: { min: 25, max: 35 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 2,
  },
  lymphocytes_abs: {
    slug: 'lymphocytes_abs',
    name: 'Lymphocytes #',
    unit: 'K/µL',
    aliases: ['lymphocytes #', 'lymphocytes abs', 'absolute lymphocytes', 'lymph #', 'lymph abs', 'abs lymphocytes'],
    system: 'immune',
    riskProfile: 'u-shaped',
    normalF: { min: 1.0, max: 4.8 },
    normalM: { min: 1.0, max: 4.8 },
    optimalF: { min: 1.5, max: 3.5 },
    optimalM: { min: 1.5, max: 3.5 },
    impossibleMin: 0,
    impossibleMax: 30,
    priorityWeight: 2,
  },
  monocytes_pct: {
    slug: 'monocytes_pct',
    name: 'Monocytes %',
    unit: '%',
    aliases: ['monocytes', 'monocytes %', 'mono %', 'monocitos'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 2, max: 8 },
    normalM: { min: 2, max: 8 },
    optimalF: { min: 3, max: 7 },
    optimalM: { min: 3, max: 7 },
    impossibleMin: 0,
    impossibleMax: 50,
    priorityWeight: 1,
  },
  monocytes_abs: {
    slug: 'monocytes_abs',
    name: 'Monocytes #',
    unit: 'K/µL',
    aliases: ['monocytes #', 'monocytes abs', 'absolute monocytes', 'mono #', 'mono abs', 'abs monocytes'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 0.1, max: 1.0 },
    normalM: { min: 0.1, max: 1.0 },
    optimalF: { min: 0.2, max: 0.8 },
    optimalM: { min: 0.2, max: 0.8 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 1,
  },
  eosinophils_pct: {
    slug: 'eosinophils_pct',
    name: 'Eosinophils %',
    unit: '%',
    aliases: ['eosinophils', 'eosinophils %', 'eos %', 'eosinofilos'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 5 },
    normalM: { min: 0, max: 5 },
    optimalF: { min: 1, max: 4 },
    optimalM: { min: 1, max: 4 },
    impossibleMin: 0,
    impossibleMax: 30,
    priorityWeight: 1,
  },
  eosinophils_abs: {
    slug: 'eosinophils_abs',
    name: 'Eosinophils #',
    unit: 'K/µL',
    aliases: ['eosinophils #', 'eosinophils abs', 'absolute eosinophils', 'eos #', 'eos abs', 'abs eosinophils'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 0.5 },
    normalM: { min: 0, max: 0.5 },
    optimalF: { min: 0.02, max: 0.3 },
    optimalM: { min: 0.02, max: 0.3 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 1,
  },
  basophils_pct: {
    slug: 'basophils_pct',
    name: 'Basophils %',
    unit: '%',
    aliases: ['basophils', 'basophils %', 'baso %', 'basofilos'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 1 },
    normalM: { min: 0, max: 1 },
    optimalF: { min: 0, max: 0.5 },
    optimalM: { min: 0, max: 0.5 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 1,
  },
  basophils_abs: {
    slug: 'basophils_abs',
    name: 'Basophils #',
    unit: 'K/µL',
    aliases: ['basophils #', 'basophils abs', 'absolute basophils', 'baso #', 'baso abs', 'abs basophils'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 0.2 },
    normalM: { min: 0, max: 0.2 },
    optimalF: { min: 0, max: 0.1 },
    optimalM: { min: 0, max: 0.1 },
    impossibleMin: 0,
    impossibleMax: 5,
    priorityWeight: 1,
  },
  immature_granulocytes_pct: {
    slug: 'immature_granulocytes_pct',
    name: 'Immature Granulocytes %',
    unit: '%',
    aliases: ['immature granulocytes', 'immature granulocytes %', 'ig %', 'immature gran %'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 1 },
    normalM: { min: 0, max: 1 },
    optimalF: { min: 0, max: 0.5 },
    optimalM: { min: 0, max: 0.5 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 1,
  },
  immature_granulocytes_abs: {
    slug: 'immature_granulocytes_abs',
    name: 'Immature Granulocytes #',
    unit: 'K/µL',
    aliases: ['immature granulocytes #', 'immature granulocytes abs', 'ig #', 'immature gran #'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 0.1 },
    normalM: { min: 0, max: 0.1 },
    optimalF: { min: 0, max: 0.05 },
    optimalM: { min: 0, max: 0.05 },
    impossibleMin: 0,
    impossibleMax: 5,
    priorityWeight: 1,
  },

  // ===== INFECTIOUS DISEASE / SEROLOGY (qualitative) =====
  // result_type: 'qualitative' — values are REACTIVE/NON REACTIVE/POSITIVE/NEGATIVE/etc.
  // Numeric range fields are unused placeholders required by the shared interface.
  // These markers are displayed with a result badge; they are NOT saved to biomarkers_static.

  hepatitis_a_igm_ab: {
    slug: 'hepatitis_a_igm_ab',
    name: 'Hepatitis A IgM Antibody',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'infectious_disease',
    aliases: [
      'hepatitis a igm ab', 'hav igm', 'hav igm ab',
      'hepatitis a igm antibody', 'hep a igm', 'hep a igm ab',
      'anti hav igm', 'hepatitis a virus igm antibody',
      'hepatitis a ab igm', 'hepatitis a ab', 'hep a ab',
      'hepatitis a total ab', 'hav ab',
    ],
    system: 'infectious',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 3,
  },

  hepatitis_b_core_igm: {
    slug: 'hepatitis_b_core_igm',
    name: 'Hepatitis B Core IgM',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'infectious_disease',
    aliases: [
      'hepatitis b core igm', 'hbcab igm', 'hbc igm',
      'hepatitis b core igm ab', 'anti hbc igm',
      'hepatitis b core antibody igm', 'hep b core igm',
      'hepatitis b core ab igm', 'hbv core igm',
      'hep b core ab', 'hbcab', 'anti hbc',
    ],
    system: 'infectious',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 3,
  },

  hepatitis_b_surface_antigen: {
    slug: 'hepatitis_b_surface_antigen',
    name: 'Hepatitis B Surface Antigen',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'infectious_disease',
    aliases: [
      'hepatitis bs antigen', 'hepatitis b surface antigen', 'hbsag',
      'hbs ag', 'hbv surface antigen', 'hep b surface antigen',
      'hep bs antigen', 'hepatitis b surface ag', 'hbv ag',
      'hepatitis b antigen', 'hepatitis b ag',
    ],
    system: 'infectious',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 3,
  },

  hepatitis_c_ab: {
    slug: 'hepatitis_c_ab',
    name: 'Hepatitis C Antibody',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'infectious_disease',
    aliases: [
      'hep c ab igg/igm', 'hep c ab igg igm', 'hepatitis c antibody',
      'hcv ab', 'hep c ab', 'anti hcv', 'hcv antibody',
      'hepatitis c ab', 'hep c antibody',
      'hepatitis c virus antibody', 'hcv ab igg igm',
      'hepatitis c igg igm', 'hep c igg igm', 'hcv screen',
    ],
    system: 'infectious',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 3,
  },

  hiv_1_2_ab: {
    slug: 'hiv_1_2_ab',
    name: 'HIV-1/2 Antibody',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'infectious_disease',
    aliases: [
      'hiv 1 2 ab', 'hiv antibody', 'hiv ab',
      'hiv 1 2 antibody', 'hiv 1/2 ab', 'anti hiv',
      'hiv 1/2 antibody', 'hiv screen',
      'hiv 1 and 2 antibody', 'hiv ab screen',
      'hiv 4th gen', 'hiv ag ab', 'hiv antigen antibody',
    ],
    system: 'infectious',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 3,
  },

  rpr_syphilis: {
    slug: 'rpr_syphilis',
    name: 'RPR (Syphilis)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'infectious_disease',
    aliases: [
      'rpr', 'rpr syphilis', 'rapid plasma reagin',
      'vdrl', 'syphilis screen', 'syphilis ab',
      'treponema pallidum ab', 'tpha', 'fta abs',
      'rpr qualitative', 'rpr screen', 'syphilis',
    ],
    system: 'infectious',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 3,
  },

  // ===== URINALYSIS =====
  // Urinalysis contains four sub-types:
  //   1. Qualitative dipstick   — Color, Clarity, Nitrite, Ketones, etc.
  //   2. Semi-quantitative      — Protein/Blood/Glucose as Trace/1+/2+/3+
  //   3. Numeric semi-quant     — Specific Gravity, pH (true numbers with ranges)
  //   4. Microscopy             — WBC/RBC /hpf, Bacteria, Casts, Epithelial Cells
  //
  // All qualitative urinalysis entries carry qualitative_state_map so state is
  // determined per-marker rather than by the generic serology mapping.
  // Numeric microscopy / specific gravity / pH entries use the standard classifier.
  // None of these markers are saved to biomarkers_static in Phase 1.

  urine_color: {
    slug: 'urine_color',
    name: 'Urine Color',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      yellow: 'Optimal', straw: 'Optimal',
      clear: 'Watch', amber: 'Watch',
      orange: 'Attention', red: 'Attention', brown: 'Attention',
    },
    aliases: [
      'color', 'colour', 'urine color', 'urine colour',
      'color, urine', 'colour, urine',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_clarity: {
    slug: 'urine_clarity',
    name: 'Urine Clarity',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      clear: 'Optimal',
      hazy: 'Watch',
      cloudy: 'Attention', turbid: 'Attention',
    },
    aliases: [
      'clarity', 'appearance', 'turbidity', 'urine clarity',
      'urine appearance', 'urine turbidity',
      'clarity, urine', 'appearance, urine',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_glucose_ua: {
    slug: 'urine_glucose_ua',
    name: 'Glucose (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      negative: 'Optimal', none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal',
      trace: 'Attention',
      small: 'Attention', moderate: 'Attention', large: 'Attention',
      plus_1: 'Attention', plus_2: 'Attention', plus_3: 'Attention', plus_4: 'Attention',
    },
    aliases: [
      'glucose', 'glucose, urine', 'urine glucose',
      'glucose ur', 'glu urine', 'glucose ua',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_protein_ua: {
    slug: 'urine_protein_ua',
    name: 'Protein (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      negative: 'Optimal', none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal',
      trace: 'Watch',
      small: 'Attention', moderate: 'Attention', large: 'Attention',
      plus_1: 'Attention', plus_2: 'Attention', plus_3: 'Attention', plus_4: 'Attention',
    },
    aliases: [
      'protein', 'protein, urine', 'urine protein',
      'prot urine', 'protein ur', 'albumin urine', 'albumin, urine',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_blood_ua: {
    slug: 'urine_blood_ua',
    name: 'Blood (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      negative: 'Optimal', none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal',
      trace: 'Watch',
      small: 'Attention', moderate: 'Attention', large: 'Attention',
      plus_1: 'Attention', plus_2: 'Attention', plus_3: 'Attention',
    },
    aliases: [
      'blood', 'blood, urine', 'urine blood', 'occult blood urine',
      'blood ur', 'hemogl urine', 'hemoglobin urine',
      'rbc, urine', 'rbc/hpf',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_ketones_ua: {
    slug: 'urine_ketones_ua',
    name: 'Ketones (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      negative: 'Optimal', none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal',
      trace: 'Watch',
      small: 'Attention', moderate: 'Attention', large: 'Attention',
      plus_1: 'Attention', plus_2: 'Attention', plus_3: 'Attention',
    },
    aliases: [
      'ketones', 'ketone', 'ketones, urine', 'urine ketones',
      'ketone bodies', 'acetone', 'acetone urine', 'ketone ur',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_bilirubin_ua: {
    slug: 'urine_bilirubin_ua',
    name: 'Bilirubin (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      negative: 'Optimal', none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal',
      trace: 'Attention',
      small: 'Attention', moderate: 'Attention', large: 'Attention',
      plus_1: 'Attention', plus_2: 'Attention', plus_3: 'Attention',
    },
    aliases: [
      'bilirubin', 'bilirubin, urine', 'urine bilirubin',
      'bili urine', 'bili ur', 'bilirubin ur',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_urobilinogen_ua: {
    slug: 'urine_urobilinogen_ua',
    name: 'Urobilinogen (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      negative: 'Optimal', normal: 'Optimal', none: 'Optimal', none_seen: 'Optimal',
      trace: 'Watch', plus_1: 'Watch',
      small: 'Attention', moderate: 'Attention', large: 'Attention',
      plus_2: 'Attention', plus_3: 'Attention', plus_4: 'Attention',
    },
    aliases: [
      'urobilinogen', 'urobilinogen, urine', 'urine urobilinogen',
      'ubg urine', 'urobilinogen ur',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_nitrite_ua: {
    slug: 'urine_nitrite_ua',
    name: 'Nitrite (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      negative: 'Optimal', none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal',
      positive: 'Attention', reactive: 'Attention', present: 'Attention',
      trace: 'Watch',
    },
    aliases: [
      'nitrite', 'nitrites', 'nitrite, urine', 'urine nitrite',
      'urine nitrites', 'nitrite ur',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_leukocyte_esterase_ua: {
    slug: 'urine_leukocyte_esterase_ua',
    name: 'Leukocyte Esterase (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      negative: 'Optimal', none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal',
      trace: 'Watch',
      small: 'Attention', moderate: 'Attention', large: 'Attention',
      plus_1: 'Attention', plus_2: 'Attention', plus_3: 'Attention',
    },
    aliases: [
      'leukocyte esterase', 'leukocyte esterase, urine', 'urine leukocyte esterase',
      'wbc esterase', 'leuk esterase', 'le urine',
      'wbc, urine', 'white blood cells, urine',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_specific_gravity: {
    slug: 'urine_specific_gravity',
    name: 'Specific Gravity (Urine)',
    unit: '',
    result_type: 'quantitative',
    marker_category: 'urinalysis',
    aliases: [
      'specific gravity', 'urine specific gravity',
      'sp gr', 'sp grav', 'sg urine', 'specific gravity, urine',
    ],
    system: 'urinalysis',
    riskProfile: 'u-shaped',
    normalF: { min: 1.005, max: 1.030 },
    normalM: { min: 1.005, max: 1.030 },
    optimalF: { min: 1.010, max: 1.025 },
    optimalM: { min: 1.010, max: 1.025 },
    impossibleMin: 1.000,
    impossibleMax: 1.040,
    priorityWeight: 1,
  },

  urine_ph: {
    slug: 'urine_ph',
    name: 'pH (Urine)',
    unit: '',
    result_type: 'quantitative',
    marker_category: 'urinalysis',
    aliases: [
      'ph', 'urine ph', 'ph, urine', 'ph ur',
      'reaction', 'urine reaction',
    ],
    system: 'urinalysis',
    riskProfile: 'u-shaped',
    normalF: { min: 4.5, max: 8.5 },
    normalM: { min: 4.5, max: 8.5 },
    optimalF: { min: 5.5, max: 7.5 },
    optimalM: { min: 5.5, max: 7.5 },
    impossibleMin: 3.0,
    impossibleMax: 10.0,
    priorityWeight: 1,
  },

  urine_wbc_hpf: {
    slug: 'urine_wbc_hpf',
    name: 'WBC (Urine, /hpf)',
    unit: '/hpf',
    result_type: 'quantitative',
    marker_category: 'urinalysis',
    aliases: [
      'wbc /hpf', 'wbc/hpf', 'wbcs /hpf', 'wbcs/hpf',
      'white blood cells /hpf', 'white cells /hpf',
      'leukocytes /hpf', 'wbc hpf', 'wbc, urine /hpf',
    ],
    system: 'urinalysis',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 5 },
    normalM: { min: 0, max: 5 },
    optimalF: { min: 0, max: 2 },
    optimalM: { min: 0, max: 2 },
    impossibleMin: 0,
    impossibleMax: 500,
    priorityWeight: 2,
  },

  urine_rbc_hpf: {
    slug: 'urine_rbc_hpf',
    name: 'RBC (Urine, /hpf)',
    unit: '/hpf',
    result_type: 'quantitative',
    marker_category: 'urinalysis',
    aliases: [
      'rbc /hpf', 'rbc/hpf', 'rbcs /hpf', 'rbcs/hpf',
      'red blood cells /hpf', 'red cells /hpf',
      'erythrocytes /hpf', 'rbc hpf', 'rbc, urine /hpf',
    ],
    system: 'urinalysis',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 5 },
    normalM: { min: 0, max: 2 },
    optimalF: { min: 0, max: 2 },
    optimalM: { min: 0, max: 1 },
    impossibleMin: 0,
    impossibleMax: 500,
    priorityWeight: 2,
  },

  urine_bacteria_hpf: {
    slug: 'urine_bacteria_hpf',
    name: 'Bacteria (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'microbiology',
    qualitative_state_map: {
      none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal', negative: 'Optimal',
      rare: 'Watch',
      few: 'Attention', moderate: 'Attention', many: 'Attention',
      positive: 'Attention', present: 'Attention',
    },
    aliases: [
      'bacteria', 'bacteria /hpf', 'bacteria/hpf', 'bacteria hpf',
      'bacteria, urine', 'urine bacteria', 'bacteriuria',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_epithelial_cells_hpf: {
    slug: 'urine_epithelial_cells_hpf',
    name: 'Epithelial Cells (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal', negative: 'Optimal',
      rare: 'Watch', few: 'Watch',
      moderate: 'Attention', many: 'Attention',
    },
    aliases: [
      'epithelial cells', 'epithelial cells /hpf', 'epithelial cells/hpf',
      'squamous epithelial cells', 'squamous epithelial cells /hpf',
      'squamous epithelial', 'epith cells', 'squamous cells',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 1,
  },

  urine_casts_hpf: {
    slug: 'urine_casts_hpf',
    name: 'Casts (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal', negative: 'Optimal',
      rare: 'Watch',
      few: 'Attention', moderate: 'Attention', many: 'Attention',
    },
    aliases: [
      'casts', 'casts /hpf', 'casts/hpf', 'casts /lpf', 'casts/lpf',
      'granular casts', 'granular casts /lpf', 'granular casts/lpf',
      'hyaline casts', 'hyaline casts /lpf', 'hyaline casts/lpf',
      'waxy casts', 'muddy brown casts', 'cast',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 2,
  },

  urine_mucus_hpf: {
    slug: 'urine_mucus_hpf',
    name: 'Mucus (Urine)',
    unit: '',
    result_type: 'qualitative',
    marker_category: 'urinalysis',
    qualitative_state_map: {
      none: 'Optimal', none_seen: 'Optimal', absent: 'Optimal', negative: 'Optimal',
      rare: 'Watch', few: 'Watch',
      moderate: 'Attention', many: 'Attention',
    },
    aliases: [
      'mucus', 'mucus /hpf', 'mucus/hpf', 'mucous', 'mucous threads',
      'mucus threads', 'mucus, urine',
    ],
    system: 'urinalysis',
    riskProfile: 'context',
    normalF: { min: 0, max: 0 },
    normalM: { min: 0, max: 0 },
    optimalF: { min: 0, max: 0 },
    optimalM: { min: 0, max: 0 },
    impossibleMin: 0,
    impossibleMax: 0,
    priorityWeight: 1,
  },
}

// Unit conversions
// Rule: only add entries that are MATHEMATICALLY SAFE (multiply factor is exact or clinically accepted).
// Do NOT add conversions for units where equivalence is context-dependent or uncertain.
// Safe unit identity mappings (multiply: 1): mEq/L == mmol/L for monovalent electrolytes only.
// Future: add mEq/L → mmol/L for sodium, potassium, chloride once safety-reviewed.
export const UNIT_CONVERSIONS: Record<string, { from: string; to: string; multiply: number }[]> = {
  // TSH unit variants — mIU/L, µIU/mL, uIU/mL, mcIU/mL, mIU/mL are all numerically identical
  // in standard TSH lab reporting (physiological range ~0.4–4.0; mIU/mL used as mIU/L by labs)
  tsh: [
    { from: 'uiu/ml',  to: 'mIU/L', multiply: 1 },
    { from: 'µiu/ml',  to: 'mIU/L', multiply: 1 },
    { from: 'mciu/ml', to: 'mIU/L', multiply: 1 },
    { from: 'miu/ml',  to: 'mIU/L', multiply: 1 },
  ],
  crp_hs: [{ from: 'mg/dL', to: 'mg/L', multiply: 10 }],
  glucose_fasting: [{ from: 'mmol/L', to: 'mg/dL', multiply: 18.018 }],
  vitamin_d: [{ from: 'nmol/L', to: 'ng/mL', multiply: 0.4 }],
  hemoglobin: [{ from: 'mmol/L', to: 'g/dL', multiply: 1.6114 }],
  creatinine: [{ from: 'µmol/L', to: 'mg/dL', multiply: 0.0113 }],
  testosterone_total: [{ from: 'nmol/L', to: 'ng/dL', multiply: 28.818 }],
  triglycerides: [{ from: 'mmol/L', to: 'mg/dL', multiply: 88.57 }],
  hdl: [{ from: 'mmol/L', to: 'mg/dL', multiply: 38.67 }],
  ldl: [{ from: 'mmol/L', to: 'mg/dL', multiply: 38.67 }],
  total_cholesterol: [{ from: 'mmol/L', to: 'mg/dL', multiply: 38.67 }],
  // eGFR unit variants — all map to the canonical mL/min/1.73 m² with multiply 1
  // (the /1.73 is part of the unit name, not a numeric divisor)
  egfr: [
    { from: 'ml/min/1.73', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/mins/1.73', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/min/1.73m2', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/mins/1.73m2', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/min/1.73 m2', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/min', to: 'mL/min/1.73 m²', multiply: 1 },
  ],
  egfr_african_american: [
    { from: 'ml/min/1.73', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/mins/1.73', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/min/1.73m2', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/mins/1.73m2', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/min/1.73 m2', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/min', to: 'mL/min/1.73 m²', multiply: 1 },
  ],
  egfr_non_african_american: [
    { from: 'ml/min/1.73', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/mins/1.73', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/min/1.73m2', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/mins/1.73m2', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/min/1.73 m2', to: 'mL/min/1.73 m²', multiply: 1 },
    { from: 'ml/min', to: 'mL/min/1.73 m²', multiply: 1 },
  ],
  // Platelet unit normalization — x10^3/µL and K/µL are numerically identical.
  // Also handles lowercase and ASCII approximations printed by some lab systems.
  platelets: [
    { from: 'x10^3/ul',   to: 'K/µL', multiply: 1 },
    { from: 'x10^3/µl',   to: 'K/µL', multiply: 1 },
    { from: '10^3/ul',    to: 'K/µL', multiply: 1 },
    { from: '10^3/µl',    to: 'K/µL', multiply: 1 },
    { from: 'k/ul',       to: 'K/µL', multiply: 1 },
    { from: '10e3/ul',    to: 'K/µL', multiply: 1 },
    { from: 'thou/ul',    to: 'K/µL', multiply: 1 },
  ],
}

// Build reverse lookup
const _aliasMap = new Map<string, string>()
for (const [slug, marker] of Object.entries(CANONICAL_DICTIONARY)) {
  for (const alias of marker.aliases) {
    _aliasMap.set(alias.toLowerCase().trim(), slug)
  }
}

// PROTECTED TERMS: these slugs must NOT match via partial/substring matching
// to prevent confusion between similar names (e.g. "vldl" matching "ldl")
const PROTECTED_SLUGS = new Set([
  'ldl', 'hdl', 'vldl', 'non_hdl',
  'ldl_hdl_ratio', 'chol_hdl_ratio',
  'egfr_african_american', 'egfr_non_african_american',
  'neutrophils_pct', 'neutrophils_abs',
  'lymphocytes_pct', 'lymphocytes_abs',
  'monocytes_pct', 'monocytes_abs',
  'eosinophils_pct', 'eosinophils_abs',
  'basophils_pct', 'basophils_abs',
  'immature_granulocytes_pct', 'immature_granulocytes_abs',
  'bun', 'bun_creatinine_ratio',
  'total_t3', 'free_t3',
  'co2',
])

// ── Abbreviation expansion map ────────────────────────────────────────────────
// Applied before alias lookup so vendor-specific shorthand (e.g. "Hgb") maps
// to the full word used in alias entries (e.g. "hemoglobin").
// Only unambiguous, single-token expansions belong here.
// DO NOT expand "hb" alone — it is too short and context-dependent.
const _ABBREV_EXPANSIONS: Record<string, string> = {
  'hgb': 'hemoglobin',
  'hbg': 'hemoglobin',
  'ser': 'serum',
  'tot': 'total',
}

function _expandAbbreviations(text: string): string {
  return text
    .split(' ')
    .map(word => _ABBREV_EXPANSIONS[word] ?? word)
    .join(' ')
}

// ── Word-set Jaccard similarity ───────────────────────────────────────────────
// Used as final fallback. Words of length ≤ 1 are ignored to reduce noise.
// Returns 0–1; threshold 0.60 means ≥ 60% word-set overlap.
function _jaccardWords(a: string, b: string): number {
  const setA = new Set(a.split(' ').filter(w => w.length > 1))
  const setB = new Set(b.split(' ').filter(w => w.length > 1))
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const word of setA) {
    if (setB.has(word)) intersection++
  }
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}
const _JACCARD_THRESHOLD = 0.60

// ── Semantic ratio / risk-factor normalizer ───────────────────────────────────
// Catches vendor-proprietary names (e.g. "HDL Risk Factor", "Cardiac Risk Ratio")
// that carry clear ratio semantics but don't match any alias literally.
// This runs as Step 0.5 — before alias lookup and before PROTECTED_SLUGS exclusions,
// so ratio slugs (which are protected from fuzzy matching) still get correctly resolved.
//
// Resolution logic (clinical rationale):
//   LDL + HDL in name               → ldl_hdl_ratio
//   "cardiac risk" / "coronary risk" → chol_hdl_ratio  (TC/HDL = Framingham Risk)
//   HDL + ratio/risk intent          → chol_hdl_ratio
function _semanticRatioMatch(normalized: string): string | null {
  const hasHDL = normalized.includes('hdl')
  const hasLDL = normalized.includes('ldl')

  // Both lipoproteins present → LDL/HDL ratio
  if (hasLDL && hasHDL) return 'ldl_hdl_ratio'

  // Cardiac / coronary risk — clinically synonymous with TC/HDL (Framingham Risk Factor)
  if (normalized.includes('cardiac risk') || normalized.includes('coronary risk')) {
    return 'chol_hdl_ratio'
  }

  // HDL in a ratio / risk / division context → TC/HDL ratio
  if (hasHDL) {
    const hasRatioIntent =
      normalized.includes('ratio') ||
      normalized.includes('risk factor') ||
      normalized.includes('risk ratio') ||
      normalized.includes('/hdl') ||
      normalized.includes(':hdl') ||
      normalized.includes('chol/')
    if (hasRatioIntent) return 'chol_hdl_ratio'
  }

  return null
}

// Internal normalization helper — shared by both public API functions.
function _normalize(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(/[()[\]]/g, '')
    .replace(/[,;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Internal core matching logic.
// Returns { slug, confidence } or null.
// Both public API functions wrap this to maintain backward compatibility.
function _matchCore(rawName: string): SlugMatch | null {
  // Step 0: baseline normalization.
  // Colons are NOT stripped so "chol:hdl" alias forms survive into the map.
  // Colons are stripped only for the semantic layer's substring checks.
  const normalized = _normalize(rawName)

  // Step 0.25: parenthetical content strip.
  // "Blood Urea Nitrogen (BUN)" → try "blood urea nitrogen" before falling through.
  // "Carbon Dioxide (CO2)"      → try "carbon dioxide".
  // "LDL Cholesterol (LDL-C)"  → try "ldl cholesterol".
  // This step fires before PROTECTED_SLUGS checks, so protected markers are reachable.
  const withoutParenContent = rawName
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\s*\[[^\]]*\]/g, ' ')
    .trim()
  if (withoutParenContent.toLowerCase().trim() !== rawName.toLowerCase().trim()) {
    const strippedNorm = _normalize(withoutParenContent)
    if (strippedNorm && _aliasMap.has(strippedNorm)) {
      return { slug: _aliasMap.get(strippedNorm)!, confidence: 'alias' }
    }
    const strippedNoHyphens = strippedNorm.replace(/-/g, '')
    if (_aliasMap.has(strippedNoHyphens)) {
      return { slug: _aliasMap.get(strippedNoHyphens)!, confidence: 'alias' }
    }
    const strippedHyphensToSpaces = strippedNorm.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    if (_aliasMap.has(strippedHyphensToSpaces)) {
      return { slug: _aliasMap.get(strippedHyphensToSpaces)!, confidence: 'alias' }
    }
  }

  // Step 0.5: semantic ratio / risk-factor normalization.
  // Resolves vendor-proprietary names (e.g. "HDL Risk Factor", "Cardiac Risk Ratio")
  // to the correct protected ratio slug before the generic alias lookup.
  const normalizedForSemantic = normalized.replace(/:/g, ' ').replace(/\s+/g, ' ').trim()
  const semanticSlug = _semanticRatioMatch(normalizedForSemantic)
  if (semanticSlug) return { slug: semanticSlug, confidence: 'semantic' }

  // Step 1: exact alias match on normalized string
  if (_aliasMap.has(normalized)) return { slug: _aliasMap.get(normalized)!, confidence: 'exact' }

  // Step 2: hyphen normalization variants
  const withoutHyphens = normalized.replace(/-/g, '')
  if (_aliasMap.has(withoutHyphens)) return { slug: _aliasMap.get(withoutHyphens)!, confidence: 'alias' }
  const hyphensToSpaces = normalized.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  if (_aliasMap.has(hyphensToSpaces)) return { slug: _aliasMap.get(hyphensToSpaces)!, confidence: 'alias' }

  // Step 3: abbreviation expansion → alias lookup
  const expanded = _expandAbbreviations(normalized)
  if (expanded !== normalized) {
    if (_aliasMap.has(expanded)) return { slug: _aliasMap.get(expanded)!, confidence: 'alias' }
    const expandedNoHyphens = expanded.replace(/-/g, '')
    if (_aliasMap.has(expandedNoHyphens)) return { slug: _aliasMap.get(expandedNoHyphens)!, confidence: 'alias' }
    const expandedHyphensToSpaces = expanded.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    if (_aliasMap.has(expandedHyphensToSpaces)) return { slug: _aliasMap.get(expandedHyphensToSpaces)!, confidence: 'alias' }
  }

  // Step 4: substring / partial match on normalized string — PROTECTED_SLUGS excluded
  for (const [alias, slug] of _aliasMap.entries()) {
    if (PROTECTED_SLUGS.has(slug)) continue
    if (alias.length >= 4 && (normalized.includes(alias) || alias.includes(normalized))) {
      return { slug, confidence: 'fuzzy' }
    }
  }

  // Step 5: substring / partial match on abbreviation-expanded string
  if (expanded !== normalized) {
    for (const [alias, slug] of _aliasMap.entries()) {
      if (PROTECTED_SLUGS.has(slug)) continue
      if (alias.length >= 4 && (expanded.includes(alias) || alias.includes(expanded))) {
        return { slug, confidence: 'fuzzy' }
      }
    }
  }

  // Step 6: word-set Jaccard similarity ≥ 0.60 — PROTECTED_SLUGS excluded
  let bestSlug: string | null = null
  let bestScore = 0
  for (const [alias, slug] of _aliasMap.entries()) {
    if (PROTECTED_SLUGS.has(slug)) continue
    if (alias.length < 4) continue
    const score = _jaccardWords(expanded, alias)
    if (score >= _JACCARD_THRESHOLD && score > bestScore) {
      bestScore = score
      bestSlug = slug
    }
  }
  if (bestSlug) return { slug: bestSlug, confidence: 'fuzzy' }

  return null
}

/**
 * Match a raw lab marker name to a canonical slug.
 *
 * Matching priority (highest → lowest):
 *   0.25 Parenthetical content strip — "Name (ABBR)" → "Name" (handles PROTECTED slugs)
 *   0.5  Semantic ratio / risk-factor normalization (vendor-proprietary names)
 *   1.   Exact alias lookup on normalized string
 *   2.   Hyphen normalization variants (strip / replace with space)
 *   3.   Abbreviation expansion (hgb → hemoglobin) + alias lookup
 *   4.   Substring / partial match on normalized string (PROTECTED_SLUGS excluded)
 *   5.   Substring / partial match on abbreviation-expanded string
 *   6.   Word-set Jaccard similarity ≥ 0.60 (PROTECTED_SLUGS excluded)
 *
 * Returns null if no match — marker is routed to pending_biomarkers queue.
 * For confidence scoring, use matchMarkerToSlugWithConfidence().
 */
export function matchMarkerToSlug(rawName: string): string | null {
  return _matchCore(rawName)?.slug ?? null
}

/**
 * Match a raw lab marker name to a canonical slug with confidence scoring.
 *
 * Returns { slug, confidence } or null.
 * Confidence levels:
 *   exact    — exact alias match after baseline normalization
 *   alias    — parenthetical strip, hyphen variant, or abbreviation expansion
 *   semantic — ratio / risk-factor semantic pattern detection
 *   fuzzy    — substring inclusion or Jaccard word-set similarity (≥ 0.60)
 */
export function matchMarkerToSlugWithConfidence(rawName: string): SlugMatch | null {
  return _matchCore(rawName)
}

export function convertToCanonicalUnit(
  slug: string,
  value: number,
  reportedUnit: string
): { value: number; unit: string; converted: boolean } {
  const marker = CANONICAL_DICTIONARY[slug]
  if (!marker) return { value, unit: reportedUnit, converted: false }
  const normalizedReported = reportedUnit.toLowerCase().trim()
  const normalizedCanonical = marker.unit.toLowerCase().trim()
  if (normalizedReported === normalizedCanonical) {
    return { value, unit: marker.unit, converted: false }
  }
  const conversions = UNIT_CONVERSIONS[slug]
  if (!conversions) return { value, unit: reportedUnit, converted: false }
  for (const conv of conversions) {
    if (conv.from.toLowerCase() === normalizedReported) {
      return {
        value: Math.round(value * conv.multiply * 100) / 100,
        unit: marker.unit,
        converted: true,
      }
    }
  }
  return { value, unit: reportedUnit, converted: false }
}

export function isImpossibleValue(slug: string, value: number): boolean {
  const marker = CANONICAL_DICTIONARY[slug]
  if (!marker) return false
  return value < marker.impossibleMin || value > marker.impossibleMax
}

export function classifyBiomarkerState(
  slug: string,
  value: number,
  biologicalProfile: 'female' | 'male'
): 'Optimal' | 'Watch' | 'Attention' | 'Critical' {
  const marker = CANONICAL_DICTIONARY[slug]
  if (!marker) return 'Watch'
  const optimal = biologicalProfile === 'female' ? marker.optimalF : marker.optimalM
  const normal = biologicalProfile === 'female' ? marker.normalF : marker.normalM
  if (value >= optimal.min && value <= optimal.max) return 'Optimal'
  if (value >= normal.min && value <= normal.max) return 'Watch'
  const distFromNormal = value < normal.min
    ? (normal.min - value) / normal.min
    : (value - normal.max) / normal.max
  if (distFromNormal > 0.5) return 'Critical'
  return 'Attention'
}
