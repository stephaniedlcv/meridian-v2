// ── Safety Engine V1 ───────────────────────────────────────────────────────────
// Deterministic output suppression layer for Meridian.
//
// PURPOSE
//   When a biomarker value falls within a potentially critical range,
//   suppress optimization-style language and surface a calm safety note.
//
// THIS IS NOT:
//   - A diagnostic engine
//   - A medical triage system
//   - A treatment recommendation engine
//   - A replacement for qualified medical care
//
// THIS IS:
//   - A conservative, deterministic threshold checker
//   - An output suppression gate (Phase 1 only)
//   - Based on commonly published clinical "panic value" reference ranges
//
// PHASE 1 — 6 marker slugs only:
//   glucose_fasting, potassium, sodium, hemoglobin, creatinine, platelets
//
// Future phases may:
//   - Expand the threshold list
//   - Add per-upload_session_id traceability
//   - Integrate alias review and pending_biomarkers classification
//   - Surface confidence scoring
//   - Add manual override capability
//
// EDGE CASE POLICY:
//   Unknown unit, incompatible unit, or missing value → always 'normal'.
//   No conversions are performed inside this engine.
//   Values ARE in canonical units (post-OCR unit conversion by the pipeline).

export interface SafetyStatus {
  status: 'normal' | 'critical'
  reason?: string
}

// ── Unit normalization ─────────────────────────────────────────────────────────
// Collapse variant spellings to a comparable form before matching.
// µ / μ (Unicode) → u (ASCII), lowercase, strip whitespace.
// mEq/L and mmol/L are numerically equivalent for monovalent ions (Na+, K+).
function normalizeUnit(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/μ|µ/g, 'u')
    .replace(/\s+/g, '')
}

// Accepted canonical unit + real-world lab report variants (post-normalization).
// Add only forms that appear in genuine lab reports.
const ACCEPTED_UNITS: Record<string, string[]> = {
  glucose_fasting: ['mg/dl'],
  potassium:       ['mmol/l', 'meq/l'],     // monovalent ion: 1 mmol/L = 1 mEq/L
  sodium:          ['mmol/l', 'meq/l'],     // monovalent ion: 1 mmol/L = 1 mEq/L
  hemoglobin:      ['g/dl'],
  creatinine:      ['mg/dl'],
  platelets:       ['k/ul', 'x10e3/ul', 'x10^3/ul', '10^3/ul', 'thou/ul', '10e3/ul'],
}

// ── Critical thresholds ────────────────────────────────────────────────────────
// Sources: commonly published clinical panic-value / critical-value ranges.
// Thresholds are inclusive: value AT the threshold triggers critical.
// When in doubt, use the more conservative (wider) bound.
const CRITICAL_THRESHOLDS: Record<string, {
  low?:       number  // value <= low  → critical
  high?:      number  // value >= high → critical
  lowFemale?: number  // biology-dependent (hemoglobin)
  lowMale?:   number  // biology-dependent (hemoglobin)
}> = {
  glucose_fasting: { low: 55,  high: 300 },
  potassium:       { low: 2.8, high: 6.0  },
  sodium:          { low: 125, high: 160  },
  hemoglobin:      { lowFemale: 7.0, lowMale: 8.0 },  // no high threshold in Phase 1
  creatinine:      { high: 5.0 },
  platelets:       { low: 20  },
}

/**
 * Evaluate whether a stored biomarker value is potentially critical.
 *
 * Conservative by design:
 *   - Unknown / incompatible units → 'normal'
 *   - No unit conversions are performed
 *   - Thresholds are inclusive (at-threshold = critical)
 *   - Hemoglobin: unknown biological_profile defaults to female threshold (more conservative)
 *
 * @param slug               Canonical slug from CANONICAL_DICTIONARY
 * @param value              Numeric value as stored in biomarkers_static (already converted by OCR pipeline)
 * @param unit               Unit string as stored in biomarkers_static
 * @param biologicalProfile  'female' | 'male' | undefined — only used for hemoglobin
 */
export function getSafetyStatusForBiomarker(
  slug: string,
  value: number,
  unit: string,
  biologicalProfile?: string,
): SafetyStatus {
  const thresholds = CRITICAL_THRESHOLDS[slug]
  if (!thresholds) return { status: 'normal' }

  // Missing or unrecognized unit → safe fallback, never force critical
  if (!unit) return { status: 'normal' }
  const normUnit   = normalizeUnit(unit)
  const accepted   = (ACCEPTED_UNITS[slug] ?? []).map(normalizeUnit)
  if (!accepted.includes(normUnit)) return { status: 'normal' }

  // ── Hemoglobin: biology-dependent critical low, no high threshold ──────────
  if (slug === 'hemoglobin') {
    // Unknown profile → female threshold (lower / more conservative)
    const critLow = biologicalProfile === 'male'
      ? (thresholds.lowMale   ?? thresholds.lowFemale ?? 7.0)
      : (thresholds.lowFemale ?? 7.0)
    if (value <= critLow) {
      return {
        status: 'critical',
        reason: `Hemoglobin ${value} ${unit} is at or below the critical low threshold (≤${critLow} ${unit}).`,
      }
    }
    return { status: 'normal' }
  }

  // ── Standard symmetric thresholds ─────────────────────────────────────────
  if (thresholds.low !== undefined && value <= thresholds.low) {
    return {
      status: 'critical',
      reason: `${value} ${unit} is at or below the critical low threshold (≤${thresholds.low} ${unit}).`,
    }
  }
  if (thresholds.high !== undefined && value >= thresholds.high) {
    return {
      status: 'critical',
      reason: `${value} ${unit} is at or above the critical high threshold (≥${thresholds.high} ${unit}).`,
    }
  }

  return { status: 'normal' }
}
