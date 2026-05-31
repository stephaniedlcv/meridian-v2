export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runDecisionEngine, BiomarkerRecord } from '@/lib/decision-engine'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id parameter' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('biological_profile, medications, safety_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      )
    }

    const biologicalProfile = (profile.biological_profile as 'female' | 'male') || 'female'

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const { data: biomarkers, error: bioError } = await supabase
      .from('biomarkers_static')
      .select('*')
      .eq('user_id', userId)
      .eq('flag_error', false)
      .eq('validated', true)
      .gte('collected_at', oneYearAgo.toISOString())
      .order('collected_at', { ascending: false })

    if (bioError) {
      console.error('Biomarkers query error:', bioError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch biomarkers' },
        { status: 500 }
      )
    }

    if (!biomarkers || biomarkers.length === 0) {
      return NextResponse.json({
        success: true,
        state: 'no_data',
        message: 'No biomarker data available. Upload a lab PDF to get started.',
        dominant: null,
        all_scores: [],
        safety_alerts: [],
      })
    }

    const latestByMarker = new Map<string, BiomarkerRecord>()
    const historicalByMarker: Record<string, BiomarkerRecord[]> = {}

    for (const record of biomarkers as BiomarkerRecord[]) {
      if (!historicalByMarker[record.marker_name]) {
        historicalByMarker[record.marker_name] = []
      }
      historicalByMarker[record.marker_name].push(record)

      if (!latestByMarker.has(record.marker_name)) {
        latestByMarker.set(record.marker_name, record)
      }
    }

    const latestBiomarkers = Array.from(latestByMarker.values())

    const result = runDecisionEngine(
      latestBiomarkers,
      biologicalProfile,
      historicalByMarker
    )

    let state: string
    if (result.has_safety_alert) {
      state = 'safety_alert'
    } else if (result.dominant && result.dominant.score > 30) {
      state = 'solved'
    } else if (result.total_markers_analyzed > 0) {
      state = 'calibrating'
    } else {
      state = 'no_data'
    }

    return NextResponse.json({
      success: true,
      state,
      dominant: result.dominant,
      all_scores: result.all_scores,
      safety_alerts: result.safety_alerts,
      has_safety_alert: result.has_safety_alert,
      total_markers: result.total_markers_analyzed,
      biological_profile: biologicalProfile,
      medications: profile.medications || [],
    })
  } catch (error) {
    console.error('Intelligence API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
