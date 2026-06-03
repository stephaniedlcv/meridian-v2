import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedRouteContext } from '@/lib/supabase/route-auth'

// ── Pending Classification Queue ───────────────────────────────────────────────
// Stores unrecognized markers from OCR extraction that could not be confidently
// matched to a canonical biomarker slug.
//
// Future extensions (not yet implemented):
//   - manual classification / alias review UI
//   - custom user-defined markers
//   - canonical dictionary improvement workflow
//   - upload_session_id / source_pdf_hash linkage for traceability
//   - confidence score surfacing from OCR pipeline
//
// Pending records NEVER enter biomarkers_static, Labs snapshot, History panels,
// status counts, Needs Attention, or Dashboard signals.

interface PendingMarkerInput {
  raw_name: string
  raw_value: number
  raw_unit: string
  raw_reference_range: string | null
}

export async function POST(request: NextRequest) {
  try {
    const { context, errorResponse } = await getAuthenticatedRouteContext()

    if (errorResponse || !context) {
      return errorResponse
    }

    const body = await request.json()
    const { user_id, markers, collected_at, source_pdf_name } = body

    if (user_id && user_id !== context.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden.' },
        { status: 403 }
      )
    }

    if (!markers || !Array.isArray(markers)) {
      return NextResponse.json(
        { success: false, error: 'Missing markers array' },
        { status: 400 }
      )
    }

    if (markers.length === 0) {
      return NextResponse.json({ success: true, saved_count: 0 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const collectedDate = collected_at || new Date().toISOString()

    const rows = (markers as PendingMarkerInput[]).map(m => ({
      user_id: context.user.id,
      raw_name:             m.raw_name,
      raw_value:            m.raw_value,
      raw_unit:             m.raw_unit,
      raw_reference_range:  m.raw_reference_range ?? null,
      collected_at:         collectedDate,
      source_pdf_name:      source_pdf_name ?? null,
      status:               'pending_classification',
      reason:               'No confident match found in canonical biomarker dictionary',
    }))

    const { error } = await supabase
      .from('pending_biomarkers')
      .insert(rows)

    if (error) {
      console.error('[Meridian] pending_biomarkers insert error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, saved_count: rows.length })
  } catch (err) {
    console.error('[Meridian] /api/ocr/pending error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
