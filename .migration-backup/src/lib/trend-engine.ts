// Meridian — Trend Engine (Sprint 4)
//
// Longitudinal intelligence layer: delta calculations, clinically-aware
// trend direction, contextual severity classification, and panel-level
// trend summaries for the history and detail-sheet rendering paths.
//
// Sprint 4 tasks implemented here:
//   T001 — Historical delta helpers (getPreviousBiomarkerValue, calculateDelta,
//           calculatePercentChange, getTrendDirection)
//   T002 — Clinical contextual state (getClinicalContextualState)
//   T005 — Panel-level trend summary (getPanelTrendSummary)
//   T006 — Emotional UX guardrails (getTrendDisplayProps soft/contextual language)
//   T007 — Safety engine preservation (critical_override contextual_severity)
//
// Design constraints:
//   - Pure functions only — no side effects, no React, no async
//   - All direction decisions are clinically grounded, not raw numeric
//   - Safety Engine critical status always overrides trend softening (T007)

// ── Types ─────────────────────────────────────────────────────────────────────

// Minimal biomarker record interface.
// Both RecentBiomarker and HistBiomarkerRow in upload/page.tsx satisfy this
// structurally (TypeScript duck typing).
export interface TrendBiomarker {
  id: string
  marker_name: string
  value: number | null   // null for qualitative markers — treated as insufficient_data
  unit: string | null
  state: string | null
  collected_at: string   // ISO 8601 — date key extracted as split('T')[0]
}

export type TrendDirection =
  | 'improving'          // moving toward the clinically preferred direction
  | 'worsening'          // moving away from the clinically preferred direction
  | 'stable'             // < STABLE_THRESHOLD_PCT change, or no direction model available
  | 'insufficient_data'  // only one data point, or previous value is null/zero

// contextual_severity classifies the combination of current state + trend.
// Used by UI layers to decide tone (T006) and by the insight prompt (T003).
export type ContextualSeverity =
  | 'critical_override'   // Safety Engine flag — must never soften tone (T007)
  | 'improving_abnormal'  // still out of range but trending right direction
  | 'worsening_normal'    // was within range, now drifting toward abnormal
  | 'stable_abnormal'     // consistently out of range and worsening or stuck
  | 'monitored_stable'    // out of range but unchanged — monitoring is warranted
  | 'stable_normal'       // in range, no meaningful change
  | 'insufficient_data'   // only one data point or null previous value

export interface ClinicalContextualState {
  current_state: string | null
  trend: TrendDirection
  delta: number | null
  percent_change: number | null
  contextual_severity: ContextualSeverity
}

// ── Clinical direction constants ─────────────────────────────────────────────
// These define whether a numeric increase is clinically favorable for a slug.
// Mirrors the direction sets in upload/page.tsx but kept here for lib purity.

const LOWER_IS_BETTER = new Set([
  'ldl', 'ldl_cholesterol', 'triglycerides', 'total_cholesterol',
  'non_hdl', 'non_hdl_cholesterol',
  'hba1c', 'hemoglobin_a1c',
  'glucose_fasting', 'fasting_glucose',
  'insulin_fasting', 'fasting_insulin',
  'hs_crp', 'crp_hs',
  'homocysteine',
  'vldl',
])

const HIGHER_IS_BETTER = new Set([
  'hdl', 'hdl_cholesterol',
  'egfr', 'egfr_african_american', 'egfr_non_african_american',
  'vitamin_d',
  'vitamin_b12',
  'folate',
  'ferritin',
])

// Threshold below which a change is considered clinically stable (not a meaningful trend).
// 5% is a conservative clinical noise floor for most lab biomarkers.
const STABLE_THRESHOLD_PCT = 5

// ── T001: getPreviousBiomarkerValue ──────────────────────────────────────────
// Returns the nearest previous result for `slug`, strictly before `currentDateKey`.
//
// Rules (per Sprint 4 spec):
//   - Strict earlier date only (< currentDateKey) — ignores same-day duplicates
//   - Ignores null values
//   - Uses collection_date ordering only (not created_at)
//   - currentId excluded when provided (prevents self-comparison)
export function getPreviousBiomarkerValue<T extends TrendBiomarker>(
  slug: string,
  currentDateKey: string,   // YYYY-MM-DD
  biomarkers: T[],
  currentId?: string,
): T | null {
  const dateOf = (iso: string) => iso.split('T')[0]
  const candidates = biomarkers.filter(b =>
    b.marker_name === slug &&
    b.value !== null &&
    dateOf(b.collected_at) < currentDateKey &&
    (currentId === undefined || b.id !== currentId),
  )
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => b.collected_at.localeCompare(a.collected_at))[0]
}

// ── T001: calculateDelta ─────────────────────────────────────────────────────
// Returns the signed absolute change (current − previous), rounded to 2 dp.
export function calculateDelta(current: number, previous: number): number {
  return Number((current - previous).toFixed(2))
}

// ── T001: calculatePercentChange ─────────────────────────────────────────────
// Returns the percentage change relative to previous value, rounded to 1 dp.
// Returns null when previous is zero to avoid division-by-zero.
export function calculatePercentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return null
  return Number(((current - previous) / Math.abs(previous)) * 100)
}

// ── T001: getTrendDirection ───────────────────────────────────────────────────
// Clinically-aware direction classifier.
//
// Lower-is-better (LDL, A1c, TG, hs-CRP…):
//   decrease → improving, increase → worsening
//
// Higher-is-better (HDL, eGFR, Vitamin D, B12…):
//   increase → improving, decrease → worsening
//
// Middle-is-best (CBC, CMP electrolytes, thyroid…):
//   uses refMin/refMax midpoint to determine which side the current value is on.
//   Above midpoint → lower is improving; below midpoint → higher is improving.
//   Without ref range: returns 'stable' (conservative — do not guess direction).
//
// Stability threshold: |Δ%| < STABLE_THRESHOLD_PCT → 'stable'
export function getTrendDirection(
  slug: string,
  currentValue: number,
  previousValue: number,
  refMin: number | null = null,
  refMax: number | null = null,
): TrendDirection {
  if (previousValue === 0) return 'insufficient_data'

  const delta = currentValue - previousValue
  if (delta === 0) return 'stable'

  const pctChange = Math.abs(delta / previousValue) * 100
  if (pctChange < STABLE_THRESHOLD_PCT) return 'stable'

  // Lower-is-better slugs: decrease = improving
  if (LOWER_IS_BETTER.has(slug)) {
    return delta < 0 ? 'improving' : 'worsening'
  }

  // Higher-is-better slugs: increase = improving
  if (HIGHER_IS_BETTER.has(slug)) {
    return delta > 0 ? 'improving' : 'worsening'
  }

  // Middle-is-best: use reference range midpoint to determine favorable direction
  if (refMin !== null && refMax !== null && refMin < refMax) {
    const midpoint = (refMin + refMax) / 2
    // Above midpoint: moving down = improving; below midpoint: moving up = improving
    if (currentValue > midpoint) {
      return delta < 0 ? 'improving' : 'worsening'
    } else {
      return delta > 0 ? 'improving' : 'worsening'
    }
  }

  // No direction model available — conservative fallback
  return 'stable'
}

// ── T002: getClinicalContextualState ─────────────────────────────────────────
// Full contextual state for a biomarker at a point in time.
//
// T007 Safety Engine preservation:
//   When isCritical = true, contextual_severity is always 'critical_override'.
//   Trend data is still computed (for display/logging) but tone must never be
//   softened. The Safety Note in the UI takes precedence over any trend framing.
export function getClinicalContextualState(
  slug: string,
  currentValue: number | null,
  currentState: string | null,
  previousRecord: TrendBiomarker | null,
  refMin: number | null,
  refMax: number | null,
  isCritical: boolean,
): ClinicalContextualState {
  // Guard: null current value → insufficient data
  if (currentValue === null) {
    return {
      current_state: currentState,
      trend: 'insufficient_data',
      delta: null,
      percent_change: null,
      contextual_severity: 'insufficient_data',
    }
  }

  const prevValue =
    previousRecord !== null && previousRecord.value !== null
      ? previousRecord.value
      : null

  const delta = prevValue !== null ? calculateDelta(currentValue, prevValue) : null
  const percentChange = prevValue !== null ? calculatePercentChange(currentValue, prevValue) : null
  const trend: TrendDirection =
    prevValue !== null
      ? getTrendDirection(slug, currentValue, prevValue, refMin, refMax)
      : 'insufficient_data'

  // T007: Safety Engine override — critical state must never be softened by trend
  if (isCritical) {
    return {
      current_state: currentState,
      trend,
      delta,
      percent_change: percentChange,
      contextual_severity: 'critical_override',
    }
  }

  if (prevValue === null) {
    return {
      current_state: currentState,
      trend: 'insufficient_data',
      delta: null,
      percent_change: null,
      contextual_severity: 'insufficient_data',
    }
  }

  const isAbnormal =
    currentState === 'Low' ||
    currentState === 'High' ||
    currentState === 'Attention' ||
    currentState === 'Critical'

  const isNormal =
    currentState === 'Normal' ||
    currentState === 'Optimal' ||
    currentState === 'Watch'

  let contextualSeverity: ContextualSeverity

  if (isAbnormal && trend === 'improving') {
    contextualSeverity = 'improving_abnormal'
  } else if (isNormal && trend === 'worsening') {
    contextualSeverity = 'worsening_normal'
  } else if (isAbnormal && trend === 'stable') {
    contextualSeverity = 'monitored_stable'
  } else if (isAbnormal) {
    // worsening or insufficient_data while abnormal
    contextualSeverity = 'stable_abnormal'
  } else if (isNormal) {
    contextualSeverity = 'stable_normal'
  } else {
    contextualSeverity = 'insufficient_data'
  }

  return {
    current_state: currentState,
    trend,
    delta,
    percent_change: percentChange,
    contextual_severity: contextualSeverity,
  }
}

// ── T004/T006: getTrendDisplayProps ──────────────────────────────────────────
// Returns visual rendering properties for the Trend card in detail sheets.
//
// Color tokens:
//   improving  → teal (#2DD4BF)
//   worsening  → amber (#FB923C)
//   stable     → textMuted (#5F8E85)
//   critical   → red (#F87171) — safety note handles the narrative, not the trend card
//
// contextLine (T006 emotional UX guardrails):
//   improving_abnormal  → softer language acknowledging direction without implying recovery
//   worsening_normal    → watch language without alarming
//   monitored_stable    → steady monitoring language
//   critical_override   → null — safety note in the UI handles framing entirely
export function getTrendDisplayProps(
  severity: ContextualSeverity,
  trend: TrendDirection,
): { color: string; contextLine: string | null } {
  // Critical override: trend card color is red but narrative is suppressed —
  // the Safety Note block handles all framing (T007).
  if (severity === 'critical_override') {
    return { color: '#F87171', contextLine: null }
  }

  let color: string
  switch (trend) {
    case 'improving':         color = '#2DD4BF'; break  // teal
    case 'worsening':         color = '#FB923C'; break  // amber
    case 'stable':            color = '#5F8E85'; break  // textMuted
    case 'insufficient_data': color = '#5F8E85'; break
    default:                  color = '#5F8E85'
  }

  // T006: contextual language — soften tone for improving abnormalities,
  // add monitoring note for worsening or stuck patterns.
  // NEVER claim recovery, never imply cure, never suppress follow-up.
  let contextLine: string | null = null
  switch (severity) {
    case 'improving_abnormal':
      contextLine = 'Still outside reference range, but trending in the right direction.'
      break
    case 'worsening_normal':
      contextLine = 'Within range, but drifting. Worth watching at the next lab.'
      break
    case 'monitored_stable':
      contextLine = 'Remained outside range at this level. Continued monitoring is relevant.'
      break
    default:
      contextLine = null
  }

  return { color, contextLine }
}

// ── T005: getPanelTrendSummary ────────────────────────────────────────────────
// Computes improvement awareness at the panel level.
// Computation layer only — no UI changes in Sprint 4.
//
// Example output:
//   CMP with 2 improving markers:
//   { improvingCount: 2, summaryText: "2 markers improving since previous lab." }
export interface PanelTrendSummary {
  improvingCount: number
  worseningCount: number
  stableCount: number
  insufficientCount: number
  summaryText: string | null
}

export function getPanelTrendSummary<T extends TrendBiomarker>(
  currentMarkers: T[],
  allBiomarkers: T[],
  refRanges: Record<string, { min: number | null; max: number | null }> = {},
): PanelTrendSummary {
  let improvingCount  = 0
  let worseningCount  = 0
  let stableCount     = 0
  let insufficientCount = 0

  for (const marker of currentMarkers) {
    if (marker.value === null) { insufficientCount++; continue }

    const dateKey = marker.collected_at.split('T')[0]
    const prev = getPreviousBiomarkerValue(
      marker.marker_name,
      dateKey,
      allBiomarkers,
      marker.id,
    )

    if (prev === null || prev.value === null) { insufficientCount++; continue }

    const ref = refRanges[marker.marker_name] ?? { min: null, max: null }
    const dir = getTrendDirection(
      marker.marker_name,
      marker.value,
      prev.value,
      ref.min,
      ref.max,
    )

    switch (dir) {
      case 'improving':         improvingCount++;   break
      case 'worsening':         worseningCount++;   break
      case 'stable':            stableCount++;      break
      case 'insufficient_data': insufficientCount++; break
    }
  }

  const totalComparable = improvingCount + worseningCount + stableCount
  let summaryText: string | null = null

  if (totalComparable > 0) {
    if (improvingCount > 0 && worseningCount === 0) {
      const n = improvingCount
      summaryText = `${n} ${n === 1 ? 'marker' : 'markers'} improving since previous lab.`
    } else if (worseningCount > 0 && improvingCount === 0) {
      const n = worseningCount
      summaryText = `${n} ${n === 1 ? 'marker' : 'markers'} trending higher risk since previous lab.`
    } else if (improvingCount > 0 && worseningCount > 0) {
      summaryText = `${improvingCount} improving, ${worseningCount} worsening since previous lab.`
    }
  }

  return { improvingCount, worseningCount, stableCount, insufficientCount, summaryText }
}
