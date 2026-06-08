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
  source_marker_name?: string
  source_raw_value?: string
  value: number | null
  unit: string | null
  reference_range_min: number | null
  reference_range_max: number | null
  optimal_range_min: number | null
  optimal_range_max: number | null
  state: string
  flag_error: boolean
  collected_at: string
  // Qualitative support fields (populated by the OCR pipeline for serology/urinalysis)
  extraction_status: 'parsed' | 'unreadable' | 'partial' | 'qualitative_only'
  qualitative_value: string | null
  panel_type?: string | null
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

function normalizeQualitativeValueForPersistence(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const plusMatch = trimmed.match(/^(\+{1,4}|[1-4]\+)$/)
  if (plusMatch) {
    const plusCount = trimmed.includes('+') && trimmed[0] === '+'
      ? trimmed.length
      : Number.parseInt(trimmed[0], 10)
    return `plus_${plusCount}`
  }

  let normalized = trimmed
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  const aliases: Record<string, string> = {
    nonreactive: 'non_reactive',
    non_reactive: 'non_reactive',
    notdetected: 'not_detected',
    not_detected: 'not_detected',
    none_seen: 'none_seen',
    non_seen: 'none_seen',
    no_seen: 'none_seen',
    1: 'plus_1',
    2: 'plus_2',
    3: 'plus_3',
    4: 'plus_4',
  }

  normalized = aliases[normalized] ?? normalized

  return VALID_QUALITATIVE_VALUES.has(normalized) ? normalized : null
}

export async function POST(request: NextRequest) {
  try {
    const { context, errorResponse } = await getAuthenticatedRouteContext()

    if (errorResponse || !context) {
      return errorResponse
    }

    const body = await request.json()
    const { user_id, biomarkers, collected_at, source_pdf_url, source_pdf_name, upload_session_id } = body

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
    const uploadSessionId = typeof upload_session_id === 'string' && upload_session_id.trim()
      ? upload_session_id.trim()
      : null
    const sourcePdfName = typeof source_pdf_name === 'string' && source_pdf_name.trim()
      ? source_pdf_name.trim()
      : null

    const rows = (biomarkers as ConfirmedBiomarker[])
      .filter(b => !b.flag_error)
      .flatMap(b => {
        const normalizedState = normalizeState(b.state || 'Optimal')
        if (normalizedState !== b.state) {
          console.warn('OCR state normalized before insert:', {
            slug: b.slug,
            sourceState: b.state,
            normalizedState,
          })
        }

        if (
          b.extraction_status === 'parsed' &&
          typeof b.value === 'number' &&
          Number.isFinite(b.value)
        ) {
          return [{
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
            upload_session_id:    uploadSessionId,
            source_pdf_name:      sourcePdfName,
            source_pdf_url:       source_pdf_url || null,
            flag_error:           false,
            validated:            true,
            result_type:          'quantitative',
            source_marker_name:   b.source_marker_name || b.name || null,
            source_raw_value:     b.source_raw_value || String(b.value),
            panel_type:           b.panel_type || null,
          }]
        }

        if (b.extraction_status === 'qualitative_only') {
          const qualitativeValue =
            normalizeQualitativeValueForPersistence(b.qualitative_value) ||
            normalizeQualitativeValueForPersistence(b.source_raw_value)

          if (!qualitativeValue) {
            console.warn('Qualitative biomarker skipped because value is not recognized:', {
              slug: b.slug,
              sourceRawValue: b.source_raw_value,
              qualitativeValue: b.qualitative_value,
            })
            return []
          }

          return [{
            user_id: context.user.id,
            marker_name:          b.slug,
            value:                null,
            unit:                 b.unit || null,
            reference_range_min:  null,
            reference_range_max:  null,
            optimal_range_min:    null,
            optimal_range_max:    null,
            state:                normalizedState,
            collected_at:         collectedDate,
            upload_session_id:    uploadSessionId,
            source_pdf_name:      sourcePdfName,
            source_pdf_url:       source_pdf_url || null,
            flag_error:           false,
            validated:            true,
            value_qualitative:    qualitativeValue,
            result_type:          'qualitative',
            source_marker_name:   b.source_marker_name || b.name || null,
            source_raw_value:     b.source_raw_value || qualitativeValue,
            panel_type:           b.panel_type || null,
          }]
        }

        return []
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

    const quantitative_count = rows.filter(row => row.result_type === 'quantitative').length
    const qualitative_count  = rows.filter(row => row.result_type === 'qualitative').length

    if (uploadSessionId) {
      const { error: sessionError } = await supabase
        .from('lab_upload_sessions')
        .update({
          status: 'confirmed',
          collected_at: collectedDate,
          confirmed_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          source_pdf_name: sourcePdfName,
          source_pdf_url: source_pdf_url || null,
          confirmed_count: rows.length,
          quantitative_count,
          qualitative_count,
          error_message: null,
        })
        .eq('id', uploadSessionId)
        .eq('user_id', context.user.id)

      if (sessionError) {
        console.warn('[Meridian] lab_upload_sessions confirm update failed:', sessionError.message)
      }
    }

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
