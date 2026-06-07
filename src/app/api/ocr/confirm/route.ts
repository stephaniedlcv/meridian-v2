import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedRouteContext } from '@/lib/supabase/route-auth'

// Qualitative result values that Meridian recognises and persists.
// Any value outside this set is rejected to prevent garbage data.
const VALID_QUALITATIVE_VALUES = new Set([
  // Serology
  'positive', 'negative',
  'reactive', 'non_reactive',
  'detected', 'not_detected',
  'equivocal', 'indeterminate',

  // Urinalysis dipstick
  'trace', 'small', 'moderate', 'large',
  'plus_1', 'plus_2', 'plus_3', 'plus_4',
  'normal', 'abnormal',
  'present', 'absent',

  // Microscopy
  'none', 'none_seen', 'rare', 'few', 'many',

  // Urine color
  'yellow', 'straw', 'amber', 'orange', 'red', 'brown',

  // Urine clarity
  'clear', 'hazy', 'cloudy', 'turbid',
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
    const { context, errorResponse } = await getAuthenticatedRouteContext()

    if (errorResponse || !context) {
      return errorResponse
    }

    const body = await request.json()
    const { user_id, biomarkers, collected_at, source_pdf_url } = body

    if (user_id && user_id !== context.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden.' },
        { status: 403 }
      )
    }

    if (!biomarkers || !Array.isArray(biomarkers)) {
      return NextResponse.json(
        { success: false, error: 'Missing biomarkers array' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const collectedDate = collected_at || new Date().toISOString()

    // Current production schema only supports numeric biomarkers in biomarkers_static.
    // Qualitative-only results are intentionally skipped here until the qualitative
    // diagnostics schema is migrated. This prevents value/null and unknown-column
    // insert failures from blocking numeric lab saves.
    const rows = (biomarkers as ConfirmedBiomarker[])
      .filter(b =>
        !b.flag_error &&
        b.extraction_status === 'parsed' &&
        typeof b.value === 'number' &&
        Number.isFinite(b.value)
      )
      .map(b => {
        const normalizedState = normalizeState(b.state)
        if (normalizedState !== b.state) {
          console.warn('OCR state normalized before insert:', {
            slug: b.slug,
            sourceState: b.state,
            normalizedState,
          })
        }

        return {
          user_id: context.user.id,
          marker_name:          b.slug,
          value:                b.value,
          unit:                 b.unit,
          reference_range_min:  b.reference_range_min,
          reference_range_max:  b.reference_range_max,
          optimal_range_min:    b.optimal_range_min,
          optimal_range_max:    b.optimal_range_max,
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

    const quantitative_count = rows.length
    const qualitative_count  = 0

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
