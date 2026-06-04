import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedRouteContext } from '@/lib/supabase/route-auth'
import { runDecisionEngine, BiomarkerRecord } from '@/lib/decision-engine'
import { CANONICAL_DICTIONARY } from '@/lib/canonical-dictionary'
import { getTrendDirection, calculateDelta, calculatePercentChange } from '@/lib/trend-engine'

export const dynamic = 'force-dynamic'

// ===== TYPES =====

type InsightLanguage = 'en' | 'es'

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

interface HealthContext {
  activityLevel: string | null
  trainingDays: number | null
  bodyGoalPhase: string | null
  dietPattern: string | null
  weightKg: number | null
}

// ===== HEALTH CONTEXT LABELS =====

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'sedentary',
  light: 'lightly active',
  moderate: 'moderately active',
  active: 'active',
  athletic: 'athletic',
}

const GOAL_LABELS: Record<string, string> = {
  fat_loss: 'fat loss',
  maintenance: 'maintenance',
  muscle_gain: 'muscle gain',
  recomposition: 'recomposition',
  performance: 'performance',
  wellness: 'general wellness',
}

const DIET_LABELS: Record<string, string> = {
  no_restriction: 'no specific restriction',
  balanced: 'balanced',
  high_protein: 'high-protein',
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  mediterranean: 'Mediterranean',
  low_carb: 'low-carb',
  keto: 'keto',
  other: 'other',
}

function buildHealthContextBlock(hc: HealthContext): string {
  const lines: string[] = []

  if (hc.activityLevel) {
    const label = ACTIVITY_LABELS[hc.activityLevel] ?? hc.activityLevel
    lines.push(`- Reported activity level: ${label}`)
  }
  if (hc.trainingDays !== null) {
    lines.push(`- Reported training frequency: ${hc.trainingDays} days/week`)
  }
  if (hc.bodyGoalPhase) {
    const label = GOAL_LABELS[hc.bodyGoalPhase] ?? hc.bodyGoalPhase
    lines.push(`- Reported body goal: ${label}`)
  }
  if (hc.dietPattern) {
    const label = DIET_LABELS[hc.dietPattern] ?? hc.dietPattern
    lines.push(`- Reported diet pattern: ${label}`)
  }
  if (hc.weightKg !== null) {
    lines.push(`- Weight context: available internally, but never mention the number to the user`)
  }

  if (lines.length === 0) return ''
  return `\n### HEALTH CONTEXT\n${lines.join('\n')}`
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
  'diagnosticar', 'diagnosticado', 'diagnosticada', 'diagnóstico',
  'disease', 'disorder',
  'enfermedad', 'trastorno',
  'prescribe', 'prescription',
  'prescribir', 'recetar', 'receta',
  'cure', 'treat', 'treatment',
  'curar', 'cura', 'tratar', 'tratamiento',
  'danger', 'dangerous',
  'peligro', 'peligroso', 'peligrosa',
  'critical', 'emergency',
  'crítico', 'crítica', 'emergencia',
  'anemia', 'anemic',
  'anémico', 'anémica',
  'hypothyroidism', 'hyperthyroidism',
  'hipotiroidismo', 'hipertiroidismo',
  'diabetes', 'diabetic',
  'diabético', 'diabética',
  'hypertension',
  'hipertensión',
]

// ===== SYSTEM PROMPT =====

function buildSystemPrompt(
  userProfile: string,
  medications: string[],
  biologicalProfile: string,
  healthContext: HealthContext,
  language: InsightLanguage = 'en'
): string {
  const tone = TONE_MAP[userProfile] || TONE_MAP.bienestar
  const healthContextBlock = buildHealthContextBlock(healthContext)
  const languageBlock = language === 'es'
    ? `### OUTPUT LANGUAGE
Return all user-facing fields in natural Puerto Rico-friendly Spanish.
Fields that must be Spanish: headline, status, cause, action_steps, trust_line.
Keep biomarker names, units, and numeric values exactly as provided.
Use a warm, clear, premium tone. Avoid Spanglish unless the biomarker name itself is in English.
Do not copy English example sentences into the final JSON.
No user-facing sentence should remain in English unless it is a biomarker name, unit, or exact lab value.
Use "Meridian interpreta, tú decides." in trust_line.`
    : `### OUTPUT LANGUAGE
Return all user-facing fields in English.
Use "Meridian interprets, you decide." in trust_line.`

  return `### ROLE
You are the "Meridian Health Intelligence Engine", powered by Claude.
Your goal is to translate complex biometric data into one single actionable daily priority.

You speak like a brilliant friend who happens to have medical knowledge: warm, direct, empowering, and 100% data-driven.
You never diagnose. You never alarm. You never generalize.
If it could apply to anyone, delete it.

### USER CONTEXT
- Biological profile: ${biologicalProfile}
- Health goal: ${userProfile}
- Current medications: ${medications.length > 0 ? medications.join(', ') : 'None reported'}${healthContextBlock}

### TONE
${tone}

### ABSOLUTE RULES (never break these)
1. NEVER diagnose. Say "Iron reserves may be below what your activity level needs" NOT "You have anemia"
2. NEVER use these words in English or Spanish: disease, diagnose, prescribe, cure, danger, critical, emergency, anemia, hypothyroidism, diabetes, hypertension, disorder, treatment, diagnóstico, enfermedad, trastorno, prescribir, recetar, cura, peligro, crítico, emergencia, hipotiroidismo, hipertiroidismo, diabético, hipertensión, tratamiento
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
13. ALL USER-FACING FIELDS (headline, status, cause, action_steps, trust_line) must follow the same clarity rules as action steps. Vague words — "optimize", "optimizing", "support", "supporting", "balance", "balancing", "monitor", "monitoring", "moderate" — are discouraged everywhere unless immediately paired with a specific, concrete behavior. They are especially prohibited when paired with organs or body systems.
14. NEVER use organ-alarming or organ-struggling language in any field. Avoid: "support kidney function", "kidney workload", "your kidneys are…", "liver support", "your liver is struggling", "your body isn't clearing". Instead use neutral marker language: "filtration marker", "kidney-related marker", "this lab signal", "fluid balance signal", "today's priority is keeping fluids steady".
  STATUS/CAUSE EXAMPLES:
  Bad → "eGFR at 84 suggests filtration efficiency is worth optimizing today." Good → "eGFR at 84 may reflect a temporary shift in hydration, recent intake, or workload. Today's priority is keeping fluids steady."
  Bad → "It's worth supporting kidney function with simple adjustments today." Good → "This is not a red flag in this context. Keep fluids steady and avoid unusually high-protein meals today."
15. HEADLINE rule: Name the signal without sounding like a diagnosis. Avoid phrasing that implies an organ is failing (e.g. "Kidney filtration below target"). Prefer neutral signal language: "Filtration marker slightly below target", "Filtration signal slightly below target", "Hydration-related marker needs attention".
16. PLAIN LANGUAGE rule: Use everyday language first across all fields. If a technical phrase is necessary, explain it in simple words immediately. The user should not need medical knowledge to understand the insight. Discourage these terms unless clearly explained in plain words: "workload", "fluid balance", "metabolic demand", "filtration efficiency", "renal", "kidney workload", "systemic stress", "biomarker instability".
  PLAIN LANGUAGE REPLACEMENTS:
  "workload" → "recent activity", "recent training", "recent physical stress"
  "fluid balance" → "hydration", "how much fluid your body is holding"
  "filtration efficiency" → "filtration marker", "kidney-related marker", "this lab signal"
  "metabolic demand" → "recent activity", "recent training"
  PLAIN LANGUAGE EXAMPLES:
  Bad → "eGFR at 84 may reflect hydration, recent intake, or workload today." Good → "eGFR at 84 may reflect hydration, recent meals, or recent activity today."
  Bad → "This signal may reflect temporary shifts in fluid balance or recent protein intake." Good → "This signal may reflect temporary shifts in hydration or recent protein intake."
  Bad → "Filtration efficiency is worth watching." Good → "This filtration marker is worth watching alongside your other labs."
17. HEALTH CONTEXT: Use Health Context only when it directly improves relevance, wording, or action-step clarity for the dominant signal. When Health Context directly explains why an action is recommended, mention it briefly in plain language — keep it to one short clause at the start of the sentence. Do not repeat the same instruction in two different ways within the same action step. When referencing Health Context, keep it to one short clause or one short sentence — say the thing once, clearly. Do not mention Health Context if it does not directly improve the action or explanation. Do not enumerate every context field. Do not mention the user's weight or height as a number. Do not generate numeric protein targets, hydration volumes, calorie targets, macro targets, supplement dosages, medication dosing, or exact training prescriptions based on Health Context alone. If Health Context is missing or irrelevant, ignore it.
  HEALTH CONTEXT EXAMPLES:
  Bad → "Since your diet is already high-protein, stick to your usual protein portions today rather than adding extra. No need to increase protein while hydration is the priority." (repeats the same instruction twice)
  Good → "Since your diet is already high-protein, stick to your usual protein portions today and let hydration be the priority."
  Good → "Since your diet is already high-protein, keep protein steady today instead of adding extra."
  Good → "Given that you train regularly, keep movement easy today instead of adding another hard session."
  Good → "Since your goal is recomposition, keep protein steady and focus today on hydration."
  Bad → "Because you weigh X…"
  Bad → "Based on your height and weight…"
  Bad → "Eat X grams of protein."
  Bad → "Drink X liters of water."
  Bad → "Train exactly X minutes."
18. TREND AWARENESS: When a ### TREND CONTEXT block is present in the user message, incorporate the trend direction into the cause or status field. Use calibrated language:
  - Improving trend: prefer "remains elevated, but recent labs show improvement" or "this marker is trending in the right direction" over alarming phrasing
  - Worsening trend: "has moved further outside range since the previous lab" or "this signal has increased since the last result"
  - Stable trend: "has remained consistently elevated" or "the pattern has been stable across recent labs"
  NEVER imply recovery, resolution, or cure based on a positive trend. NEVER suppress follow-up recommendations because a trend is improving. Safety alerts override all trend framing.

${languageBlock}

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

function buildSafetyPrompt(markerName: string, value: number, unit: string, language: InsightLanguage = 'en'): string {
  const markerLabelEs = markerName === 'Fasting Glucose' ? 'glucosa en ayunas' : markerName

  if (language === 'es') {
    return `### IDIOMA DE SALIDA
Devuelve ÚNICAMENTE JSON válido.
Todos los campos visibles para el usuario deben estar en español natural y claro para Puerto Rico.

### REVISIÓN DE SEGURIDAD MERIDIAN
Un resultado de laboratorio necesita revisión profesional antes de que Meridian ofrezca guía de estilo de vida.

Marcador: ${markerLabelEs}
Valor: ${value} ${unit}

Devuelve JSON exactamente con esta estructura:
{
  "status": "safety_review",
  "signal_label": "SEÑAL PRIORITARIA",
  "severity_label": "REQUIERE ATENCIÓN",
  "headline": "Este resultado necesita revisión profesional",
  "subheadline": "El dato de ${markerLabelEs} requiere confirmación clínica antes de interpretar patrones.",
  "interpretation": "Este resultado merece revisarse con un clínico cualificado antes de sacar conclusiones. Meridian interpreta datos; no diagnostica.",
  "priority_title": "PRIORIDAD DE HOY",
  "actions": [
    "Contacta al laboratorio o a tu proveedor de salud para confirmar si este resultado fue tomado y procesado correctamente.",
    "Pregunta si hace falta repetir o completar la prueba para tener un panel metabólico más completo.",
    "Lleva tu reporte completo de laboratorio a tu próxima visita médica para revisar este dato en contexto."
  ],
  "caution_title": "TEN EN CUENTA",
  "caution": "Este resultado merece revisarse con un clínico cualificado antes de sacar conclusiones. Meridian interpreta datos; no diagnostica.",
  "confidence_title": "RASTRO DE CONFIANZA",
  "confidence": "Derivado de ${markerLabelEs}. Meridian interpreta; tú decides."
}`;
  }

  const languageLine = 'Return all user-facing JSON fields in English.'

  return `### SAFETY ALERT MODE

A biomarker has crossed a safety threshold. This requires special handling.

The marker is: ${markerName} at ${value} ${unit}

${languageLine}

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


function localizeInsightForSpanish(insight: GoldenInsight): GoldenInsight {
  const replacements: Array<[string, string]> = [
    ['Filtration marker slightly below target', 'Marcador de filtración ligeramente bajo'],
    ['Filtration signal slightly below target', 'Señal de filtración ligeramente baja'],
    ['Hydration-related marker needs attention', 'Señal de hidratación para observar'],
    ['Recovery signal', 'Señal de recuperación'],
    ['RECOVERY SIGNAL', 'SEÑAL DE RECUPERACIÓN'],
    ['Keep movement easy today. Choose a 20-minute walk instead of intense training.', 'Mantén el movimiento suave hoy. Elige una caminata de 20 minutos en lugar de entrenamiento intenso.'],
    ['Since your diet is already high-protein, stick to your usual protein portions today and let hydration be the priority.', 'Como tu dieta ya es alta en proteína, mantén tus porciones usuales hoy y deja que la hidratación sea la prioridad.'],
    ['Since your diet is already high-protein, keep protein steady today instead of adding extra.', 'Como tu dieta ya es alta en proteína, mantén la proteína estable hoy en lugar de añadir extra.'],
    ['Drink water steadily through the day. Add one extra glass with your next meal.', 'Toma agua de forma constante durante el día. Añade un vaso extra con tu próxima comida.'],
    ['eGFR at 84 may reflect hydration, recent meals, or recent activity today.', 'El eGFR en 84 puede reflejar hidratación, comidas recientes o actividad reciente hoy.'],
    ['This signal may reflect temporary shifts in hydration or recent protein intake.', 'Esta señal puede reflejar cambios temporales en hidratación o consumo reciente de proteína.'],
    ['This is not a red flag in this context.', 'No es una señal de alarma en este contexto.'],
    ['Creatinine is optimal, which suggests the eGFR reading may be influenced by recent training or fluid status rather than a persistent pattern.', 'La creatinina está óptima, lo que sugiere que la lectura de eGFR puede estar influenciada por entrenamiento reciente o hidratación, más que por un patrón persistente.'],
    ['Derived from ', 'Derivado de '],
    ['Meridian interprets, you decide.', 'Meridian interpreta, tú decides.'],
    ['Meridian interprets, you decide', 'Meridian interpreta, tú decides'],
  ]

  const localize = (value: string): string => {
    let next = value
    for (const [from, to] of replacements) {
      next = next.split(from).join(to)
    }
    return next
  }

  return {
    ...insight,
    headline: localize(insight.headline),
    status: localize(insight.status),
    cause: localize(insight.cause),
    action_steps: insight.action_steps.map(localize),
    trust_line: localize(insight.trust_line),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { context, errorResponse } = await getAuthenticatedRouteContext()

    if (errorResponse || !context) {
      return errorResponse
    }

    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('user_id')
    const langParam = searchParams.get('lang')
    const language: InsightLanguage = langParam === 'es' ? 'es' : 'en'

    if (requestedUserId && requestedUserId !== context.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden.' },
        { status: 403 }
      )
    }

    const userId = context.user.id

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('biological_profile, user_profile, medications, activity_level, training_days, body_goal_phase, diet_pattern, weight_kg')
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

    const healthContext: HealthContext = {
      activityLevel: typeof profile.activity_level === 'string' ? profile.activity_level : null,
      trainingDays: typeof profile.training_days === 'number' ? profile.training_days : null,
      bodyGoalPhase: typeof profile.body_goal_phase === 'string' ? profile.body_goal_phase : null,
      dietPattern: typeof profile.diet_pattern === 'string' ? profile.diet_pattern : null,
      weightKg: typeof profile.weight_kg === 'number' ? profile.weight_kg : null,
    }

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

    // T003: Compute trend for dominant marker from historical records.
    // Uses strict earlier-date previous (ignores same-day duplicates).
    let trendContextBlock = ''
    if (!engineResult.has_safety_alert) {
      const domSlug = engineResult.dominant.slug
      const domHistory = (historicalByMarker[domSlug] ?? [])
        .slice()
        .sort((a, b) => b.collected_at.localeCompare(a.collected_at))
      const currentRec = domHistory[0]
      if (currentRec) {
        const currentDateKey = currentRec.collected_at.split('T')[0]
        const prevRec = domHistory.find(r => r.collected_at.split('T')[0] < currentDateKey)
        if (prevRec) {
          const refMin = currentRec.reference_range_min ?? null
          const refMax = currentRec.reference_range_max ?? null
          const trendDir = getTrendDirection(domSlug, currentRec.value, prevRec.value, refMin, refMax)
          const delta = calculateDelta(currentRec.value, prevRec.value)
          const pctChange = calculatePercentChange(currentRec.value, prevRec.value)
          const trendLabel =
            trendDir === 'improving'         ? 'improving (moving in the right clinical direction)' :
            trendDir === 'worsening'         ? 'worsening (moving in the wrong clinical direction)' :
            trendDir === 'stable'            ? 'stable (no meaningful change since previous lab)' :
                                               'insufficient history for direction assessment'
          const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`
          const pctStr = pctChange !== null
            ? ` (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%)`
            : ''
          trendContextBlock = `\n\n### TREND CONTEXT
Dominant marker history:
- Previous result: ${prevRec.value} ${engineResult.dominant.unit} on ${prevRec.collected_at.split('T')[0]}
- Current result:  ${currentRec.value} ${engineResult.dominant.unit} on ${currentDateKey}
- Change: ${deltaStr}${pctStr}
- Trend direction: ${trendLabel}

Apply TREND AWARENESS rule 18 when framing the cause and status fields.`
        }
      }
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt(userProfile, medications, biologicalProfile, healthContext, language)

    let userPrompt = `Here are the user's current biomarker results, ranked by relevance score:

${JSON.stringify(biomarkersForPrompt, null, 2)}${trendContextBlock}

The dominant signal is: ${engineResult.dominant.name} at ${engineResult.dominant.value} ${engineResult.dominant.unit} (state: ${engineResult.dominant.state}, system: ${engineResult.dominant.system}, score: ${engineResult.dominant.score})

Generate the Golden Insight for this user's daily priority.
Return the user-facing fields in ${language === 'es' ? 'Spanish' : 'English'}.`

    // Add safety prompt if needed
    if (engineResult.has_safety_alert) {
      userPrompt += '\n\n' + buildSafetyPrompt(
        engineResult.dominant.name,
        engineResult.dominant.value,
        engineResult.dominant.unit,
        language
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
    if (language === 'es') {
      insight = localizeInsightForSpanish(insight)
    }

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
