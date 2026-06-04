// src/lib/plan/planConfig.ts
//
// Generic training program utilities for Meridian Plan.
// Derived from Body Sync planConfig.js — generalized for multi-user, DB-backed programs.
//
// Body Sync had a hardcoded PLAN_START and 24-week structure for one user.
// Meridian receives a TrainingProgram from Supabase and computes everything from it.
// The logic is identical; the inputs are now dynamic instead of constants.

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProgramGoal =
  | 'recomposition'
  | 'fat_loss'
  | 'muscle_gain'
  | 'strength'
  | 'endurance'
  | 'maintenance'
  | 'custom'

export type MilestoneType = 'assessment' | 'deload' | 'event' | 'other'

export interface ProgramPhase {
  name: string
  start_week: number
  end_week: number
  rir_target: string
  description: string
  // Meridian color token: 'cyan' | 'violet' | 'red' | 'amber' | 'green' | 'default'
  color: string
}

export interface ProgramMilestone {
  week: number
  label: string
  type: MilestoneType
}

export interface TrainingProgram {
  id: string
  user_id: string
  name: string
  goal: ProgramGoal
  total_weeks: number
  start_date: string  // ISO date string: 'YYYY-MM-DD'
  sessions_per_week: number
  template_id: string | null
  phases: ProgramPhase[]
  milestones: ProgramMilestone[]
  deload_weeks: number[]
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PhaseLabel {
  name: string
  variant: string
  phase: string
  range: string
}

export interface PlanProgress {
  completedWeeks: number
  totalWeeks: number
  percent: number
  label: string
  completedDays: number
  remainingDays: number
  totalDays: number
}

// ── Template definitions ───────────────────────────────────────────────────────
// Pre-built program templates. Used to pre-fill the program builder.
// The user can modify any value before saving.

export interface ProgramTemplate {
  id: string
  name: string
  goal: ProgramGoal
  total_weeks: number
  sessions_per_week: number
  description: string
  phases: ProgramPhase[]
  milestones: ProgramMilestone[]
  deload_weeks: number[]
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'recomposition_24w',
    name: 'Recomposición — 24 semanas',
    goal: 'recomposition',
    total_weeks: 24,
    sessions_per_week: 4,
    description: 'Programa de 6 meses para recomposición corporal. Foundation → Build → Refine con deloads periódicos.',
    phases: [
      { name: 'Foundation',     start_week: 1,  end_week: 8,  rir_target: 'RIR 3-4', color: 'cyan',   description: 'Construir consistencia, técnica, tolerancia al volumen y base de recomposición.' },
      { name: 'Build',          start_week: 9,  end_week: 16, rir_target: 'RIR 2-3', color: 'violet', description: 'Progresar cargas, consolidar músculo y ajustar estrategia según respuesta del cuerpo.' },
      { name: 'Refine',         start_week: 17, end_week: 23, rir_target: 'RIR 1-2', color: 'red',    description: 'Refinar composición corporal, proteger recuperación y preservar masa muscular.' },
      { name: 'Final Deload',   start_week: 24, end_week: 24, rir_target: 'RIR 4-5', color: 'green',  description: 'Recuperación activa. Preparar para medición final.' },
    ],
    milestones: [
      { week: 1,  label: 'Inicio del programa',   type: 'event' },
      { week: 4,  label: 'Mini-deload',            type: 'deload' },
      { week: 8,  label: 'Mini-deload + baseline', type: 'deload' },
      { week: 12, label: 'Midpoint assessment',    type: 'assessment' },
      { week: 16, label: 'Mini-deload',            type: 'deload' },
      { week: 20, label: 'Mini-deload',            type: 'deload' },
      { week: 24, label: 'Deload + medición final',type: 'assessment' },
    ],
    deload_weeks: [4, 8, 12, 16, 20, 24],
  },
  {
    id: 'fat_loss_12w',
    name: 'Fat Loss — 12 semanas',
    goal: 'fat_loss',
    total_weeks: 12,
    sessions_per_week: 4,
    description: 'Programa de 3 meses enfocado en pérdida de grasa preservando músculo.',
    phases: [
      { name: 'Adaptation', start_week: 1, end_week: 4,  rir_target: 'RIR 3-4', color: 'cyan',   description: 'Establecer base de movimiento y adaptar al déficit calórico.' },
      { name: 'Deficit',    start_week: 5, end_week: 10, rir_target: 'RIR 2-3', color: 'amber',  description: 'Intensificar entrenamiento. Priorizar proteína y recuperación.' },
      { name: 'Deload',     start_week: 11,end_week: 12, rir_target: 'RIR 4-5', color: 'green',  description: 'Semanas de recuperación y medición de resultados.' },
    ],
    milestones: [
      { week: 1,  label: 'Inicio',            type: 'event' },
      { week: 4,  label: 'Mini-deload',        type: 'deload' },
      { week: 8,  label: 'Midpoint check-in',  type: 'assessment' },
      { week: 12, label: 'Medición final',     type: 'assessment' },
    ],
    deload_weeks: [4, 8, 12],
  },
  {
    id: 'strength_16w',
    name: 'Fuerza — 16 semanas',
    goal: 'strength',
    total_weeks: 16,
    sessions_per_week: 3,
    description: 'Programa de 4 meses de fuerza progresiva con periodización por bloques.',
    phases: [
      { name: 'Hypertrophy', start_week: 1,  end_week: 6,  rir_target: 'RIR 3-4', color: 'cyan',   description: 'Volumen alto, construir base muscular para la fase de fuerza.' },
      { name: 'Strength',    start_week: 7,  end_week: 12, rir_target: 'RIR 1-2', color: 'violet', description: 'Intensidad alta, bajar reps, enfocarse en pesos máximos.' },
      { name: 'Peaking',     start_week: 13, end_week: 15, rir_target: 'RIR 0-1', color: 'red',    description: 'Semanas finales de pico — máxima intensidad, volumen reducido.' },
      { name: 'Deload',      start_week: 16, end_week: 16, rir_target: 'RIR 4-5', color: 'green',  description: 'Recuperación completa antes de la prueba de fuerza final.' },
    ],
    milestones: [
      { week: 1,  label: 'Inicio',         type: 'event' },
      { week: 6,  label: 'Deload',          type: 'deload' },
      { week: 12, label: 'Midpoint test',   type: 'assessment' },
      { week: 16, label: 'PR test + deload',type: 'assessment' },
    ],
    deload_weeks: [6, 12, 16],
  },
  {
    id: 'muscle_gain_20w',
    name: 'Hipertrofia — 20 semanas',
    goal: 'muscle_gain',
    total_weeks: 20,
    sessions_per_week: 4,
    description: 'Programa de 5 meses para ganancia muscular con progresión de volumen.',
    phases: [
      { name: 'Volume Base', start_week: 1,  end_week: 8,  rir_target: 'RIR 3-4', color: 'cyan',   description: 'Acumular volumen progresivamente. Técnica y consistencia primero.' },
      { name: 'Intensify',   start_week: 9,  end_week: 16, rir_target: 'RIR 1-2', color: 'violet', description: 'Reducir volumen relativo, aumentar intensidad absoluta.' },
      { name: 'Consolidate', start_week: 17, end_week: 19, rir_target: 'RIR 2-3', color: 'amber',  description: 'Sostener ganancias, reducir fatiga acumulada.' },
      { name: 'Deload',      start_week: 20, end_week: 20, rir_target: 'RIR 4-5', color: 'green',  description: 'Semana de recuperación y medición final.' },
    ],
    milestones: [
      { week: 1,  label: 'Inicio',              type: 'event' },
      { week: 4,  label: 'Mini-deload',          type: 'deload' },
      { week: 8,  label: 'Midpoint check-in',   type: 'assessment' },
      { week: 12, label: 'Mini-deload',          type: 'deload' },
      { week: 16, label: 'Assessment',           type: 'assessment' },
      { week: 20, label: 'Deload + medición',    type: 'assessment' },
    ],
    deload_weeks: [4, 8, 12, 16, 20],
  },
]

// ── Core week/phase utilities ─────────────────────────────────────────────────
// All functions take a TrainingProgram (or its key fields) instead of relying
// on hardcoded constants. The Body Sync equivalents are noted in comments.

/**
 * Get the current week number within the program (1-indexed).
 * Returns 0 if the program hasn't started yet.
 * Body Sync equivalent: getPlanWeekNum() — hardcoded PLAN_START
 */
export function getProgramWeekNum(program: Pick<TrainingProgram, 'start_date' | 'total_weeks'>): number {
  const start = new Date(program.start_date + 'T00:00:00')
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
  if (diff < 0) return 0
  return Math.min(diff + 1, program.total_weeks + 1)
}

/**
 * Check if the given week is a deload week.
 * Body Sync equivalent: isMiniDeloadWeek() — hardcoded [4, 8, 12, 16, 20]
 */
export function isDeloadWeek(
  week: number,
  program: Pick<TrainingProgram, 'deload_weeks' | 'total_weeks'>
): boolean {
  return program.deload_weeks.includes(week)
}

/**
 * Check if the given week is the final week of the program.
 * Body Sync equivalent: isFinalDeloadWeek() — hardcoded week === 24
 */
export function isFinalWeek(
  week: number,
  program: Pick<TrainingProgram, 'total_weeks'>
): boolean {
  return week === program.total_weeks
}

/**
 * Check if the program is complete (past the last week).
 * Body Sync equivalent: isPlanComplete() — hardcoded PLAN_TOTAL_WEEKS
 */
export function isProgramComplete(
  week: number,
  program: Pick<TrainingProgram, 'total_weeks'>
): boolean {
  return week > program.total_weeks
}

/**
 * Get the RIR target for a given week.
 * Uses the program's phases array if available; falls back to template logic.
 * Body Sync equivalent: getRIRTarget() — hardcoded week ranges
 */
export function getRIRTarget(
  week: number,
  program: Pick<TrainingProgram, 'phases' | 'deload_weeks' | 'total_weeks'>
): string {
  if (week === 0) return 'RIR 3-4'
  if (isProgramComplete(week, program)) return 'Mantenimiento / Revisión'

  // Use program phases if defined
  if (program.phases.length > 0) {
    const phase = program.phases.find(p => week >= p.start_week && week <= p.end_week)
    if (phase) {
      // Deload weeks always override phase RIR
      if (isDeloadWeek(week, program)) return 'RIR 4-5 (Deload)'
      return phase.rir_target
    }
  }

  // Fallback: proportional RIR based on program length
  if (isDeloadWeek(week, program)) return 'RIR 4-5 (Deload)'
  const progress = week / program.total_weeks
  if (progress <= 0.33) return 'RIR 3-4'
  if (progress <= 0.67) return 'RIR 2-3'
  return 'RIR 1-2'
}

/**
 * Get the phase label for a given week.
 * Body Sync equivalent: getPhaseLabel() — hardcoded Foundation/Build/Refine
 */
export function getPhaseLabel(
  week: number,
  program: Pick<TrainingProgram, 'phases' | 'deload_weeks' | 'total_weeks' | 'goal'>
): PhaseLabel {
  if (week === 0) {
    return { name: 'Pre-inicio', variant: 'default', phase: 'Setup', range: 'Antes de comenzar' }
  }

  if (isProgramComplete(week, program)) {
    return { name: 'Revisión final', variant: 'green', phase: 'Post-plan', range: `Después de semana ${program.total_weeks}` }
  }

  if (isDeloadWeek(week, program) || isFinalWeek(week, program)) {
    const isLast = isFinalWeek(week, program)
    return {
      name: isLast ? 'Final deload' : 'Mini-deload',
      variant: 'amber',
      phase: isLast ? 'Cierre' : 'Deload',
      range: `Semana ${week}`,
    }
  }

  // Use program phases if defined
  if (program.phases.length > 0) {
    const phase = program.phases.find(p => week >= p.start_week && week <= p.end_week)
    if (phase) {
      return {
        name: phase.name,
        variant: phase.color,
        phase: `Semanas ${phase.start_week}–${phase.end_week}`,
        range: `Semana ${week} de ${phase.end_week - phase.start_week + 1}`,
      }
    }
  }

  // Fallback: generic proportional phases
  const progress = week / program.total_weeks
  if (progress <= 0.33) return { name: 'Foundation',    variant: 'cyan',   phase: 'Fase 1', range: `Semana ${week}` }
  if (progress <= 0.67) return { name: 'Build',         variant: 'violet', phase: 'Fase 2', range: `Semana ${week}` }
  return                       { name: 'Refine',        variant: 'red',    phase: 'Fase 3', range: `Semana ${week}` }
}

/**
 * Get the description for the current phase.
 * Body Sync equivalent: getPhaseDescription()
 */
export function getPhaseDescription(
  week: number,
  program: Pick<TrainingProgram, 'phases' | 'total_weeks'>
): string {
  if (week === 0) return 'Preparar baseline, métricas iniciales y estructura del plan.'
  if (week > program.total_weeks) return 'Revisar resultados, comparar mediciones y definir el próximo ciclo.'

  if (program.phases.length > 0) {
    const phase = program.phases.find(p => week >= p.start_week && week <= p.end_week)
    if (phase?.description) return phase.description
  }

  const progress = week / program.total_weeks
  if (progress <= 0.33) return 'Construir consistencia, técnica, tolerancia al volumen y base de recomposición.'
  if (progress <= 0.67) return 'Progresar cargas, consolidar músculo y ajustar estrategia según respuesta del cuerpo.'
  return 'Refinar composición corporal, proteger recuperación y preservar masa muscular.'
}

/**
 * Get next phase preview text — shown as "próximo escalón".
 */
export function getNextPhasePreview(
  week: number,
  program: Pick<TrainingProgram, 'phases' | 'total_weeks' | 'deload_weeks'>
): string | null {
  if (week >= program.total_weeks) return null

  // Find the next phase transition
  const currentPhase = program.phases.find(p => week >= p.start_week && week <= p.end_week)
  if (!currentPhase) return null

  const nextPhase = program.phases.find(p => p.start_week === currentPhase.end_week + 1)
  if (nextPhase) {
    return `En semana ${nextPhase.start_week} comienza ${nextPhase.name} — ${nextPhase.description}`
  }

  const nextDeload = program.deload_weeks.find(w => w > week)
  if (nextDeload) {
    return `Semana ${nextDeload}: mini-deload de recuperación activa`
  }

  return null
}

/**
 * Get comprehensive plan progress stats.
 * Body Sync equivalent: getPlanProgress() — extended with day tracking
 */
export function getProgramProgress(
  week: number,
  program: Pick<TrainingProgram, 'total_weeks' | 'start_date' | 'sessions_per_week'>
): PlanProgress {
  const safeWeek = Math.max(0, week)
  const completedWeeks = Math.min(safeWeek, program.total_weeks)
  const percent = program.total_weeks > 0
    ? Math.round((completedWeeks / program.total_weeks) * 100)
    : 0

  const totalDays = program.total_weeks * program.sessions_per_week
  const completedDays = completedWeeks * program.sessions_per_week
  const remainingDays = totalDays - completedDays

  return {
    completedWeeks,
    totalWeeks: program.total_weeks,
    percent,
    label: `${completedWeeks}/${program.total_weeks} semanas`,
    completedDays,
    remainingDays,
    totalDays,
  }
}

/**
 * Get the program end date as a formatted string.
 */
export function getProgramEndDate(
  program: Pick<TrainingProgram, 'start_date' | 'total_weeks'>
): Date {
  const start = new Date(program.start_date + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + program.total_weeks * 7)
  return end
}

/**
 * Get milestones sorted by week, with a flag indicating if they're past/current/upcoming.
 */
export function getMilestonesWithStatus(
  week: number,
  program: Pick<TrainingProgram, 'milestones' | 'total_weeks'>
): Array<ProgramMilestone & { status: 'past' | 'current' | 'upcoming' }> {
  return [...program.milestones]
    .sort((a, b) => a.week - b.week)
    .map(m => ({
      ...m,
      status: m.week < week ? 'past' : m.week === week ? 'current' : 'upcoming',
    }))
}

/**
 * Get display color class for a phase color token.
 * Maps Body Sync Tailwind variants to Meridian CSS variable colors.
 */
export function getPhaseColorTokens(color: string): {
  dot: string
  border: string
  bg: string
  text: string
} {
  const map: Record<string, { dot: string; border: string; bg: string; text: string }> = {
    cyan:    { dot: '#2DD4BF', border: 'rgba(45,212,191,0.28)',   bg: 'rgba(45,212,191,0.06)',   text: '#2DD4BF' },
    violet:  { dot: '#A78BFA', border: 'rgba(167,139,250,0.28)',  bg: 'rgba(167,139,250,0.06)',  text: '#A78BFA' },
    red:     { dot: '#F87171', border: 'rgba(248,113,113,0.28)',  bg: 'rgba(248,113,113,0.06)',  text: '#F87171' },
    amber:   { dot: '#FCD34D', border: 'rgba(250,204,21,0.28)',   bg: 'rgba(250,204,21,0.06)',   text: '#FCD34D' },
    green:   { dot: '#34D399', border: 'rgba(52,211,153,0.28)',   bg: 'rgba(52,211,153,0.06)',   text: '#34D399' },
    default: { dot: '#9ACBC1', border: 'rgba(154,203,193,0.20)',  bg: 'rgba(154,203,193,0.05)',  text: '#9ACBC1' },
  }
  return map[color] ?? map.default
}

// ── Smart suggestions from labs ────────────────────────────────────────────────
// Used for the "initial state" when a user has labs but no supplements configured.
// Non-prescriptive — suggestions only, user decides.

export interface SupplementSuggestion {
  biomarker_slug: string
  biomarker_name: string
  condition: 'low' | 'suboptimal'
  suggestion: string
  supplement_name: string
  note: string
}

export const LAB_SUPPLEMENT_SUGGESTIONS: SupplementSuggestion[] = [
  {
    biomarker_slug: 'vitamin_d',
    biomarker_name: 'Vitamina D',
    condition: 'low',
    suggestion: 'Tu vitamina D está baja.',
    supplement_name: 'Vitamina D3 + K2',
    note: 'D3 apoya absorción de calcio, función inmune y recuperación. K2 dirige el calcio a los huesos.',
  },
  {
    biomarker_slug: 'magnesium',
    biomarker_name: 'Magnesio',
    condition: 'low',
    suggestion: 'Tu magnesio está bajo.',
    supplement_name: 'Magnesio Citrato / Glicinato',
    note: 'El magnesio participa en más de 300 reacciones enzimáticas, incluyendo sueño y recuperación muscular.',
  },
  {
    biomarker_slug: 'ferritin',
    biomarker_name: 'Ferritina',
    condition: 'low',
    suggestion: 'Tu ferritina está baja.',
    supplement_name: 'Hierro + Vitamina C',
    note: 'Ferritina baja puede conectar con fatiga, capacidad de recuperación y rendimiento. Consulta con tu médico antes de suplementar.',
  },
  {
    biomarker_slug: 'vitamin_b12',
    biomarker_name: 'Vitamina B12',
    condition: 'low',
    suggestion: 'Tu B12 está baja.',
    supplement_name: 'Vitamina B12 (Metilcobalamina)',
    note: 'B12 apoya función nerviosa, producción de glóbulos rojos y metabolismo energético.',
  },
  {
    biomarker_slug: 'zinc',
    biomarker_name: 'Zinc',
    condition: 'low',
    suggestion: 'Tu zinc está bajo.',
    supplement_name: 'Zinc Picolinato',
    note: 'El zinc participa en síntesis proteica, función inmune y señalización hormonal.',
  },
  {
    biomarker_slug: 'tsh',
    biomarker_name: 'TSH',
    condition: 'suboptimal',
    suggestion: 'Tus marcadores tiroideos están fuera del rango óptimo.',
    supplement_name: 'Selenio',
    note: 'El selenio es cofactor de las enzimas que convierten T4 en T3 activa. Consulta con tu médico.',
  },
  {
    biomarker_slug: 'crp_hs',
    biomarker_name: 'hs-CRP',
    condition: 'suboptimal',
    suggestion: 'Tu marcador de inflamación está elevado.',
    supplement_name: 'Omega-3 / NAC',
    note: 'Omega-3 y NAC tienen evidencia en reducción de inflamación sistémica. Consulta con tu médico.',
  },
]

/**
 * Given a list of recent biomarkers with their states, return relevant supplement suggestions.
 * Only suggests when the biomarker is in 'Low', 'Attention', or 'Critical' state.
 */
export function getSupplementSuggestionsFromLabs(
  biomarkers: Array<{ marker_name: string; state: string | null; value: number | null }>
): SupplementSuggestion[] {
  const abnormalSlugs = new Set(
    biomarkers
      .filter(b => b.state === 'Low' || b.state === 'Attention' || b.state === 'Critical' || b.state === 'Watch')
      .map(b => b.marker_name)
  )

  return LAB_SUPPLEMENT_SUGGESTIONS.filter(s => abnormalSlugs.has(s.biomarker_slug))
}
