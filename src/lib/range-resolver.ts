// Meridian — Range Resolver + Validation Layer (Sprint 2)
//
// Provides deterministic, clinically-sane range resolution for the display layer.
// Called at every BiomarkerRangeBar site instead of reading raw DB fields directly.
//
// 3-tier hierarchy:
//   T1: Stored range  — structurally valid AND passes physiological sanity check
//   T2: Canonical fallback — normalF/M from clinical dictionary (unit-compatible only)
//   T3: null — render neutral gradient track (no position dot)
//
// Design constraints (Sprint 2):
//   - No cross-unit conversion (mg/dL ↔ mmol/L) — detect mismatch, return T3
//   - No new dependencies
//   - Pure function — no side effects, no async

import { CANONICAL_DICTIONARY, getCanonicalFallbackRange } from './canonical-dictionary'

// ── Unit normalization ──────────────────────────────────────────────────────────
// Collapses notational variants of the same physical unit to a canonical lowercase
// form so they can be compared with strict equality.
// Handles the most common lab-report formatting inconsistencies.
// Does NOT convert between numerically different scales (e.g. mg/dL vs mmol/L).
function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return ''
  return unit
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    // K/µL equivalences: x10^3/uL, ×10^3/uL, 10^3/uL, thou/uL, k/ul
    .replace(/x10\^3\//i,  'k/')
    .replace(/×10\^3\//i,  'k/')
    .replace(/10\^3\//i,   'k/')
    .replace(/thou\//i,    'k/')
    // M/µL equivalences: x10^6/uL, ×10^6/uL, 10^6/uL
    .replace(/x10\^6\//i,  'm/')
    .replace(/×10\^6\//i,  'm/')
    .replace(/10\^6\//i,   'm/')
    // µ (U+00B5) → u  — normalise greek micro to ASCII
    .replace(/µ/g, 'u')
    // Strip trailing redundant suffixes that appear on some lab PDFs
    .replace(/\/dl$/, '/dl')
    .replace(/\/ul$/, '/ul')
    .replace(/\/fl$/, '/fl')
    // Percent variants
    .replace(/percent$/, '%')
    .replace(/pct$/,     '%')
}

// Returns true when two unit strings represent the same physical quantity
// after notational normalization. Fail-open: if either unit is absent/unknown,
// return true to allow the caller to proceed (rather than silently drop ranges
// for markers where labs omit the unit label).
function unitsCompatible(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeUnit(a)
  const nb = normalizeUnit(b)
  if (!na || !nb) return true   // one or both unknown — allow the match
  return na === nb
}

// ── Physiological sanity check ─────────────────────────────────────────────────
// Returns true when the interval [min, max] is structurally valid AND sits within
// the physiologically possible window for the given marker slug.
//
// Rejection criteria:
//   - Either bound is null or non-finite
//   - min >= max  (degenerate or inverted interval)
//   - min < marker.impossibleMin  (below any physiologically observed value)
//   - max > marker.impossibleMax  (above any physiologically observed value)
//
// Protects against real-world OCR failures such as "RBC: 0 – 20.8"
// where both bounds lie completely outside the possible range (1–10 M/µL).
export function isSaneRange(
  slug: string,
  min: number | null,
  max: number | null
): boolean {
  if (min === null || max === null) return false
  if (!Number.isFinite(min) || !Number.isFinite(max)) return false
  if (min >= max) return false
  const marker = CANONICAL_DICTIONARY[slug]
  if (!marker) return true          // unknown slug — accept as-is (no bounds to check)
  if (min < marker.impossibleMin)  return false
  if (max > marker.impossibleMax)  return false
  return true
}

// ── 3-tier range resolver ──────────────────────────────────────────────────────
// Call this at every BiomarkerRangeBar render site.
//
//   slug          — canonical biomarker slug (b.marker_name)
//   storedMin/Max — raw values from DB (reference_range_min / reference_range_max)
//   storedUnit    — unit string from DB (b.unit) — used for unit compatibility check
//   profile       — raw biological_profile string from Supabase user row
//
// Returns the best {min, max} interval available, or null (→ render neutral bar).
export function resolveDisplayRange(
  slug: string,
  storedMin: number | null,
  storedMax: number | null,
  storedUnit: string | null | undefined,
  profile: string
): { min: number; max: number } | null {
  const bio: 'female' | 'male' =
    profile === 'male' || profile === 'Male' ? 'male' : 'female'

  // T1: stored range — accept when structurally valid + physiologically plausible
  if (isSaneRange(slug, storedMin, storedMax)) {
    return { min: storedMin!, max: storedMax! }
  }

  // T2: canonical clinical dictionary — fallback when stored range is absent/corrupt
  // Only use when the stored value's unit is compatible with the canonical unit,
  // to prevent scale corruption (e.g. a glucose value in mmol/L scaled against a
  // canonical range in mg/dL would place the dot wildly off-range).
  const canonical = getCanonicalFallbackRange(slug, bio)
  if (canonical) {
    const marker = CANONICAL_DICTIONARY[slug]
    const canonicalUnit = marker?.unit ?? null
    if (unitsCompatible(storedUnit, canonicalUnit)) {
      return canonical
    }
  }

  // T3: no reliable range — caller renders neutral gradient track
  return null
}
