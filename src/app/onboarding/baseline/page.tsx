'use client'

import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'
import { getNextOnboardingStep } from '@/lib/onboarding'
import { useMeridianLanguage } from '@/lib/i18n'

const supabase = createBrowserClient(
  getSupabaseUrl(),
  getSupabasePublishableKey()
)

const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
}

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `1px solid ${colors.cardBorder}`,
  background: 'rgba(6,19,22,0.6)',
  color: colors.text, borderRadius: '12px',
  padding: '12px 16px', fontSize: '15px', outline: 'none',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  lineHeight: '1.5',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  colorScheme: 'dark' as React.CSSProperties['colorScheme'],
}

const selectStyle: React.CSSProperties = {
  ...inputBase,
  padding: '12px 36px 12px 16px',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%235F8E85' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 13px center',
}

// ── Single-select chip helper ──────────────────────────────────────────────
function ChipGrid<T extends string | number>({
  options, value, onChange, columns = 2,
}: {
  options: Array<{ value: T; label: string }>
  value: T | null
  onChange: (v: T) => void
  columns?: number
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: '8px',
    }}>
      {options.map((opt, i) => {
        const isOn = value === opt.value
        return (
          <motion.button
            key={opt.value}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.03 * i }}
            onClick={() => onChange(opt.value)}
            style={{
              textAlign: 'center',
              border: isOn ? '1px solid rgba(45,212,191,0.85)' : `1px solid ${colors.cardBorder}`,
              background: isOn ? 'rgba(45,212,191,0.10)' : colors.cardBg,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: isOn ? colors.teal : colors.textSoft,
              borderRadius: '12px',
              padding: '10px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: isOn ? 700 : 500,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
              transition: 'border-color 180ms ease, background 180ms ease, color 180ms ease, box-shadow 180ms ease',
              boxShadow: isOn ? '0 0 0 1px rgba(45,212,191,0.15), 0 0 12px rgba(45,212,191,0.07)' : 'none',
            }}
            onMouseEnter={(e) => { if (!isOn) e.currentTarget.style.borderColor = 'rgba(45,212,191,0.35)' }}
            onMouseLeave={(e) => { if (!isOn) e.currentTarget.style.borderColor = colors.cardBorder }}
          >
            {opt.label}
          </motion.button>
        )
      })}
    </div>
  )
}

// ── Section divider ────────────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0 12px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: colors.cardBorder }} />
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────
type ActivityValue  = 'sedentary' | 'light' | 'moderate' | 'active' | 'athletic'
type TrainingValue  = 0 | 1 | 3 | 5
type GoalPhaseValue = 'recomposition' | 'fat_loss' | 'muscle_gain' | 'maintenance' | 'performance' | 'wellness'
type DietValue      = 'no_restriction' | 'balanced' | 'high_protein' | 'mediterranean' | 'vegetarian' | 'vegan' | 'low_carb' | 'keto' | 'other'

const FEET_OPTIONS = [4, 5, 6, 7]
const INCHES_OPTIONS = Array.from({ length: 12 }, (_, i) => i)

// ── Main component ─────────────────────────────────────────────────────────
export default function BaselinePage() {
  const router = useRouter()
  const [lang] = useMeridianLanguage()

  const [userId,        setUserId]       = useState<string | null>(null)
  const [loading,       setLoading]      = useState(false)
  const [error,         setError]        = useState('')

  // Physical
  const [heightFt, setHeightFt] = useState<number | null>(null)
  const [heightIn, setHeightIn] = useState<number | null>(null)
  const [weight,   setWeight]   = useState('')

  // Activity
  const [activityLevel,  setActivityLevel]  = useState<ActivityValue  | null>(null)
  const [trainingFreq,   setTrainingFreq]   = useState<TrainingValue  | null>(null)

  // Lifestyle
  const [goalPhase,   setGoalPhase]   = useState<GoalPhaseValue | null>(null)
  const [dietPattern, setDietPattern] = useState<DietValue      | null>(null)

  const copy = lang === 'es'
    ? {
        step: 'Base inicial · Paso 4 de 5',
        title: 'Construye tu base inicial',
        subtitle: 'Ayuda a Meridian a calibrar tu recuperación, metabolismo y guía diaria.',
        note: 'Podrás actualizar esto cuando quieras desde Perfil.',
        physicalContext: 'Contexto físico',
        height: 'Estatura',
        weight: 'Peso',
        activityTraining: 'Actividad y entrenamiento',
        activityLevel: 'Nivel de actividad',
        trainingFrequency: 'Frecuencia de entrenamiento',
        lifestyle: 'Estilo de vida',
        goalPhase: 'Fase de meta',
        dietPattern: 'Patrón de alimentación',
        saving: 'Guardando...',
        continue: 'Continuar →',
      }
    : {
        step: 'Baseline · Step 4 of 5',
        title: 'Build your baseline',
        subtitle: 'Help Meridian calibrate your recovery, metabolism, and daily guidance.',
        note: 'You can update this anytime from Profile.',
        physicalContext: 'Physical context',
        height: 'Height',
        weight: 'Weight',
        activityTraining: 'Activity & training',
        activityLevel: 'Activity level',
        trainingFrequency: 'Training frequency',
        lifestyle: 'Lifestyle',
        goalPhase: 'Goal phase',
        dietPattern: 'Diet pattern',
        saving: 'Saving...',
        continue: 'Continue →',
      }

  const activityOptions: Array<{ value: ActivityValue; label: string }> = lang === 'es'
    ? [
        { value: 'sedentary', label: 'Mayormente sentada' },
        { value: 'light',     label: 'Movimiento diario ligero' },
        { value: 'moderate',  label: 'Actividad moderada' },
        { value: 'active',    label: 'Entrenamiento constante' },
        { value: 'athletic',  label: 'Estilo de vida atlético' },
      ]
    : [
        { value: 'sedentary', label: 'Mostly desk-based' },
        { value: 'light',     label: 'Light daily movement' },
        { value: 'moderate',  label: 'Moderate activity' },
        { value: 'active',    label: 'Consistent training' },
        { value: 'athletic',  label: 'Athletic lifestyle' },
      ]

  const trainingOptions: Array<{ value: TrainingValue; label: string }> = lang === 'es'
    ? [
        { value: 0, label: 'No entreno actualmente' },
        { value: 1, label: '1–2 días / semana' },
        { value: 3, label: '3–4 días / semana' },
        { value: 5, label: '5+ días / semana' },
      ]
    : [
        { value: 0, label: 'Not currently training' },
        { value: 1, label: '1–2 days / week' },
        { value: 3, label: '3–4 days / week' },
        { value: 5, label: '5+ days / week' },
      ]

  const goalPhaseOptions: Array<{ value: GoalPhaseValue; label: string }> = lang === 'es'
    ? [
        { value: 'recomposition', label: 'Recomposición' },
        { value: 'fat_loss',      label: 'Pérdida de grasa' },
        { value: 'muscle_gain',   label: 'Ganancia muscular' },
        { value: 'maintenance',   label: 'Mantenimiento' },
        { value: 'performance',   label: 'Rendimiento' },
        { value: 'wellness',      label: 'Bienestar general' },
      ]
    : [
        { value: 'recomposition', label: 'Recomposition' },
        { value: 'fat_loss',      label: 'Fat loss' },
        { value: 'muscle_gain',   label: 'Muscle gain' },
        { value: 'maintenance',   label: 'Maintenance' },
        { value: 'performance',   label: 'Performance' },
        { value: 'wellness',      label: 'General wellness' },
      ]

  const dietOptions: Array<{ value: DietValue; label: string }> = lang === 'es'
    ? [
        { value: 'no_restriction', label: 'Sin restricciones' },
        { value: 'balanced',       label: 'Balanceada / flexible' },
        { value: 'high_protein',   label: 'Alta en proteína' },
        { value: 'mediterranean',  label: 'Mediterránea' },
        { value: 'vegetarian',     label: 'Vegetariana' },
        { value: 'vegan',          label: 'Vegana' },
        { value: 'low_carb',       label: 'Baja en carbohidratos' },
        { value: 'keto',           label: 'Keto' },
        { value: 'other',          label: 'Otra' },
      ]
    : [
        { value: 'no_restriction', label: 'No restriction' },
        { value: 'balanced',       label: 'Balanced / flexible' },
        { value: 'high_protein',   label: 'High protein' },
        { value: 'mediterranean',  label: 'Mediterranean' },
        { value: 'vegetarian',     label: 'Vegetarian' },
        { value: 'vegan',          label: 'Vegan' },
        { value: 'low_carb',       label: 'Low carb' },
        { value: 'keto',           label: 'Keto' },
        { value: 'other',          label: 'Other' },
      ]

  useEffect(() => {
    let isMounted = true
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const nextStep = getNextOnboardingStep(prof)
      if (nextStep === null) { router.push('/dashboard'); return }
      if (nextStep !== '/onboarding/baseline') { router.push(nextStep); return }
      if (isMounted) setUserId(user.id)
    }
    checkAuth()
    return () => { isMounted = false }
  }, [router])

  async function handleContinue() {
    if (!userId) return
    setLoading(true)
    setError('')

    const heightCm =
      heightFt !== null && heightIn !== null
        ? Math.round((heightFt * 12 + heightIn) * 2.54 * 10) / 10
        : null

    const weightKg =
      weight.trim() !== '' && !isNaN(Number(weight))
        ? Math.round(Number(weight) * 0.453592 * 10) / 10
        : null

    const payload: Record<string, unknown> = {
      id: userId,
      baseline_completed: true,
    }
    if (heightCm   !== null) payload.height_cm        = heightCm
    if (weightKg   !== null) payload.weight_kg        = weightKg
    if (activityLevel)       payload.activity_level   = activityLevel
    if (trainingFreq !== null) payload.training_days   = trainingFreq
    if (goalPhase)           payload.body_goal_phase  = goalPhase
    if (dietPattern)         payload.diet_pattern     = dietPattern

    const { error: saveError } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })

    setLoading(false)
    if (saveError) {
      console.warn('baseline save error:', saveError.message)
      // Non-fatal — proceed even if some fields failed (may need migration)
    }
    router.push('/onboarding/connect')
  }

  return (
    <main style={{
      minHeight: '100vh',
      color: colors.text,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '72px 20px 100px',
    }}>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 1 }}
      >
        {/* Step chip */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: colors.teal,
            padding: '5px 14px', border: '1px solid rgba(45,212,191,0.28)',
            borderRadius: '20px', background: 'rgba(45,212,191,0.07)',
          }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.9)' }} />
            {copy.step}
          </div>
        </div>

        {/* Glass card */}
        <div style={{
          border: `1px solid ${colors.cardBorder}`,
          background: colors.cardBg,
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '28px 24px 24px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 48px rgba(45,212,191,0.06)',
        }}>

          {/* Heading */}
          <div style={{ marginBottom: '4px' }}>
            <h1 style={{
              margin: '0 0 8px',
              fontFamily: 'var(--font-fraunces), serif',
              fontSize: 'clamp(22px, 4vw, 28px)',
              lineHeight: 1.1, letterSpacing: '-0.04em',
              color: colors.text, fontWeight: 700,
            }}>
              {copy.title}
            </h1>
            <p style={{ margin: '0 0 4px', color: colors.textSoft, fontSize: '14px', lineHeight: 1.6 }}>
              {copy.subtitle}
            </p>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
              {copy.note}
            </p>
          </div>

          {/* ── Physical context ─────────────────────────────── */}
          <SectionDivider label={copy.physicalContext} />

          {/* Height + Weight — side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '0' }}>

            {/* Height */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: '7px', letterSpacing: '-0.01em' }}>
                {copy.height}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <select
                  value={heightFt ?? ''}
                  onChange={(e) => setHeightFt(e.target.value !== '' ? Number(e.target.value) : null)}
                  style={selectStyle}
                >
                  <option value="">ft</option>
                  {FEET_OPTIONS.map(ft => (
                    <option key={ft} value={ft}>{ft}&apos;</option>
                  ))}
                </select>
                <select
                  value={heightIn ?? ''}
                  onChange={(e) => setHeightIn(e.target.value !== '' ? Number(e.target.value) : null)}
                  style={selectStyle}
                >
                  <option value="">in</option>
                  {INCHES_OPTIONS.map(inch => (
                    <option key={inch} value={inch}>{inch}&quot;</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Weight */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: '7px', letterSpacing: '-0.01em' }}>
                {copy.weight}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  placeholder="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  min="1" max="999" step="1"
                  style={{ ...inputBase, paddingRight: '40px' }}
                />
                <span style={{
                  position: 'absolute', right: '13px', top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.textMuted, fontSize: '12px', fontWeight: 600,
                  letterSpacing: '0.04em', pointerEvents: 'none',
                }}>
                  lbs
                </span>
              </div>
            </div>
          </div>

          {/* ── Activity & training ───────────────────────────── */}
          <SectionDivider label={copy.activityTraining} />

          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: colors.textMuted }}>{copy.activityLevel}</p>
              <ChipGrid<ActivityValue>
                options={activityOptions}
                value={activityLevel}
                onChange={setActivityLevel}
                columns={2}
              />
            </div>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: colors.textMuted }}>{copy.trainingFrequency}</p>
              <ChipGrid<TrainingValue>
                options={trainingOptions}
                value={trainingFreq}
                onChange={setTrainingFreq}
                columns={2}
              />
            </div>
          </div>

          {/* ── Lifestyle ────────────────────────────────────── */}
          <SectionDivider label={copy.lifestyle} />

          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: colors.textMuted }}>{copy.goalPhase}</p>
              <ChipGrid<GoalPhaseValue>
                options={goalPhaseOptions}
                value={goalPhase}
                onChange={setGoalPhase}
                columns={3}
              />
            </div>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: colors.textMuted }}>{copy.dietPattern}</p>
              <ChipGrid<DietValue>
                options={dietOptions}
                value={dietPattern}
                onChange={setDietPattern}
                columns={3}
              />
            </div>
          </div>

          {error && (
            <p style={{ margin: '14px 0 0', color: '#EF4444', fontSize: '13px', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            type="button"
            disabled={loading || !userId}
            onClick={handleContinue}
            style={{
              width: '100%', border: 'none', borderRadius: '12px',
              padding: '14px 18px', marginTop: '20px',
              background: !loading && userId
                ? 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)'
                : 'rgba(45,212,191,0.25)',
              color: '#061316',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '15px', fontWeight: 700,
              cursor: loading || !userId ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.01em',
              boxShadow: !loading && userId
                ? '0 0 24px rgba(45,212,191,0.32), 0 0 56px rgba(45,212,191,0.10), inset 0 1px 0 rgba(255,255,255,0.22)'
                : 'none',
              transition: 'box-shadow 200ms ease, background 200ms ease',
            }}
          >
            {loading ? copy.saving : copy.continue}
          </button>
        </div>
      </motion.section>
    </main>
  )
}
