// MERIDIAN — Canonical Biomarker Dictionary
// This is the single source of truth for biomarker normalization.
// OCR output gets matched against this dictionary before entering the system.

export type RiskProfile = 'linear-high' | 'linear-low' | 'u-shaped' | 'context'

export interface CanonicalMarker {
  slug: string
  name: string
  unit: string
  aliases: string[]
  system: string
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
  tsh: {
    slug: 'tsh',
    name: 'TSH',
    unit: 'mIU/L',
    aliases: ['tsh', 'thyrotropin', 't.s.h.', 'hormona tiroestimulante', 'thyroid stimulating hormone', 'tirotropina', 'serum tsh'],
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
  hba1c: {
    slug: 'hba1c',
    name: 'Hemoglobin A1c',
    unit: '%',
    aliases: ['hba1c', 'a1c', 'glycated hemoglobin', 'hemoglobina glicosilada', 'glycated hb', 'hemoglobin a1c', 'hb a1c'],
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
    aliases: ['glucose', 'glucosa', 'glucose fasting', 'glucosa ayunas', 'blood sugar', 'glicemia', 'glucosa basal', 'fasting glucose', 'fasting blood sugar'],
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
  vitamin_d: {
    slug: 'vitamin_d',
    name: 'Vitamin D',
    unit: 'ng/mL',
    aliases: ['vitamin d', 'vitamina d', '25-oh vitamin d', '25-hydroxyvitamin d', 'calcidiol', 'vit d3', '25-oh vitamina d', 'd3', 'cholecalciferol'],
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
    aliases: ['vitamin b12', 'vitamina b12', 'b12', 'cobalamin', 'cyanocobalamin', 'cobalamina'],
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
  hdl: {
    slug: 'hdl',
    name: 'HDL Cholesterol',
    unit: 'mg/dL',
    aliases: ['hdl', 'hdl-c', 'hdl cholesterol', 'colesterol hdl', 'lipoproteina alta densidad', 'high density lipoprotein'],
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
    aliases: ['ldl', 'ldl-c', 'ldl cholesterol', 'colesterol ldl', 'lipoproteina baja densidad', 'low density lipoprotein'],
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
  triglycerides: {
    slug: 'triglycerides',
    name: 'Triglycerides',
    unit: 'mg/dL',
    aliases: ['triglycerides', 'trigliceridos', 'trig', 'tg', 'triacylglycerols'],
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
  ast: {
    slug: 'ast',
    name: 'AST',
    unit: 'U/L',
    aliases: ['ast', 'asat', 'sgot', 'aspartato aminotransferasa', 'aspartate aminotransferase'],
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
    aliases: ['alt', 'alat', 'sgpt', 'alanina aminotransferasa', 'alanine aminotransferase'],
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
  egfr: {
    slug: 'egfr',
    name: 'eGFR',
    unit: 'mL/min',
    aliases: ['egfr', 'gfr', 'e-gfr', 'tfg', 'creatinine clearance', 'filtrado glomerular', 'glomerular filtration rate'],
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
  creatinine: {
    slug: 'creatinine',
    name: 'Creatinine',
    unit: 'mg/dL',
    aliases: ['creatinine', 'creatinina', 'creat', 's-creatinina', 'serum creatinine'],
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
  ferritin: {
    slug: 'ferritin',
    name: 'Ferritin',
    unit: 'ng/mL',
    aliases: ['ferritin', 'ferritina', 'fer', 's-ferritine', 'serum ferritin'],
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
  crp_hs: {
    slug: 'crp_hs',
    name: 'hs-CRP',
    unit: 'mg/L',
    aliases: ['crp', 'hs-crp', 'crp-hs', 'pcr', 'pcr-us', 'c reactive protein', 'proteina c reactiva', 'proteina c reactiva alta sensibilidad', 'high sensitivity crp'],
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
  magnesium: {
    slug: 'magnesium',
    name: 'Magnesium',
    unit: 'mg/dL',
    aliases: ['magnesium', 'magnesio', 'mg', 'magnesio serico', 'serum magnesium'],
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
  testosterone_total: {
    slug: 'testosterone_total',
    name: 'Total Testosterone',
    unit: 'ng/dL',
    aliases: ['testosterone', 'testosterona', 'testosterone total', 'testosterona total', 'testo t', 'total testosterone'],
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
  folate: {
    slug: 'folate',
    name: 'Folate',
    unit: 'ng/mL',
    aliases: ['folate', 'folic acid', 'acido folico', 'folato'],
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
  hemoglobin: {
    slug: 'hemoglobin',
    name: 'Hemoglobin',
    unit: 'g/dL',
    aliases: ['hemoglobin', 'hemoglobina', 'hgb', 'hb'],
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
  wbc: {
    slug: 'wbc',
    name: 'White Blood Cells',
    unit: 'K/µL',
    aliases: ['wbc', 'white blood cells', 'leucocitos', 'globulos blancos', 'white blood cell count', 'leucocyte count'],
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
  platelets: {
    slug: 'platelets',
    name: 'Platelets',
    unit: 'K/µL',
    aliases: ['platelets', 'plaquetas', 'platelet count', 'trombocitos', 'plt'],
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
}

// Unit conversion table: from → to canonical
export const UNIT_CONVERSIONS: Record<string, { from: string; to: string; multiply: number }[]> = {
  crp_hs: [
    { from: 'mg/dL', to: 'mg/L', multiply: 10 },
  ],
  glucose_fasting: [
    { from: 'mmol/L', to: 'mg/dL', multiply: 18.018 },
  ],
  vitamin_d: [
    { from: 'nmol/L', to: 'ng/mL', multiply: 0.4 },
  ],
  hemoglobin: [
    { from: 'mmol/L', to: 'g/dL', multiply: 1.6114 },
  ],
  creatinine: [
    { from: 'µmol/L', to: 'mg/dL', multiply: 0.0113 },
  ],
  testosterone_total: [
    { from: 'nmol/L', to: 'ng/dL', multiply: 28.818 },
  ],
  triglycerides: [
    { from: 'mmol/L', to: 'mg/dL', multiply: 88.57 },
  ],
  hdl: [
    { from: 'mmol/L', to: 'mg/dL', multiply: 38.67 },
  ],
  ldl: [
    { from: 'mmol/L', to: 'mg/dL', multiply: 38.67 },
  ],
}

// Build a reverse lookup: alias → slug
const _aliasMap = new Map<string, string>()
for (const [slug, marker] of Object.entries(CANONICAL_DICTIONARY)) {
  for (const alias of marker.aliases) {
    _aliasMap.set(alias.toLowerCase().trim(), slug)
  }
}

/**
 * Fuzzy match a raw marker name from OCR to canonical slug.
 * Returns the slug or null if no match found.
 */
export function matchMarkerToSlug(rawName: string): string | null {
  const normalized = rawName.toLowerCase().trim()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')

  // Direct match
  if (_aliasMap.has(normalized)) {
    return _aliasMap.get(normalized)!
  }

  // Partial match: check if any alias is contained in the raw name or vice versa
  for (const [alias, slug] of _aliasMap.entries()) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return slug
    }
  }

  return null
}

/**
 * Convert a value from a non-canonical unit to the canonical unit.
 * Returns the converted value and canonical unit, or original if no conversion needed.
 */
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

/**
 * Check if a value is physically impossible for a given marker.
 */
export function isImpossibleValue(slug: string, value: number): boolean {
  const marker = CANONICAL_DICTIONARY[slug]
  if (!marker) return false
  return value < marker.impossibleMin || value > marker.impossibleMax
}

/**
 * Determine the state (Optimal/Watch/Attention/Critical) for a biomarker value.
 */
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

  // Outside normal range — check severity
  const distFromNormal = value < normal.min
    ? (normal.min - value) / normal.min
    : (value - normal.max) / normal.max

  if (distFromNormal > 0.5) return 'Critical'
  return 'Attention'
}
