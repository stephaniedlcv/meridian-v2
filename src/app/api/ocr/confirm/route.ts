import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Use service role to bypass RLS for insert
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const collectedDate = collected_at || new Date().toISOString()

    // Build rows for insert
    const rows = (biomarkers as ConfirmedBiomarker[])
      .filter(b => !b.flag_error) // Don't save flagged errors
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
        validated: true, // User confirmed via staging modal
      }))

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

    return NextResponse.json({
      success: true,
      saved_count: rows.length,
      biomarkers: data,
    })
  } catch (error) {
    console.error('Confirm biomarkers error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
