export type BiologicalProfile = 'female' | 'male'

export type ClinicalBiomarkerState = 'Normal' | 'Low' | 'High' | 'Critical'

export interface ClinicalReferenceRange {
  min: number
  max: number
}

// ── Clinical State Engine ─────────────────────────────────────────────────────
// Classification uses ONLY clinical reference ranges.
// Optimal ranges are intentionally not used here.
// Output states: Normal (in range) | Low (below) | High (above) | Critical (severe)
// Severity threshold: >50% deviation from the clinical boundary → Critical.
export function classifyValueAgainstClinicalRange(
  value: number,
  normal: ClinicalReferenceRange
): ClinicalBiomarkerState {
  if (value >= normal.min && value <= normal.max) return 'Normal'

  if (value < normal.min) {
    const dist = normal.min > 0 ? (normal.min - value) / normal.min : (normal.min - value)
    return dist > 0.5 ? 'Critical' : 'Low'
  }

  const dist = normal.max > 0 ? (value - normal.max) / normal.max : (value - normal.max)
  return dist > 0.5 ? 'Critical' : 'High'
}
