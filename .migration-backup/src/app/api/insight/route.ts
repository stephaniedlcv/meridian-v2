import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runDecisionEngine, BiomarkerRecord } from '@/lib/decision-engine'
import { CANONICAL_DICTIONARY } from '@/lib/canonical-dictionary'

// ===== TYPES =====

interface GoldenInsight {
  headline: string
  status: string
  cause: string
  action_steps: string[]
  trust_line: string
  block_color: 'recovery' | 'alert' | 'optimal'
  logic_trace: string
}

interface InsightResponse {
  success: boolean
  state: string
  insight: GoldenInsight | null
  dominant_marker: string | null
  safety_alert: boolean
  error?: string
}

// ===== TONE MAP =====

const TONE_MAP: Record<string, string> = {
  bienestar: 'Warm, simple, concrete. Speak like a caring friend. Avoid jargon.',
  optimizacion: 'Deeper, mechanistic. Explain the "why" with precision.',
  rendimiento: 'Technical, performance-focused. Data-driven language. Be direct.',
  condicion: 'Longitudinal, pattern-focused. Reference trends over time.',
  primer_paso: 'Patient, educational. No assumptions about health literacy. Encouraging.',
}

// ===== FORBIDDEN WORDS =====

const FORBIDDEN_WORDS = [
  'diagnose', 'diagnosed', 'diagnosis',
  'disease', 'disorder',
  'prescribe', 'prescription',
  'cure', 'treat', 'treatment',
  'danger', 'dangerous',
  'critical', 'emergency',
  'anemia', 'anemic',
  'hypothyroidism', 'hyperthyroidism',
  'diabetes', 'diabetic',
  'hypertension',
]

// ===== SYSTEM PROMPT =====

function buildSystemPrompt(
  userProfile: string,
  medications: string[],
  biologicalProfile: string
): string {
  const tone = TONE_MAP[userProfile] || TONE_MAP.bienestar

  return `### ROLE
You are the "Meridian Health Intelligence Engine", powered by Claude.
Your goal is to translate complex biometric data into one single actionable daily priority.

You speak like a brilliant friend who happens to have medical knowledge: warm, direct, empowering, and 100% data-driven.
You never diagnose. You never alarm. You never generalize.
If it could apply to anyone, delete it.

### USER CONTEXT
- Biological profile: ${biologicalProfile}
- Health goal: ${userProfile}
- Current medications: ${medications.length > 0 ? medications.join(', ') : 'None reported'}

### TONE
${tone}

### ABSOLUTE RULES (never break these)
1. NEVER diagnose. Say "Your iron reserves are below what your activity level needs" NOT "You have anemia"
2. NEVER use these words: disease, diagnose, prescribe, cure, danger, critical, emergency, anemia, hypothyroidism, diabetes, hypertension, disorder, treatment
3. NEVER mention a biomarker that is not in the provided data
4. NEVER give more than 3 action steps
5. NEVER say "consult your doctor" as the only answer — give context first
6. ALWAYS verify you are only referencing markers from the input data
7. IF medications are listed, do NOT suggest supplements that could interact. If unsure, omit the supplement suggestion entirely.

### OUTPUT FORMAT
Return ONLY a valid JSON object with these exact fields:
{
  "headline": "Short powerful phrase (max 6 words)",
  "status": "Biological state summary (max 15 words)",
  "cause": "Cross-data explanation connecting the dominant signal to how the user might feel. Max 2 sentences. Bold the key connection using **bold**.",
  "action_steps": [
    "Movement or rest directive — specific and actionable",
    "Nutrition directive — specific food or supplement with timing",
    "Timing or routine directive — when to do something"
  ],
  "trust_line": "Derived from [list the biomarker sources used]. Meridian interprets, you decide.",
  "block_color": "recovery OR alert OR optimal",
  "logic_trace": "INTERNAL: dominant marker, score, why this over others"
}

block_color rules:
- "optimal" = dominant marker is Optimal or Watch with low gravity
- "recovery" = dominant marker is Watch or Attention, actionable
- "alert" = dominant marker is Critical or safety alert triggered

Return ONLY the JSON. No markdown fences. No explanation. No preamble.`
}

// ===== SAFETY PROMPT =====

function buildSafetyPrompt(markerName: string, value: number, unit: string): string {
  return `### SAFETY ALERT MODE

A biomarker has crossed a safety threshold. This requires special handling.

The marker is: ${markerName} at ${value} ${unit}

Rules for safety alerts:
1. Do NOT provide action steps for optimization
2. Do NOT suggest supplements or lifestyle changes for this marker
3. DO explain what this marker measures in simple terms
4. DO suggest the user share this result with their healthcare provider
5. DO emphasize this is about getting proper evaluation, not about alarm
6. Keep the tone calm but clear about the importance of follow-up

Return the same JSON format but:
- headline should reference the need for professional review
- action_steps should all relate to getting proper evaluation
- block_color must be "alert"
- cause should explain what the marker measures without diagnosing`
}

// ===== GUARDRAILS =====

function validateMarkers(insight: GoldenInsight, validSlugs: string[]): boolean {
  const validNames = validSlugs.map(slug => {
    const entry = CANONICAL_DICTIONARY[slug]
    return entry ? entry.name.toLowerCase() : slug.toLowerCase()
  })

  const textToCheck = [
    insight.headline,
    insight.status,
    insight.cause,
    ...insight.action_steps,
    insight.trust_line,
  ].join(' ').toLowerCase()

  // Check if any canonical marker name appears that isn't in our valid list
  for (const [, marker] of Object.entries(CANONICAL_DICTIONARY)) {
    const markerLower = marker.name.toLowerCase()
    if (textToCheck.includes(markerLower) && !validNames.includes(markerLower)) {
      return false // Hallucination detected
    }
  }

  return true
}

function containsForbiddenWords(insight: GoldenInsight): string | null {
  const allText = [
    insight.headline,
    insight.status,
    insight.cause,
    ...insight.action_steps,
    insight.trust_line,
  ].join(' ').toLowerCase()

  for (const word of FORBIDDEN_WORDS) {
    if (allText.includes(word.toLowerCase())) {
      return word
    }
  }

  return null
}

// ===== MAIN ENDPOINT =====

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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('biological_profile, user_profile, medications')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      )
    }

    const biologicalProfile = (profile.biological_profile as 'female' | 'male') || 'female'
    const userProfile = (profile.user_profile as string) || 'bienestar'
    const medications = (profile.medications as string[]) || []

    // Get biomarkers
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
      return NextResponse.json(
        { success: false, error: 'Failed to fetch biomarkers' },
        { status: 500 }
      )
    }

    if (!biomarkers || biomarkers.length === 0) {
      return NextResponse.json({
        success: true,
        state: 'no_data',
        insight: null,
        dominant_marker: null,
        safety_alert: false,
      })
    }

    // Deduplicate
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

    // Run Decision Engine
    const engineResult = runDecisionEngine(
      latestBiomarkers,
      biologicalProfile,
      historicalByMarker
    )

    if (!engineResult.dominant) {
      return NextResponse.json({
        success: true,
        state: 'calibrating',
        insight: null,
        dominant_marker: null,
        safety_alert: false,
      })
    }

    // Build the biomarkers JSON for the prompt
    const biomarkersForPrompt = engineResult.all_scores.map(s => ({
      name: s.name,
      value: s.value,
      unit: s.unit,
      state: s.state,
      system: s.system,
      score: s.score,
    }))

    // Build prompts
    const systemPrompt = buildSystemPrompt(userProfile, medications, biologicalProfile)

    let userPrompt = `Here are the user's current biomarker results, ranked by relevance score:

${JSON.stringify(biomarkersForPrompt, null, 2)}

The dominant signal is: ${engineResult.dominant.name} at ${engineResult.dominant.value} ${engineResult.dominant.unit} (state: ${engineResult.dominant.state}, system: ${engineResult.dominant.system}, score: ${engineResult.dominant.score})

Generate the Golden Insight for this user's daily priority.`

    // Add safety prompt if needed
    if (engineResult.has_safety_alert) {
      userPrompt += '\n\n' + buildSafetyPrompt(
        engineResult.dominant.name,
        engineResult.dominant.value,
        engineResult.dominant.unit
      )
    }

    // Call Claude API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      console.error('Claude API error:', errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to generate insight' },
        { status: 500 }
      )
    }

    const anthropicData = await anthropicResponse.json()
    const rawText = anthropicData.content
      .map((block: { type: string; text?: string }) => block.type === 'text' ? block.text : '')
      .join('')

    // Parse the insight JSON
    let insight: GoldenInsight
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      insight = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse insight:', rawText)
      return NextResponse.json(
        { success: false, error: 'Failed to parse generated insight' },
        { status: 500 }
      )
    }

    // ===== GUARDRAIL 1: Hallucination check =====
    const validSlugs = engineResult.all_scores.map(s => s.slug)
    if (!validateMarkers(insight, validSlugs)) {
      console.error('Hallucination detected — insight references markers not in input')
      // Retry once with stricter instruction
      // For now, return the insight with a warning
      insight.logic_trace += ' | WARNING: possible hallucination detected'
    }

    // ===== GUARDRAIL 2: Forbidden words check =====
    const forbiddenWord = containsForbiddenWords(insight)
    if (forbiddenWord) {
      console.error(`Forbidden word detected: ${forbiddenWord}`)
      // Clean it from the output
      const cleanRegex = new RegExp(forbiddenWord, 'gi')
      insight.headline = insight.headline.replace(cleanRegex, '***')
      insight.status = insight.status.replace(cleanRegex, '***')
      insight.cause = insight.cause.replace(cleanRegex, '***')
      insight.action_steps = insight.action_steps.map(s => s.replace(cleanRegex, '***'))
      insight.logic_trace += ` | CLEANED: removed "${forbiddenWord}"`
    }

    // ===== GUARDRAIL 3: Action steps limit =====
    if (insight.action_steps.length > 3) {
      insight.action_steps = insight.action_steps.slice(0, 3)
    }

    // Determine state
    const state = engineResult.has_safety_alert ? 'safety_alert' : 'solved'

    const response: InsightResponse = {
      success: true,
      state,
      insight,
      dominant_marker: engineResult.dominant.slug,
      safety_alert: engineResult.has_safety_alert,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Insight API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
