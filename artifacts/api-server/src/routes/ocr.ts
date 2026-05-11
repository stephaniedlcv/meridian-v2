import { Router } from 'express'
import {
  CANONICAL_DICTIONARY,
  matchMarkerToSlug,
  convertToCanonicalUnit,
  isImpossibleValue,
  classifyBiomarkerState,
} from '../lib/canonical-dictionary'

const router = Router()

interface RawExtraction {
  name: string
  value: number
  unit: string
  reference_range?: string
}

interface StagedBiomarker {
  slug: string; name: string; value: number; unit: string
  original_value: number; original_unit: string; converted: boolean
  reference_range_min: number | null; reference_range_max: number | null
  optimal_range_min: number | null; optimal_range_max: number | null
  state: 'Optimal' | 'Watch' | 'Attention' | 'Critical'
  flag_error: boolean; error_reason: string | null; matched: boolean
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
- reference_range: the reference range string if shown (e.g. "0.4-4.0")

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
  const dashMatch = rangeStr.match(/([\d.]+)\s*[-\u2013\u2014]\s*([\d.]+)/)
  if (dashMatch) return { min: parseFloat(dashMatch[1]), max: parseFloat(dashMatch[2]) }
  return { min: null, max: null }
}

router.post('/ocr', async (req, res) => {
  try {
    const { pdf_base64, user_id, biological_profile } = req.body
    if (!pdf_base64 || !user_id) {
      return res.status(400).json({ success: false, error: 'Missing pdf_base64 or user_id' })
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
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        }],
      }),
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      console.error('Claude API error:', errorText)
      return res.status(500).json({ success: false, error: 'Failed to process PDF with Claude API' })
    }

    const anthropicData = await anthropicResponse.json() as { content: { type: string; text?: string }[] }
    const rawText = anthropicData.content
      .map((block) => block.type === 'text' ? block.text : '')
      .join('')

    let rawExtractions: RawExtraction[] = []
    let labDate: string | null = null

    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        rawExtractions = parsed
      } else {
        labDate = parsed.lab_date || null
        rawExtractions = parsed.biomarkers || []
      }
    } catch {
      console.error('Failed to parse Claude response:', rawText)
      return res.status(500).json({ success: false, error: 'Failed to parse extracted biomarkers' })
    }

    const seenSlugs = new Set<string>()
    const stagedBiomarkers: StagedBiomarker[] = []
    const unmatched: RawExtraction[] = []

    for (const raw of rawExtractions) {
      const slug = matchMarkerToSlug(raw.name)
      if (!slug) { unmatched.push(raw); continue }
      if (seenSlugs.has(slug)) continue
      seenSlugs.add(slug)

      const marker = CANONICAL_DICTIONARY[slug]
      const converted = convertToCanonicalUnit(slug, raw.value, raw.unit)
      const impossible = isImpossibleValue(slug, converted.value)
      const refRange = parseReferenceRange(raw.reference_range)
      const optRange = bioProfile === 'female' ? marker.optimalF : marker.optimalM
      const state = impossible ? 'Critical' : classifyBiomarkerState(slug, converted.value, bioProfile as 'female' | 'male')

      stagedBiomarkers.push({
        slug, name: marker.name,
        value: converted.value, unit: converted.unit,
        original_value: raw.value, original_unit: raw.unit,
        converted: converted.converted,
        reference_range_min: refRange.min, reference_range_max: refRange.max,
        optimal_range_min: optRange.min, optimal_range_max: optRange.max,
        state, flag_error: impossible,
        error_reason: impossible ? `Value ${converted.value} ${converted.unit} is outside physically possible range for ${marker.name}` : null,
        matched: true,
      })
    }

    return res.json({
      success: true,
      staged_biomarkers: stagedBiomarkers,
      unmatched,
      total_extracted: rawExtractions.length,
      total_matched: stagedBiomarkers.length,
      total_errors: stagedBiomarkers.filter(b => b.flag_error).length,
      lab_date: labDate,
    })
  } catch (error) {
    console.error('OCR Pipeline error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/ocr/confirm', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const { user_id, biomarkers, collected_at, source_pdf_url } = req.body

    if (!user_id || !biomarkers || !Array.isArray(biomarkers)) {
      return res.status(400).json({ success: false, error: 'Missing user_id or biomarkers array' })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const collectedDate = collected_at || new Date().toISOString()

    const rows = (biomarkers as StagedBiomarker[])
      .filter(b => !b.flag_error)
      .map(b => ({
        user_id,
        marker_name: b.slug,
        value: b.value,
        unit: b.unit,
        reference_range_min: b.reference_range_min,
        reference_range_max: b.reference_range_max,
        optimal_range_min: b.optimal_range_min,
        optimal_range_max: b.optimal_range_max,
        state: b.state,
        collected_at: collectedDate,
        source_pdf_url: source_pdf_url || null,
        flag_error: false,
        validated: true,
      }))

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid biomarkers to save' })
    }

    const { data, error } = await supabase
      .from('biomarkers_static')
      .insert(rows)
      .select()

    if (error) {
      console.error('Supabase insert error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }

    return res.json({ success: true, saved_count: rows.length, biomarkers: data })
  } catch (error) {
    console.error('Confirm biomarkers error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
