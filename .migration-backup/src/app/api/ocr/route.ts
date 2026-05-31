import { NextRequest, NextResponse } from 'next/server'
import {
  CANONICAL_DICTIONARY,
  matchMarkerToSlug,
  convertToCanonicalUnit,
  isImpossibleValue,
  classifyBiomarkerState,
  getCanonicalFallbackRange,
  type ExtractionStatus,
  type CanonicalMarker,
} from '@/lib/canonical-dictionary'

// Qualitative result values — used for serology, urinalysis, and other qualitative panels.
// Covers serology binary values, urinalysis semi-quantitative ordinals, and microscopy counts.
type QualitativeValue =
  // Serology / infectious disease
  | 'reactive' | 'non_reactive'
  | 'positive' | 'negative'
  | 'detected' | 'not_detected'
  | 'indeterminate' | 'equivocal'
  // Urinalysis dipstick / semi-quantitative
  | 'trace' | 'small' | 'moderate' | 'large'
  | 'plus_1' | 'plus_2' | 'plus_3' | 'plus_4'
  | 'normal' | 'abnormal'
  | 'present' | 'absent'
  // Microscopy counts
  | 'none' | 'none_seen' | 'rare' | 'few' | 'many'
  // Urine color
  | 'yellow' | 'straw' | 'amber' | 'orange' | 'red' | 'brown'
  // Urine clarity
  | 'clear' | 'hazy' | 'cloudy' | 'turbid'

const QUALITATIVE_VALUE_MAP: Record<string, QualitativeValue> = {
  // Serology
  'reactive':           'reactive',
  'non reactive':       'non_reactive',
  'non-reactive':       'non_reactive',
  'nonreactive':        'non_reactive',
  'positive':           'positive',
  'pos':                'positive',
  'negative':           'negative',
  'neg':                'negative',
  'detected':           'detected',
  'not detected':       'not_detected',
  'not-detected':       'not_detected',
  'notdetected':        'not_detected',
  'indeterminate':      'indeterminate',
  'equivocal':          'equivocal',
  // Urinalysis semi-quantitative
  'trace':              'trace',
  'small':              'small',
  'moderate':           'moderate',
  'large':              'large',
  '1+':                 'plus_1',
  '2+':                 'plus_2',
  '3+':                 'plus_3',
  '4+':                 'plus_4',
  'normal':             'normal',
  'abnormal':           'abnormal',
  'present':            'present',
  'absent':             'absent',
  // Microscopy counts
  'none':               'none',
  'none seen':          'none_seen',
  'rare':               'rare',
  'few':                'few',
  'many':               'many',
  // Urine color
  'yellow':             'yellow',
  'straw':              'straw',
  'amber':              'amber',
  'orange':             'orange',
  'red':                'red',
  'brown':              'brown',
  // Urine clarity
  'clear':              'clear',
  'hazy':               'hazy',
  'cloudy':             'cloudy',
  'turbid':             'turbid',
}

function normalizeQualitativeValue(raw: string): QualitativeValue | null {
  const n = raw.toLowerCase().trim()
  return QUALITATIVE_VALUE_MAP[n] ?? null
}

// ── Panel context marker sets ─────────────────────────────────────────────────
// CMP / serum chemistry markers — 2+ of these in a batch signals the extraction
// is from a serum panel, not a urinalysis panel.
const CMP_SERUM_CONTEXT_SLUGS = new Set([
  'bun', 'creatinine', 'bun_creatinine_ratio',
  'egfr', 'egfr_african_american', 'egfr_non_african_american',
  'sodium', 'potassium', 'chloride', 'co2', 'calcium', 'anion_gap',
  'ast', 'alt', 'alkaline_phosphatase', 'bilirubin_total',
  'albumin', 'total_protein', 'globulin', 'ag_ratio',
  'glucose_fasting', 'hba1c',
  // Lipid panel — strong serum context signal
  'total_cholesterol', 'hdl', 'ldl', 'triglycerides',
])

// Urinalysis slug → serum counterpart reclassify map.
// Used by:
//   a) the per-marker type-mismatch guard (qualitative-typed slug + numeric value)
//   b) the post-extraction CMP context pass (batch-level panel inference)
const URINE_TO_SERUM_RECLASSIFY: Record<string, string> = {
  urine_glucose_ua: 'glucose_fasting',
  // urine_protein_ua intentionally omitted — no unambiguous 1:1 serum counterpart
}


function hasUrinalysisContext(raws: RawExtraction[]): boolean {
  const text = raws.map(r => String(r.name || '').toLowerCase()).join(' | ')
  const clues = [
    'color', 'appearance', 'clarity', 'specific gravity', 'nitrite',
    'leukocyte', 'urobilinogen', 'ketone', 'bilirubin', 'blood',
    'bacteria', 'epithelial', 'mucus', 'casts', 'crystals'
  ]
  return clues.filter(c => text.includes(c)).length >= 2
}

function forcedUrinalysisSlug(raw: RawExtraction): string | null {
  const name = String(raw.name || '').toLowerCase().trim()
  const unit = String(raw.unit || '').toLowerCase().trim()
  const valueIsText = typeof raw.value === 'string'
  const hpfContext = unit.includes('hpf') || unit.includes('/hpf')

  const exact: Record<string, string> = {
    color: 'urine_color',
    appearance: 'urine_clarity',
    clarity: 'urine_clarity',
    'specific gravity': 'urine_specific_gravity',
    ph: 'urine_ph',
    glucose: 'urine_glucose_ua',
    protein: 'urine_protein_ua',
    blood: 'urine_blood_ua',
    ketone: 'urine_ketones_ua',
    ketones: 'urine_ketones_ua',
    bilirubin: 'urine_bilirubin_ua',
    urobilinogen: 'urine_urobilinogen_ua',
    nitrite: 'urine_nitrite_ua',
    nitrites: 'urine_nitrite_ua',
    leukocytes: 'urine_leukocyte_esterase_ua',
    'leukocyte esterase': 'urine_leukocyte_esterase_ua',
    bacteria: 'urine_bacteria_hpf',
    'epithelial cells': 'urine_epithelial_cells_hpf',
    mucus: 'urine_mucus_hpf',
    casts: 'urine_casts_hpf',
  }

  if (exact[name]) return exact[name]

  if ((name == 'wbc' || name == 'white blood cells') && (valueIsText || hpfContext)) return 'urine_wbc_hpf'
  if ((name == 'rbc' || name == 'red blood cells') && (valueIsText || hpfContext)) return 'urine_rbc_hpf'

  return null
}

function shouldIgnoreUrinalysisMetadata(raw: RawExtraction): boolean {
  const name = String(raw.name || '').toLowerCase().trim()
  return name === 'type' || name === 'specimen type'
}


function forcedCbcDifferentialSlug(raw: RawExtraction): string | null {
  const name = String(raw.name || '').toLowerCase().trim()
  const unit = String(raw.unit || '').toLowerCase().trim()

  const isImmatureGranulocyte =
    name.includes('immature granulocytes') ||
    name.includes('immature granulocyte') ||
    name.includes('immature granulocites') ||
    name.includes('immature granulocite')

  if (!isImmatureGranulocyte) {
    return null
  }

  if (name.includes('#') || unit.includes('10') || unit.includes('k/') || unit.includes('/ul') || unit.includes('/µl')) {
    return 'immature_granulocytes_abs'
  }

  if (name.includes('%') || unit.includes('%') || unit === '') {
    return 'immature_granulocytes_pct'
  }

  return null
}

// qualitativeStateFromValue resolves the clinical state for a qualitative result.
// Checks the marker's per-entry qualitative_state_map first (if present), then
// falls back to the generic serology defaults (reactive → Attention, etc.).
function qualitativeStateFromValue(
  qv: QualitativeValue | null,
  marker?: CanonicalMarker,
): 'Optimal' | 'Watch' | 'Attention' {
  if (!qv) return 'Watch'
  if (marker?.qualitative_state_map?.[qv]) {
    return marker.qualitative_state_map[qv]
  }
  switch (qv) {
    case 'reactive':
    case 'positive':
    case 'detected':
      return 'Attention'
    case 'indeterminate':
    case 'equivocal':
      return 'Watch'
    default:
      return 'Optimal'
  }
}

// Claude may return a number (quantitative), a string (qualitative text), or null (unparseable).
interface RawExtraction {
  name: string
  value: number | string | null
  unit: string
  reference_range?: string | null
}

interface StagedBiomarker {
  slug: string
  name: string
  source_marker_name: string
  source_raw_value: string
  qualitative_value: string | null
  extraction_status: ExtractionStatus
  value: number
  unit: string
  original_value: number
  original_unit: string
  converted: boolean
  reference_range_min: number | null
  reference_range_max: number | null
  optimal_range_min: number | null
  optimal_range_max: number | null
  state: 'Normal' | 'Low' | 'High' | 'Optimal' | 'Watch' | 'Attention' | 'Critical'
  flag_error: boolean
  error_reason: string | null
  matched: boolean
}

interface OCRResponse {
  success: boolean
  staged_biomarkers: StagedBiomarker[]
  unmatched: RawExtraction[]
  total_extracted: number
  total_matched: number
  total_errors: number
  lab_date: string | null
}

const EXTRACTION_PROMPT = `You are a medical lab report parser. Extract ALL biomarker results from this lab report, including standard blood panels, urinalysis, and serology/infectious disease tests.

IMPORTANT: Also extract the date when the lab was collected or reported. Look for "Collection Date", "Date Collected", "Report Date", "Date of Service", "Specimen Collected", or similar fields.

Return a JSON object with two fields:
1. "lab_date": the collection/report date in YYYY-MM-DD format, or null if not found
2. "biomarkers": array of biomarker objects

For each biomarker found, return:
- name: the biomarker name exactly as written in the report
- value: use the following rules:
  • Numeric result → return the number (e.g. 3.03, 1.015, 5)
  • Qualitative / text result → return the exact text as a string (e.g. "NON REACTIVE", "NEGATIVE", "TRACE", "MODERATE", "CLOUDY", "YELLOW", "NONE SEEN", "RARE", "FEW")
  • Cannot read / illegible → return null
- unit: the unit exactly as written; use "" when there is no unit (qualitative results, color, clarity, etc.)
- reference_range: the reference range string if shown, or null if not present

URINALYSIS: Extract ALL urinalysis fields including Color, Clarity, pH, Specific Gravity, and all dipstick results (Glucose, Protein, Blood, Ketones, Bilirubin, Urobilinogen, Nitrite, Leukocyte Esterase) and all microscopy results (WBC /hpf, RBC /hpf, Bacteria, Epithelial Cells, Casts, Mucus). Use the text result for dipstick/qualitative fields (e.g. "NEGATIVE", "TRACE", "1+", "CLOUDY").

IMPORTANT: Include ALL fields from the report. Do NOT skip urinalysis results.

If a biomarker appears multiple times, include it ONCE — use the most specific or primary result.

Return ONLY valid JSON. No explanations, no markdown, no extra text.

Example output:
{
  "lab_date": "2025-03-15",
  "biomarkers": [
    {"name": "TSH", "value": 3.03, "unit": "mIU/L", "reference_range": "0.40-4.00"},
    {"name": "Vitamin D, 25-OH", "value": 23, "unit": "ng/mL", "reference_range": "30-100"},
    {"name": "Color", "value": "YELLOW", "unit": "", "reference_range": null},
    {"name": "Clarity", "value": "CLEAR", "unit": "", "reference_range": null},
    {"name": "pH", "value": 6.0, "unit": "", "reference_range": "4.5-8.5"},
    {"name": "Specific Gravity", "value": 1.015, "unit": "", "reference_range": "1.005-1.030"},
    {"name": "Glucose", "value": "NEGATIVE", "unit": "", "reference_range": null},
    {"name": "Protein", "value": "TRACE", "unit": "", "reference_range": null},
    {"name": "Nitrite", "value": "NEGATIVE", "unit": "", "reference_range": null},
    {"name": "WBC /hpf", "value": 2, "unit": "/hpf", "reference_range": "0-5"},
    {"name": "Bacteria", "value": "NONE SEEN", "unit": "", "reference_range": null},
    {"name": "HEPATITIS A IgM AB", "value": "NON REACTIVE", "unit": "", "reference_range": null},
    {"name": "HEPATITIS Bs ANTIGEN", "value": "REACTIVE", "unit": "", "reference_range": null}
  ]
}`

function parseReferenceRange(rangeStr: string | undefined): { min: number | null; max: number | null } {
  if (!rangeStr) return { min: null, max: null }
  // Numeric dash range: "0.4-4.0", "0.4–4.0", "0.4—4.0"
  const dashMatch = rangeStr.match(/([\d.]+)\s*[-–—]\s*([\d.]+)/)
  if (dashMatch) {
    return { min: parseFloat(dashMatch[1]), max: parseFloat(dashMatch[2]) }
  }
  // Qualitative upper bound: "< 2.5", "<= 2.5", "=< 2.5"
  const ltMatch = rangeStr.match(/^[<＜]=?\s*([\d.]+)/)
  if (ltMatch) {
    return { min: null, max: parseFloat(ltMatch[1]) }
  }
  // Qualitative lower bound: "> 60", ">= 60", "=> 60"
  const gtMatch = rangeStr.match(/^[>＞]=?\s*([\d.]+)/)
  if (gtMatch) {
    return { min: parseFloat(gtMatch[1]), max: null }
  }
  return { min: null, max: null }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pdf_base64, user_id, biological_profile } = body

    if (!pdf_base64 || !user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing pdf_base64 or user_id' },
        { status: 400 }
      )
    }

    const bioProfile = biological_profile || 'female'

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdf_base64,
                },
              },
              {
                type: 'text',
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      console.error('Claude API error:', errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to process PDF with Claude API' },
        { status: 500 }
      )
    }

    const anthropicData = await anthropicResponse.json()
    const rawText = anthropicData.content
      .map((block: { type: string; text?: string }) => block.type === 'text' ? block.text : '')
      .join('')

    // Parse Claude's response — now expecting { lab_date, biomarkers }
    let rawExtractions: RawExtraction[] = []
    let labDate: string | null = null

    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)

      // Handle both old format (array) and new format (object with lab_date)
      if (Array.isArray(parsed)) {
        rawExtractions = parsed
      } else {
        labDate = parsed.lab_date || null
        rawExtractions = parsed.biomarkers || []
      }
    } catch {
      console.error('Failed to parse Claude response:', rawText)
      return NextResponse.json(
        { success: false, error: 'Failed to parse extracted biomarkers' },
        { status: 500 }
      )
    }

    // Deduplicate: keep only first occurrence of each matched slug.
    // Urinalysis microscopy markers with different units (e.g. bacteria /hpf vs /µL)
    // are separate dictionary slugs and naturally avoid deduplication.
    const seenSlugs = new Set<string>()
    const stagedBiomarkers: StagedBiomarker[] = []
    // unmatched uses numeric value; non-numeric values are coerced to 0 to keep
    // the pending_biomarkers DB column (numeric) type-safe.
    const unmatched: Array<{ name: string; value: number; unit: string; reference_range?: string }> = []
    const urinalysisContext = hasUrinalysisContext(rawExtractions)

    for (const raw of rawExtractions) {
      const rawValueIsNull   = raw.value === null || raw.value === undefined
      const rawValueIsString = !rawValueIsNull && typeof raw.value === 'string'

      if (urinalysisContext && shouldIgnoreUrinalysisMetadata(raw)) {
        continue
      }

      const urineOverrideSlug = urinalysisContext ? forcedUrinalysisSlug(raw) : null
      const cbcOverrideSlug = forcedCbcDifferentialSlug(raw)
      const slug = urineOverrideSlug ?? cbcOverrideSlug ?? matchMarkerToSlug(raw.name)

      if (!slug) {
        unmatched.push({
          name: raw.name,
          value: (rawValueIsNull || rawValueIsString) ? 0 : (raw.value as number),
          unit: raw.unit,
          reference_range: raw.reference_range ?? undefined,
        })
        continue
      }

      // Skip duplicates — keep the first match for each slug
      if (seenSlugs.has(slug)) continue

      // ── Per-marker type-mismatch guard ────────────────────────────────────
      // If the matched slug resolves to a qualitative/urinalysis marker but
      // Claude returned a numeric value, the slug is almost certainly wrong.
      // A known serum counterpart exists: reclassify before staging so the
      // downstream branches receive the correct marker and value type.
      //
      // Example: "Glucose - FBS" → urine_glucose_ua (fuzzy alias collision)
      //          value = 95 (numeric) → reclassify to glucose_fasting
      let finalSlug = slug
      if (!rawValueIsNull && !rawValueIsString) {
        const serumCounterpart = URINE_TO_SERUM_RECLASSIFY[slug]
        if (serumCounterpart && !seenSlugs.has(serumCounterpart) && CANONICAL_DICTIONARY[serumCounterpart]) {
          finalSlug = serumCounterpart
        }
      }

      seenSlugs.add(finalSlug)

      const marker = CANONICAL_DICTIONARY[finalSlug]

      // ── Qualitative branch ─────────────────────────────────────────────────
      // Fires when:
      //   a) the marker's dictionary entry declares result_type: 'qualitative', OR
      //   b) Claude returned a text value (e.g. "NON REACTIVE", "TRACE", "CLOUDY")
      // Covers serology, urinalysis dipstick, microscopy counts, and color/clarity.
      if (marker.result_type === 'qualitative' || rawValueIsString) {
        const rawStr = rawValueIsNull ? '' : String(raw.value)
        const qv = rawStr ? normalizeQualitativeValue(rawStr) : null
        const state = qualitativeStateFromValue(qv, marker)

        stagedBiomarkers.push({
          slug: finalSlug,
          name: marker.name,
          source_marker_name: raw.name,
          source_raw_value: rawStr,
          qualitative_value: qv,
          extraction_status: 'qualitative_only',
          value: 0,
          unit: '',
          original_value: 0,
          original_unit: rawStr,
          converted: false,
          reference_range_min: null,
          reference_range_max: null,
          optimal_range_min: null,
          optimal_range_max: null,
          state,
          flag_error: false,
          error_reason: null,
          matched: true,
        })
        continue
      }

      // ── Extraction safety check ────────────────────────────────────────────
      // A null value or a value that is not finite after conversion must NEVER
      // reach the state classifier. Classifying 0 / NaN produces false Criticals.
      // Mark as unreadable; the UI shows "Needs Review" instead of a health state.
      if (rawValueIsNull) {
        stagedBiomarkers.push({
          slug: finalSlug,
          name: marker.name,
          source_marker_name: raw.name,
          source_raw_value: '',
          qualitative_value: null,
          extraction_status: 'unreadable',
          value: NaN,
          unit: raw.unit,
          original_value: NaN,
          original_unit: raw.unit,
          converted: false,
          reference_range_min: null,
          reference_range_max: null,
          optimal_range_min: null,
          optimal_range_max: null,
          state: 'Watch',
          flag_error: true,
          error_reason: 'Value could not be parsed from the lab report',
          matched: true,
        })
        continue
      }

      // ── Quantitative branch ────────────────────────────────────────────────
      const numericValue = raw.value as number
      const converted = convertToCanonicalUnit(finalSlug, numericValue, raw.unit)

      // Second safety check: ensure conversion produced a finite number.
      if (!Number.isFinite(converted.value)) {
        stagedBiomarkers.push({
          slug: finalSlug,
          name: marker.name,
          source_marker_name: raw.name,
          source_raw_value: String(numericValue),
          qualitative_value: null,
          extraction_status: 'unreadable',
          value: NaN,
          unit: raw.unit,
          original_value: numericValue,
          original_unit: raw.unit,
          converted: false,
          reference_range_min: null,
          reference_range_max: null,
          optimal_range_min: null,
          optimal_range_max: null,
          state: 'Watch',
          flag_error: true,
          error_reason: 'Value could not be parsed from the lab report',
          matched: true,
        })
        continue
      }

      const impossible = isImpossibleValue(finalSlug, converted.value)
      const optRange = bioProfile === 'female' ? marker.optimalF : marker.optimalM
      const state = impossible ? 'Critical' : classifyBiomarkerState(finalSlug, converted.value, bioProfile)

      // ── Reference range: 3-tier resolution ────────────────────────────────
      // Tier 1: PDF-extracted range, sanity-checked against physiological bounds.
      // Tier 2: Canonical clinical reference range (normalF / normalM).
      // A PDF range is accepted only when both bounds are present, min < max,
      // and both values sit within the physiologically possible bounds for this marker.
      const rawRefRange = parseReferenceRange(raw.reference_range ?? undefined)
      const pdfRangeSane = (
        rawRefRange.min !== null &&
        rawRefRange.max !== null &&
        rawRefRange.min < rawRefRange.max &&
        rawRefRange.min >= marker.impossibleMin &&
        rawRefRange.max <= marker.impossibleMax
      )
      const dictRange = getCanonicalFallbackRange(finalSlug, bioProfile)
      const refRange = {
        min: pdfRangeSane ? rawRefRange.min : (dictRange?.min ?? null),
        max: pdfRangeSane ? rawRefRange.max : (dictRange?.max ?? null),
      }

      stagedBiomarkers.push({
        slug: finalSlug,
        name: marker.name,
        source_marker_name: raw.name,
        source_raw_value: String(numericValue),
        qualitative_value: null,
        extraction_status: impossible ? 'partial' : 'parsed',
        value: converted.value,
        unit: converted.unit,
        original_value: numericValue,
        original_unit: raw.unit,
        converted: converted.converted,
        reference_range_min: refRange.min,
        reference_range_max: refRange.max,
        optimal_range_min: optRange.min,
        optimal_range_max: optRange.max,
        state,
        flag_error: impossible,
        error_reason: impossible
          ? `Value ${converted.value} ${converted.unit} is outside the physically possible range for ${marker.name}`
          : null,
        matched: true,
      })
    }

    // ── Context-aware CMP panel disambiguation pass ───────────────────────────
    // After all individual markers are extracted, check whether the batch has
    // strong serum/chemistry context (≥2 CMP marker slugs present). If so, any
    // urinalysis-typed marker that was staged as qualitative_only but whose
    // source_raw_value is a parseable number is a likely misclassification.
    // Rebuild those entries as quantitative serum markers using their counterpart.
    //
    // This pass catches edge cases the per-marker type-mismatch guard cannot:
    // e.g. a future alias collision where the guard did not apply because the
    // resolved slug was not in URINE_TO_SERUM_RECLASSIFY at guard time.
    const batchSlugs = new Set(stagedBiomarkers.map(b => b.slug))
    const cmpContextCount = [...batchSlugs].filter(s => CMP_SERUM_CONTEXT_SLUGS.has(s)).length

    if (cmpContextCount >= 2) {
      for (let i = stagedBiomarkers.length - 1; i >= 0; i--) {
        const b = stagedBiomarkers[i]
        const serumSlug = URINE_TO_SERUM_RECLASSIFY[b.slug]
        if (!serumSlug) continue
        if (batchSlugs.has(serumSlug)) continue           // serum already staged — don't duplicate
        if (b.extraction_status !== 'qualitative_only') continue

        // Only reclassify if the source was clearly numeric (genuine qualitative = real urine result)
        const numericSource = parseFloat(b.source_raw_value)
        if (!Number.isFinite(numericSource) || numericSource <= 0) continue

        const serumMarker = CANONICAL_DICTIONARY[serumSlug]
        if (!serumMarker) continue

        const convResult = convertToCanonicalUnit(serumSlug, numericSource, b.original_unit)
        if (!Number.isFinite(convResult.value)) continue

        const imp = isImpossibleValue(serumSlug, convResult.value)
        const serumState = imp ? 'Critical' : classifyBiomarkerState(serumSlug, convResult.value, bioProfile)
        const optR = bioProfile === 'female' ? serumMarker.optimalF : serumMarker.optimalM

        stagedBiomarkers[i] = {
          slug: serumSlug,
          name: serumMarker.name,
          source_marker_name: b.source_marker_name,
          source_raw_value: b.source_raw_value,
          qualitative_value: null,
          extraction_status: imp ? 'partial' : 'parsed',
          value: convResult.value,
          unit: convResult.unit,
          original_value: numericSource,
          original_unit: b.original_unit,
          converted: convResult.converted,
          reference_range_min: b.reference_range_min,
          reference_range_max: b.reference_range_max,
          optimal_range_min: optR.min,
          optimal_range_max: optR.max,
          state: serumState,
          flag_error: imp,
          error_reason: imp
            ? `Value ${convResult.value} ${convResult.unit} is outside the physically possible range for ${serumMarker.name}`
            : null,
          matched: true,
        }
        batchSlugs.delete(b.slug)
        batchSlugs.add(serumSlug)
      }
    }

    const response: OCRResponse = {
      success: true,
      staged_biomarkers: stagedBiomarkers,
      unmatched,
      total_extracted: rawExtractions.length,
      total_matched: stagedBiomarkers.length,
      total_errors: stagedBiomarkers.filter(b => b.flag_error).length,
      lab_date: labDate,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('OCR Pipeline error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
