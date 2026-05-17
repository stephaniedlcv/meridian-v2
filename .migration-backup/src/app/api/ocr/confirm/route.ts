import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Qualitative result values that Meridian recognises and persists.
// Any value outside this set is rejected to prevent garbage data.
const VALID_QUALITATIVE_VALUES = new Set([
  'positive', 'negative',
  'reactive', 'non_reactive',
  'detected', 'not_detected',
  'equivocal', 'indeterminate',
])

interface ConfirmedBiomarker {
  slug: string
  name: string
  value: number
  unit: string
  reference_range_min: number | null
  reference_range_max: number | null
  optimal_range_min: number | null
  optimal_range_max: number | null
  state: 'Optimal' | 'Watch' | 'Attention' | 'Critical'
  flag_error: boolean
  collected_at: string
  // Qualitative support fields (populated by the OCR pipeline for serology/urinalysis)
  extraction_status: 'parsed' | 'unreadable' | 'partial' | 'qualitative_only'
  qualitative_value: string | null
}

function normalizeState(state: string): 'Optimal' | 'Watch' | 'Attention' | 'Critical' {
  const normalized = state.trim().toLowerCase()
  if (normalized === 'normal') return 'Optimal'
  if (normalized === 'low') return 'Watch'
  if (normalized === 'high') return 'Attention'
  if (normalized === 'critical') return 'Critical'
  if (normalized === 'attention') return 'Attention'
  if (normalized === 'watch') return 'Watch'
  return 'Optimal'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, biomarkers, collected_at, source_pdf_url } = body

    if (!user_id || !biomarkers || !Array.isArray(biomarkers)) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id or biomarkers array' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const collectedDate = collected_at || new Date().toISOString()

    // Separate quantitative (fully parsed numeric) from qualitative (serology/urinalysis) markers.
    // Both paths are valid for persistence; they differ only in which value column is populated.
    const rows = (biomarkers as ConfirmedBiomarker[])
      .filter(b => {
        if (b.flag_error) return false
        if (b.extraction_status === 'parsed') return true
        if (b.extraction_status === 'qualitative_only') {
          // Only persist qualitative values we explicitly recognise
          return typeof b.qualitative_value === 'string' &&
            VALID_QUALITATIVE_VALUES.has(b.qualitative_value)
        }
        return false
      })
      .map(b => {
        const isQualitative = b.extraction_status === 'qualitative_only'
        const normalizedState = normalizeState(b.state)
        if (normalizedState !== b.state) {
          console.warn('OCR state normalized before insert:', {
            slug: b.slug,
            sourceState: b.state,
            normalizedState,
          })
        }
        return {
          user_id,
          marker_name:          b.slug,
          value:                isQualitative ? null : b.value,
          value_qualitative:    isQualitative ? b.qualitative_value : null,
          unit:                 isQualitative ? '' : b.unit,
          reference_range_min:  isQualitative ? null : b.reference_range_min,
          reference_range_max:  isQualitative ? null : b.reference_range_max,
          optimal_range_min:    isQualitative ? null : b.optimal_range_min,
          optimal_range_max:    isQualitative ? null : b.optimal_range_max,
          state:                normalizedState,
          collected_at:         collectedDate,
          source_pdf_url:       source_pdf_url || null,
          flag_error:           false,
          validated:            true,
        }
      })

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid biomarkers to save' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('biomarkers_static')
      .insert(rows)
      .select()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    const quantitative_count = rows.filter(r => r.value !== null).length
    const qualitative_count  = rows.filter(r => r.value === null).length

    return NextResponse.json({
      success:            true,
      saved_count:        rows.length,
      quantitative_count,
      qualitative_count,
      biomarkers:         data,
    })
  } catch (error) {
    console.error('Confirm biomarkers error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
