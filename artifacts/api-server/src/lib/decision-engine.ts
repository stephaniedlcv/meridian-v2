import { CANONICAL_DICTIONARY } from './canonical-dictionary'

export interface BiomarkerRecord {
  id: string
  marker_name: string
  value: number
  unit: string
  state: 'Optimal' | 'Watch' | 'Attention' | 'Critical'
  reference_range_min: number | null
  reference_range_max: number | null
  optimal_range_min: number | null
  optimal_range_max: number | null
  collected_at: string
  flag_error: boolean
  validated: boolean
}

export interface ScoredMarker {
  slug: string
  name: string
  value: number
  unit: string
  state: string
  gravity: number
  persistence: number
  confidence: number
  decay: number
  score: number
  system: string
  isSafetyAlert: boolean
}

export interface EngineResult {
  dominant: ScoredMarker | null
  all_scores: ScoredMarker[]
  safety_alerts: ScoredMarker[]
  has_safety_alert: boolean
  confidence_floor_applied: number
  total_markers_analyzed: number
}

const SAFETY_THRESHOLDS: Record<string, { min?: number; max?: number }> = {
  glucose_fasting: { min: 40, max: 400 },
  creatinine: { max: 10 },
  hemoglobin: { min: 5, max: 22 },
  platelets: { min: 30, max: 1000 },
  wbc: { min: 1.5, max: 30 },
  egfr: { min: 15 },
  alt: { max: 300 },
  ast: { max: 300 },
  tsh: { min: 0.05, max: 20 },
  crp_hs: { max: 50 },
}

export function calculateGravity(
  value: number,
  optimalMin: number,
  optimalMax: number,
  normalMin: number,
  normalMax: number
): number {
  if (value >= optimalMin && value <= optimalMax) return 0
  const rangeSpan = normalMax - normalMin
  if (rangeSpan === 0) return 0.5
  let distance: number
  if (value < optimalMin) {
    distance = optimalMin - value
  } else {
    distance = value - optimalMax
  }
  const gravity = Math.min(distance / (rangeSpan * 0.5), 1.0)
  return Math.round(gravity * 100) / 100
}

export function calculatePersistence(
  currentState: string,
  previousRecords: BiomarkerRecord[]
): number {
  if (currentState === 'Optimal') return 0
  const outOfOptimal = previousRecords.filter(r => r.state !== 'Optimal')
  if (outOfOptimal.length === 0) return 0.3
  if (outOfOptimal.length === 1) return 0.6
  return 1.0
}

export function calculateConfidence(
  collectedAt: string,
  source: 'lab' | 'wearable' = 'lab'
): number {
  const now = new Date()
  const collected = new Date(collectedAt)
  const daysSince = (now.getTime() - collected.getTime()) / (1000 * 60 * 60 * 24)
  let baseConfidence: number
  if (source === 'lab') {
    if (daysSince <= 30) baseConfidence = 1.0
    else if (daysSince <= 90) baseConfidence = 0.9
    else if (daysSince <= 180) baseConfidence = 0.7
    else if (daysSince <= 365) baseConfidence = 0.5
    else baseConfidence = 0.3
  } else {
    if (daysSince <= 1) baseConfidence = 0.8
    else if (daysSince <= 7) baseConfidence = 0.6
    else baseConfidence = 0.3
  }
  return Math.round(baseConfidence * 100) / 100
}

export function calculateDecay(collectedAt: string): number {
  const now = new Date()
  const collected = new Date(collectedAt)
  const daysSince = (now.getTime() - collected.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince <= 30) return 1.0
  if (daysSince <= 90) return 0.85
  if (daysSince <= 180) return 0.7
  if (daysSince <= 365) return 0.4
  return 0.2
}

export function checkSafetyAlert(slug: string, value: number): boolean {
  const thresholds = SAFETY_THRESHOLDS[slug]
  if (!thresholds) return false
  if (thresholds.min !== undefined && value < thresholds.min) return true
  if (thresholds.max !== undefined && value > thresholds.max) return true
  return false
}

export function calculateRelevanceScore(
  gravity: number,
  persistence: number,
  confidence: number,
  decay: number
): number {
  const score = ((gravity * 0.4) + (persistence * 0.3) + (confidence * 0.2) + (decay * 0.1)) * 100
  return Math.round(score * 100) / 100
}

export function runDecisionEngine(
  biomarkers: BiomarkerRecord[],
  biologicalProfile: 'female' | 'male',
  historicalRecords: Record<string, BiomarkerRecord[]> = {}
): EngineResult {
  const CONFIDENCE_FLOOR = 0.5
  const scored: ScoredMarker[] = []
  const safetyAlerts: ScoredMarker[] = []

  for (const marker of biomarkers) {
    if (marker.flag_error || !marker.validated) continue
    const dictEntry = CANONICAL_DICTIONARY[marker.marker_name]
    if (!dictEntry) continue

    const optimal = biologicalProfile === 'female' ? dictEntry.optimalF : dictEntry.optimalM
    const normal = biologicalProfile === 'female' ? dictEntry.normalF : dictEntry.normalM
    const optMin = marker.optimal_range_min ?? optimal.min
    const optMax = marker.optimal_range_max ?? optimal.max
    const normMin = marker.reference_range_min ?? normal.min
    const normMax = marker.reference_range_max ?? normal.max

    const gravity = calculateGravity(marker.value, optMin, optMax, normMin, normMax)
    const persistence = calculatePersistence(
      marker.state,
      historicalRecords[marker.marker_name] || []
    )
    const confidence = calculateConfidence(marker.collected_at, 'lab')
    const decay = calculateDecay(marker.collected_at)

    if (confidence < CONFIDENCE_FLOOR) continue

    const score = calculateRelevanceScore(gravity, persistence, confidence, decay)
    const isSafetyAlert = checkSafetyAlert(marker.marker_name, marker.value)

    const scoredMarker: ScoredMarker = {
      slug: marker.marker_name,
      name: dictEntry.name,
      value: marker.value,
      unit: marker.unit,
      state: marker.state,
      gravity,
      persistence,
      confidence,
      decay,
      score,
      system: dictEntry.system,
      isSafetyAlert,
    }

    scored.push(scoredMarker)
    if (isSafetyAlert) {
      safetyAlerts.push(scoredMarker)
    }
  }

  scored.sort((a, b) => b.score - a.score)

  let dominant: ScoredMarker | null = null
  if (safetyAlerts.length > 0) {
    safetyAlerts.sort((a, b) => b.gravity - a.gravity)
    dominant = safetyAlerts[0]
  } else if (scored.length > 0) {
    dominant = scored[0]
  }

  return {
    dominant,
    all_scores: scored,
    safety_alerts: safetyAlerts,
    has_safety_alert: safetyAlerts.length > 0,
    confidence_floor_applied: CONFIDENCE_FLOOR,
    total_markers_analyzed: scored.length,
  }
}
