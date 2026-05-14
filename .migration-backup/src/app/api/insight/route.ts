import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runDecisionEngine, BiomarkerRecord } from '@/lib/decision-engine'
import { CANONICAL_DICTIONARY } from '@/lib/canonical-dictionary'

export const dynamic = 'force-dynamic'

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
  optimizacion: 'Contextual and practical. Explain how the signal relates to the user\'s goals using simple language and actionable adjustments. Do not speculate about causes.',
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
1. NEVER diagnose. Say "Iron reserves may be below what your activity level needs" NOT "You have anemia"
2. NEVER use these words: disease, diagnose, prescribe, cure, danger, critical, emergency, anemia, hypothyroidism, diabetes, hypertension, disorder, treatment
3. NEVER mention a biomarker that is not in the provided data
4. NEVER give more than 3 action steps
5. NEVER say "consult your doctor" as the only answer — give context first
6. ALWAYS verify you are only referencing markers from the input data
7. IF medications are listed, do NOT suggest supplements that could interact. If unsure, omit the supplement suggestion entirely.
8. NEVER use causal or mechanistic framing. Avoid: "your body isn't clearing", "caused by", "because your body", "this means you have", "you are". Prefer: "may reflect", "could suggest", "is worth clarifying", "this signal may indicate".
9. For action steps, suggest general supportive approaches only. Do NOT recommend specific supplements or dosages unless they are universally safe dietary basics (e.g., hydration, dietary fiber, sleep). When in doubt, omit the supplement.
10. EVERY action step must pass the Mom Test: if the user has to ask "how?" or "how much?", the step failed. Each action step must contain a clear verb, a concrete object or behavior, and a practical anchor (today, with your next meal, before bed, this morning, etc.).
11. NEVER use these vague standalone phrases in action steps without immediately pairing them with a specific behavior: "moderate", "optimize", "support", "balance", "monitor". A vague phrase alone is not an action step.
12. ACTION STEP EXAMPLES — follow this style:
  PROTEIN: Bad → "Keep protein moderate." Good → "Stick to your usual protein portions today. No need to add extra protein while hydration is the priority."
  HYDRATION: Bad → "Support hydration." Good → "Drink water steadily through the day. Add one extra glass with your next meal."
  ELECTROLYTES: Bad → "Balance electrolytes." Good → "Keep sodium and potassium intake steady through normal meals today. Avoid adding new electrolyte supplements unless already part of your routine."
  MOVEMENT: Bad → "Optimize recovery." Good → "Keep movement easy today. Choose a 20-minute walk instead of intense training."
  MONITORING: Bad → "Monitor your symptoms." Good → "Take note of unusual dizziness, swelling, or fatigue today. If it repeats or worsens, bring it to a qualified clinician."

### OUTPUT FORMAT
Return ONLY a valid JSON object with these exact fields:
{
  "headline": "Short powerful phrase (max 6 words)",
  "status": "Biological state summary (max 15 words)",
  "cause": "What the dominant signal may reflect — not a causal diagnosis. Use hedged language: 'may reflect', 'could suggest', 'is worth noting'. Max 2 sentences. Bold the key concept using **bold**.",
  "action_steps": [
    "Movement or rest directive — specific and actionable",
    "Nutrition guidance — what to eat, keep steady, or avoid today. Do not recommend a specific supplement unless medication and safety checks explicitly allow it. No dosages.",
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

    // Get biomarkers — no date cutoff so historical labs are always considered.
    // The decision engine applies recency weighting; the API should not discard valid data.
    const { data: biomarkers, error: bioError } = await supabase
      .from('biomarkers_static')
      .select('*')
      .eq('user_id', userId)
      .eq('flag_error', false)
      .eq('validated', true)
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
        model: 'claude-sonnet-4-5',
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
      console.error('[insight] Claude API error — status:', anthropicResponse.status, 'body:', errorText.slice(0, 300))
      return NextResponse.json({
        success: true,
        state: 'labs_saved',
        insight: null,
        dominant_marker: engineResult.dominant?.slug ?? null,
        safety_alert: engineResult.has_safety_alert,
      } satisfies InsightResponse)
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
      console.error('[insight] Failed to parse Claude response:', rawText.slice(0, 300))
      return NextResponse.json({
        success: true,
        state: 'labs_saved',
        insight: null,
        dominant_marker: engineResult.dominant?.slug ?? null,
        safety_alert: engineResult.has_safety_alert,
      } satisfies InsightResponse)
    }

    // ===== GUARDRAIL 1: Hallucination check =====
    const validSlugs = engineResult.all_scores.map(s => s.slug)
    if (!validateMarkers(insight, validSlugs)) {
      console.error('[insight] Hallucination detected — returning insight_unavailable')
      return NextResponse.json({
        success: true,
        state: 'insight_unavailable',
        insight: null,
        dominant_marker: engineResult.dominant?.slug ?? null,
        safety_alert: engineResult.has_safety_alert,
      } satisfies InsightResponse)
    }

    // ===== GUARDRAIL 2: Forbidden words check =====
    const forbiddenWord = containsForbiddenWords(insight)
    if (forbiddenWord) {
      console.error(`[insight] Forbidden word detected: "${forbiddenWord}" — returning insight_unavailable`)
      return NextResponse.json({
        success: true,
        state: 'insight_unavailable',
        insight: null,
        dominant_marker: engineResult.dominant?.slug ?? null,
        safety_alert: engineResult.has_safety_alert,
      } satisfies InsightResponse)
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
    console.error('[insight] Unhandled error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({
      success: true,
      state: 'insight_unavailable',
      insight: null,
      dominant_marker: null,
      safety_alert: false,
    } satisfies InsightResponse)
  }
}
