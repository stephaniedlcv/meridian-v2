import { NextRequest, NextResponse } from 'next/server'
import {
  CANONICAL_DICTIONARY,
  matchMarkerToSlug,
  convertToCanonicalUnit,
  isImpossibleValue,
  classifyBiomarkerState,
} from '@/lib/canonical-dictionary'

interface RawExtraction {
  name: string
  value: number
  unit: string
  reference_range?: string
}

interface StagedBiomarker {
  slug: string
  name: string
  source_marker_name: string
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

interface OCRResponse {
  success: boolean
  staged_biomarkers: StagedBiomarker[]
  unmatched: RawExtraction[]
  total_extracted: number
  total_matched: number
  total_errors: number
  lab_date: string | null
}

const EXTRACTION_PROMPT = `You are a medical lab report parser. Extract ALL biomarker results from this lab report.

IMPORTANT: Also extract the date when the lab was collected or reported. Look for "Collection Date", "Date Collected", "Report Date", "Date of Service", "Specimen Collected", or similar fields.

Return a JSON object with two fields:
1. "lab_date": the collection/report date in YYYY-MM-DD format, or null if not found
2. "biomarkers": array of biomarker objects

For each biomarker found, return:
- name: the biomarker name exactly as written in the report
- value: the numeric value (number only, no text)
- unit: the unit of measurement exactly as written
- reference_range: the reference range string if shown — include dash-style ranges (e.g. "0.4-4.0"), qualitative ranges (e.g. "< 2.0", "> 60", "<= 100"), or any other format exactly as written

IMPORTANT: If a biomarker appears multiple times (e.g. from different sections), only include it ONCE — use the most specific or primary result.

Return ONLY valid JSON. No explanations, no markdown, no extra text.

Example output:
{
  "lab_date": "2025-03-15",
  "biomarkers": [
    {"name": "TSH", "value": 3.03, "unit": "mIU/L", "reference_range": "0.40-4.00"},
    {"name": "Vitamin D, 25-OH", "value": 23, "unit": "ng/mL", "reference_range": "30-100"}
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

    // Deduplicate: keep only first occurrence of each matched slug
    const seenSlugs = new Set<string>()
    const stagedBiomarkers: StagedBiomarker[] = []
    const unmatched: RawExtraction[] = []

    for (const raw of rawExtractions) {
      const slug = matchMarkerToSlug(raw.name)

      if (!slug) {
        unmatched.push(raw)
        continue
      }

      // Skip duplicates — keep the first match
      if (seenSlugs.has(slug)) {
        continue
      }
      seenSlugs.add(slug)

      const marker = CANONICAL_DICTIONARY[slug]
      const converted = convertToCanonicalUnit(slug, raw.value, raw.unit)
      const impossible = isImpossibleValue(slug, converted.value)
      const refRange = parseReferenceRange(raw.reference_range)
      const optRange = bioProfile === 'female' ? marker.optimalF : marker.optimalM
      const state = impossible ? 'Critical' : classifyBiomarkerState(slug, converted.value, bioProfile)

      stagedBiomarkers.push({
        slug,
        name: marker.name,
        source_marker_name: raw.name,
        value: converted.value,
        unit: converted.unit,
        original_value: raw.value,
        original_unit: raw.unit,
        converted: converted.converted,
        reference_range_min: refRange.min,
        reference_range_max: refRange.max,
        optimal_range_min: optRange.min,
        optimal_range_max: optRange.max,
        state,
        flag_error: impossible,
        error_reason: impossible ? `Value ${converted.value} ${converted.unit} is outside physically possible range for ${marker.name}` : null,
        matched: true,
      })
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
