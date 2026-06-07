'use client'

import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import { useEffect, useRef, useState } from 'react'
import { useMeridianLanguage, type MeridianLanguage } from '../../lib/i18n'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar from '@/components/NavBar'
import Glp1ProtocolToggle from '@/components/Glp1ProtocolToggle'
import { getNextOnboardingStep } from '@/lib/onboarding'

// ——— Design tokens ———
const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  inputBg: 'rgba(6,19,22,0.6)',
}
const fonts = {
  heading: '"Fraunces", serif',
  ui: '"Plus Jakarta Sans", sans-serif',
}

// ——— Types ———
type BiologicalProfile = 'female' | 'male'
type UserProfile = 'bienestar' | 'optimizacion' | 'rendimiento' | 'condicion' | 'primer_paso'
type ActivityLevel  = 'sedentary' | 'light' | 'moderate' | 'active' | 'athletic'
type BodyGoalPhase  = 'fat_loss' | 'maintenance' | 'muscle_gain' | 'recomposition' | 'performance' | 'wellness'
type DietPattern    = 'no_restriction' | 'balanced' | 'high_protein' | 'vegetarian' | 'vegan' | 'mediterranean' | 'low_carb' | 'keto' | 'other'

interface ProfileData {
  full_name:          string | null
  first_name:         string | null
  last_name:          string | null
  display_name:       string | null
  biological_profile: BiologicalProfile | null
  user_profile:       UserProfile | null
  avatar_url:         string | null   // may not exist in DB — handled gracefully
  birth_date:         string | null
  medications:        string[] | null
  height_cm:          number | null
  weight_kg:          number | null
  activity_level:     ActivityLevel | null
  training_days:      number | null
  body_goal_phase:    BodyGoalPhase | null
  diet_pattern:       DietPattern | null
}

// ——— Reference maps ———
const GOAL_MAP: Record<UserProfile, { label: string; description: string }> = {
  bienestar:    { label: 'General Wellness',   description: 'Meridian tracks everyday vitality and surfaces patterns that affect how you feel day to day.' },
  optimizacion: { label: 'Optimization',       description: "You're in good shape — Meridian helps fine-tune what's working and identify where you can push further." },
  rendimiento:  { label: 'Peak Performance',   description: 'Meridian prioritizes markers affecting physical and mental output, recovery, and resilience at the edge.' },
  condicion:    { label: 'Specific Condition', description: 'Meridian keeps close watch on markers relevant to your health concern and surfaces meaningful changes.' },
  primer_paso:  { label: 'Getting Started',    description: "You're beginning your health journey. Meridian delivers clear, accessible insights without overwhelming detail." },
}

const GOAL_SIGNALS: Record<UserProfile, string[]> = {
  bienestar:    ['Wellness', 'Balance', 'Recovery'],
  optimizacion: ['Labs', 'Trends', 'Efficiency'],
  rendimiento:  ['Performance', 'Recovery', 'HRV'],
  condicion:    ['Monitoring', 'Alerts', 'Trends'],
  primer_paso:  ['Basics', 'Education', 'Progress'],
}

const BIO_MAP: Record<BiologicalProfile, string> = {
  female: 'Female profile',
  male: 'Male profile',
}

const ALL_GOALS: UserProfile[] = ['bienestar', 'optimizacion', 'rendimiento', 'condicion', 'primer_paso']

const ACTIVITY_MAP: Record<ActivityLevel, { label: string; description: string }> = {
  sedentary: { label: 'Sedentary',        description: 'Mostly sitting, little to no exercise' },
  light:     { label: 'Light',            description: 'Light movement, 1–3 days/week' },
  moderate:  { label: 'Moderate',         description: 'Exercise 3–5 days/week' },
  active:    { label: 'Active',           description: 'Hard training 5–6 days/week' },
  athletic:  { label: 'Athletic',         description: 'Intense daily training or physical job' },
}
const ALL_ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'athletic']

const GOAL_PHASE_MAP: Record<BodyGoalPhase, string> = {
  fat_loss:      'Fat loss',
  maintenance:   'Maintenance',
  muscle_gain:   'Muscle gain',
  recomposition: 'Recomposition',
  performance:   'Performance',
  wellness:      'General wellness',
}
const ALL_GOAL_PHASES: BodyGoalPhase[] = ['fat_loss', 'maintenance', 'muscle_gain', 'recomposition', 'performance', 'wellness']

const DIET_MAP: Record<DietPattern, string> = {
  no_restriction: 'No restriction',
  balanced:       'Balanced',
  high_protein:   'High protein',
  vegetarian:     'Vegetarian',
  vegan:          'Vegan',
  mediterranean:  'Mediterranean',
  low_carb:       'Low carb',
  keto:           'Keto',
  other:          'Other',
}
const ALL_DIET_PATTERNS: DietPattern[] = ['no_restriction', 'balanced', 'high_protein', 'vegetarian', 'vegan', 'mediterranean', 'low_carb', 'keto', 'other']

// ——— Helpers ———
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatBirthDate(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  const year = parts[0]
  const monthIndex = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (isNaN(monthIndex) || isNaN(day) || monthIndex < 0 || monthIndex > 11) return isoDate
  return `${MONTH_NAMES[monthIndex]} ${day}, ${year}`
}

function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalInches = cm / 2.54
  const ft   = Math.floor(totalInches / 12)
  const inch = Math.round(totalInches % 12)
  return { ft, inch }
}

function ftInToCm(ft: number, inch: number): number {
  return Math.round(((ft * 12) + inch) * 2.54 * 10) / 10
}

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.2046226218 * 10) / 10
}

function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.2046226218 * 10) / 10
}

function displayHeight(cm: number): string {
  const { ft, inch } = cmToFtIn(cm)
  return `${ft} ft ${inch} in`
}

function displayWeight(kg: number): string {
  return `${kgToLbs(kg).toFixed(1)} lb`
}

// ——— Main component ———
export default function ProfilePage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableKey()
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pageLoading, setPageLoading]             = useState(true)
  const [userId, setUserId]                       = useState('')
  const [userEmail, setUserEmail]                 = useState('')
  const [profile, setProfile]                     = useState<ProfileData>({
    full_name: null, first_name: null, last_name: null, display_name: null,
    biological_profile: null, user_profile: null, avatar_url: null, birth_date: null, medications: null,
    height_cm: null, weight_kg: null, activity_level: null, training_days: null,
    body_goal_phase: null, diet_pattern: null,
  })
  const [hasLabs, setHasLabs]                     = useState(false)
  const [photoPreview, setPhotoPreview]           = useState<string | null>(null)

  const [editingSection, setEditingSection]       = useState<'identity' | 'focus' | 'medications' | 'health_context' | null>(null)
  const [lang, setLanguage]                     = useMeridianLanguage()
  const [editPreferredName, setEditPreferredName] = useState('')
  const [editFirstName, setEditFirstName]         = useState('')
  const [editLastName, setEditLastName]           = useState('')
  const [editDisplayName, setEditDisplayName]     = useState('')
  const [editBirthDate, setEditBirthDate]         = useState('')
  const [editBioProfile, setEditBioProfile]       = useState<BiologicalProfile | null>(null)
  const [editUserProfile, setEditUserProfile]     = useState<UserProfile | null>(null)
  const [editMedList, setEditMedList]             = useState<string[]>([])
  const [editMedInput, setEditMedInput]           = useState('')
  // Health Context edit states
  const [editHeightUnit, setEditHeightUnit]       = useState<'ftin' | 'cm'>('ftin')
  const [editHeightFt, setEditHeightFt]           = useState('')
  const [editHeightIn, setEditHeightIn]           = useState('')
  const [editHeightCm, setEditHeightCm]           = useState('')
  const [editWeightUnit, setEditWeightUnit]       = useState<'lbs' | 'kg'>('lbs')
  const [editWeightVal, setEditWeightVal]         = useState('')
  const [editTrainingDays, setEditTrainingDays]   = useState('')
  const [editDaysError, setEditDaysError]         = useState<string | null>(null)
  const [editActivityLevel, setEditActivityLevel] = useState<ActivityLevel | null>(null)
  const [editBodyGoalPhase, setEditBodyGoalPhase] = useState<BodyGoalPhase | null>(null)
  const [editDietPattern, setEditDietPattern]     = useState<DietPattern | null>(null)
  const [saving, setSaving]                       = useState(false)
  const [saveStatus, setSaveStatus]               = useState<'idle' | 'success' | 'error'>('idle')
  const [isAdmin, setIsAdmin]                     = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')

      const SELECT = 'full_name, first_name, last_name, display_name, biological_profile, user_profile, birth_date, avatar_url, medications, onboarding_completed, height_cm, weight_kg, activity_level, training_days, body_goal_phase, diet_pattern'
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select(SELECT)
        .eq('id', user.id)
        .single()

      const nextStep = getNextOnboardingStep(prof)

      // Guard: redirect to the exact missing onboarding step.
      if (nextStep) { router.push(nextStep); return }

      if (prof) {
        const raw = prof as unknown as Record<string, unknown>
        setProfile({
          full_name:           typeof raw.full_name === 'string' ? raw.full_name : null,
          first_name:          typeof raw.first_name === 'string' ? raw.first_name : null,
          last_name:           typeof raw.last_name === 'string' ? raw.last_name : null,
          display_name:        typeof raw.display_name === 'string' ? raw.display_name : null,
          biological_profile:  (raw.biological_profile === 'female' || raw.biological_profile === 'male') ? raw.biological_profile : null,
          user_profile:        typeof raw.user_profile === 'string' ? raw.user_profile as UserProfile : null,
          avatar_url:          typeof raw.avatar_url === 'string' ? raw.avatar_url : null,
          birth_date:          typeof raw.birth_date === 'string' ? raw.birth_date : null,
          medications:         Array.isArray(raw.medications) ? raw.medications as string[] : null,
          height_cm:           typeof raw.height_cm === 'number' ? raw.height_cm : null,
          weight_kg:           typeof raw.weight_kg === 'number' ? raw.weight_kg : null,
          activity_level:      (['sedentary','light','moderate','active','athletic'] as ActivityLevel[]).includes(raw.activity_level as ActivityLevel) ? raw.activity_level as ActivityLevel : null,
          training_days:       typeof raw.training_days === 'number' ? raw.training_days : null,
          body_goal_phase:     (['fat_loss','maintenance','muscle_gain','recomposition','performance','wellness'] as BodyGoalPhase[]).includes(raw.body_goal_phase as BodyGoalPhase) ? raw.body_goal_phase as BodyGoalPhase : null,
          diet_pattern:        (['no_restriction','balanced','high_protein','vegetarian','vegan','mediterranean','low_carb','keto','other'] as DietPattern[]).includes(raw.diet_pattern as DietPattern) ? raw.diet_pattern as DietPattern : null,
        })
      }

      const { count } = await supabase
        .from('biomarkers_static')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setHasLabs(typeof count === 'number' && count > 0)

      // Admin check — server-side via service role (no hardcoded IDs)
      try {
        const adminRes = await fetch('/api/admin/check')
        if (adminRes.ok) {
          const adminData = await adminRes.json()
          setIsAdmin(adminData.isAdmin === true)
        }
      } catch {
        // Non-fatal — admin section simply stays hidden
      }

      setPageLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ——— Derived ———
  // Priority: display_name → first_name → full_name → "Not set yet"
  const displayName =
    profile.display_name?.trim() ||
    profile.first_name?.trim() ||
    profile.full_name ||
    'Not set yet'
  const avatarSrc   = photoPreview || profile.avatar_url

  // ——— Photo handlers ———
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setPhotoPreview(ev.target?.result as string) }
    reader.readAsDataURL(file)
    // TODO: upload to Supabase Storage when bucket is configured
  }
  function handleRemovePhoto() {
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    // TODO: clear avatar_url in profiles when Storage is configured
  }

  // ——— Edit handlers ———
  function startEditIdentity() {
    setEditPreferredName(profile.full_name || '')
    setEditFirstName(profile.first_name || '')
    setEditLastName(profile.last_name || '')
    setEditDisplayName(profile.display_name || '')
    setEditBirthDate(profile.birth_date || '')
    setEditBioProfile(profile.biological_profile)
    setEditingSection('identity')
    setSaveStatus('idle')
  }
  function startEditFocus() {
    setEditUserProfile(profile.user_profile)
    setEditingSection('focus')
    setSaveStatus('idle')
  }
  function cancelEdit() { setEditingSection(null); setSaveStatus('idle') }

  async function saveIdentity() {
    if (!userId) return
    setSaving(true); setSaveStatus('idle')
    const fn = editFirstName.trim() || null
    const ln = editLastName.trim() || null
    const dn = editDisplayName.trim() || null
    const bd = editBirthDate || null
    // Keep full_name in sync as backward-compatible fallback
    const computedFullName = editPreferredName.trim() ||
      ([fn, ln].filter(Boolean).join(' ') || null)
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: computedFullName,
        first_name: fn,
        last_name: ln,
        display_name: dn,
        birth_date: bd,
        biological_profile: editBioProfile,
      }, { onConflict: 'id' })
    setSaving(false)
    if (error) { console.error('saveIdentity failed:', error); setSaveStatus('error'); return }
    setProfile(p => ({
      ...p,
      full_name: computedFullName,
      first_name: fn,
      last_name: ln,
      display_name: dn,
      birth_date: bd,
      biological_profile: editBioProfile,
    }))
    setSaveStatus('success')
    setTimeout(() => { setEditingSection(null); setSaveStatus('idle') }, 900)
  }

  async function saveFocus() {
    if (!userId || !editUserProfile) return
    setSaving(true); setSaveStatus('idle')
    const { error } = await supabase
      .from('profiles').upsert({ id: userId, user_profile: editUserProfile }, { onConflict: 'id' })
    setSaving(false)
    if (error) { console.error('saveFocus failed:', error); setSaveStatus('error'); return }
    setProfile(p => ({ ...p, user_profile: editUserProfile }))
    setSaveStatus('success')
    setTimeout(() => { setEditingSection(null); setSaveStatus('idle') }, 900)
  }

  function startEditMeds() {
    setEditMedList(profile.medications ? [...profile.medications] : [])
    setEditMedInput('')
    setEditingSection('medications')
    setSaveStatus('idle')
  }

  function addMedEntry() {
    const val = editMedInput.trim()
    if (!val) return
    const lower = val.toLowerCase()
    if (editMedList.some(m => m.toLowerCase() === lower)) { setEditMedInput(''); return }
    setEditMedList(prev => [...prev, val])
    setEditMedInput('')
  }

  function removeMedEntry(index: number) {
    setEditMedList(prev => prev.filter((_, i) => i !== index))
  }

  async function saveMeds() {
    if (!userId) return
    setSaving(true); setSaveStatus('idle')
    const cleaned = editMedList.map(m => m.trim()).filter(Boolean)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, medications: cleaned }, { onConflict: 'id' })
    setSaving(false)
    if (error) { console.error('saveMeds failed:', error); setSaveStatus('error'); return }
    setProfile(p => ({ ...p, medications: cleaned.length > 0 ? cleaned : null }))
    setSaveStatus('success')
    setTimeout(() => { setEditingSection(null); setSaveStatus('idle') }, 900)
  }

  function startEditHealthContext() {
    // Populate height fields — prefer ft/in as default
    if (profile.height_cm !== null) {
      const { ft, inch } = cmToFtIn(profile.height_cm)
      setEditHeightFt(String(ft))
      setEditHeightIn(String(inch))
      setEditHeightCm(profile.height_cm.toFixed(1))
    } else {
      setEditHeightFt(''); setEditHeightIn(''); setEditHeightCm('')
    }
    setEditHeightUnit('ftin')
    // Populate weight fields — prefer lbs as default
    if (profile.weight_kg !== null) {
      setEditWeightVal(kgToLbs(profile.weight_kg).toFixed(1))
    } else {
      setEditWeightVal('')
    }
    setEditWeightUnit('lbs')
    setEditTrainingDays(profile.training_days !== null ? String(profile.training_days) : '')
    setEditActivityLevel(profile.activity_level)
    setEditBodyGoalPhase(profile.body_goal_phase)
    setEditDietPattern(profile.diet_pattern)
    setEditingSection('health_context')
    setSaveStatus('idle')
  }

  async function saveHealthContext() {
    if (!userId) return
    setSaving(true); setSaveStatus('idle')

    // Height
    let hCm: number | null = null
    if (editHeightUnit === 'ftin') {
      const ft  = parseFloat(editHeightFt)
      const inn = parseFloat(editHeightIn)
      if (!isNaN(ft) && ft >= 0 && !isNaN(inn) && inn >= 0 && inn <= 11) {
        hCm = ftInToCm(ft, inn)
      }
    } else {
      const parsed = parseFloat(editHeightCm)
      if (!isNaN(parsed) && parsed > 0) hCm = Math.round(parsed * 10) / 10
    }

    // Weight
    let wKg: number | null = null
    const wRaw = parseFloat(editWeightVal)
    if (!isNaN(wRaw) && wRaw > 0) {
      wKg = editWeightUnit === 'lbs' ? lbsToKg(wRaw) : Math.round(wRaw * 10) / 10
    }

    // Training days — use Number() to avoid parseInt silently parsing "4-5" as 4
    const daysStr = editTrainingDays.trim()
    let days: number | null = null
    let daysInvalid = false
    if (daysStr !== '') {
      const daysNum = Number(daysStr)
      if (Number.isFinite(daysNum) && Number.isInteger(daysNum) && daysNum >= 0 && daysNum <= 7) {
        days = daysNum
      } else {
        daysInvalid = true
      }
    }
    if (daysInvalid) {
      setEditDaysError('Use one whole number from 0 to 7.')
      setSaving(false)
      return
    }
    setEditDaysError(null)

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      height_cm:       hCm,
      weight_kg:       wKg,
      activity_level:  editActivityLevel  || null,
      training_days:   days,
      body_goal_phase: editBodyGoalPhase  || null,
      diet_pattern:    editDietPattern    || null,
    }, { onConflict: 'id' })

    setSaving(false)
    if (error) { console.error('saveHealthContext failed:', error); setSaveStatus('error'); return }
    setProfile(p => ({
      ...p,
      height_cm:       hCm,
      weight_kg:       wKg,
      activity_level:  editActivityLevel,
      training_days:   days,
      body_goal_phase: editBodyGoalPhase,
      diet_pattern:    editDietPattern,
    }))
    setSaveStatus('success')
    setTimeout(() => { setEditingSection(null); setSaveStatus('idle') }, 900)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/onboarding/welcome')
  }

  if (pageLoading) return null

  // ——— Personalization matrix rows (computed from live data) ———
  type MatrixStatus = 'active' | 'pending' | 'soon'
  const matrixRows: { label: string; description: string; status: MatrixStatus }[] = [
    { label: 'Biological profile', description: 'Used to personalize lab reference ranges.', status: profile.biological_profile ? 'active' : 'pending' },
    { label: 'Age context',        description: 'Used for age-adjusted biological context.',  status: profile.birth_date ? 'active' : 'pending' },
    { label: 'Lab history',        description: 'Used to refine trend interpretation.',       status: hasLabs ? 'active' : 'pending' },
    { label: 'Wearable signals',   description: 'Used to improve biological context.',        status: 'soon' },
    { label: 'Medication context', description: profile.medications && profile.medications.length > 0 ? `${profile.medications.length} medication${profile.medications.length === 1 ? '' : 's'} on file.` : 'Add medications to help Meridian interpret labs more safely.', status: profile.medications && profile.medications.length > 0 ? 'active' : 'pending' },
    { label: 'Feedback loop',      description: 'Used to improve insight accuracy over time.',status: 'soon' },
  ]

  // ——— Render ———
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      fontFamily: fonts.ui,
      color: colors.text,
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* Ambient orbs */}
      <div style={{ position: 'fixed', top: '-20%', left: '-15%', width: '65%', height: '65%', background: 'radial-gradient(circle, rgba(45,212,191,0.10) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-15%', width: '65%', height: '65%', background: 'radial-gradient(circle, rgba(103,232,249,0.08) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '45%', left: '50%', transform: 'translate(-50%,-50%)', width: '45%', height: '30%', background: 'radial-gradient(circle, rgba(45,212,191,0.04) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '44px 20px 120px', position: 'relative', zIndex: 1 }}>

        {/* Page context label */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.6)', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>
            Identity Core
          </span>
        </div>

        {/* ════════════════════════════════ HERO — centered ═══ */}
        <div style={{
          paddingBottom: '26px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          position: 'relative',
        }}>
          {/* Cinematic glow behind avatar */}
          <div style={{
            position: 'absolute', top: '0px', left: '50%', transform: 'translateX(-50%)',
            width: '280px', height: '280px',
            background: 'radial-gradient(circle, rgba(45,212,191,0.14) 0%, rgba(103,232,249,0.06) 40%, transparent 70%)',
            filter: 'blur(42px)', pointerEvents: 'none',
          }} />

          {/* Avatar with orbital rings */}
          <div style={{ position: 'relative', width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            {/* Ring 3 — outermost */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(45,212,191,0.055)' }} />
            {/* Ring 2 */}
            <div style={{ position: 'absolute', width: '148px', height: '148px', borderRadius: '50%', border: '1px solid rgba(45,212,191,0.10)' }} />
            {/* Ring 1 — close to avatar */}
            <div style={{ position: 'absolute', width: '118px', height: '118px', borderRadius: '50%', border: '1px solid rgba(45,212,191,0.19)' }} />

            {/* Avatar circle */}
            <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
              <div style={{
                width: '96px', height: '96px', borderRadius: '50%',
                border: '2px solid rgba(45,212,191,0.52)',
                boxShadow: '0 0 0 4px rgba(45,212,191,0.07), 0 0 32px rgba(45,212,191,0.22)',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(6,19,22,0.95) 0%, rgba(15,38,44,0.90) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{
                    fontFamily: fonts.heading, fontSize: '44px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1,
                    background: 'linear-gradient(135deg, #EAFBF7 0%, #67E8F9 40%, #2DD4BF 100%)',
                    backgroundClip: 'text', WebkitBackgroundClip: 'text',
                    color: 'transparent', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 10px rgba(45,212,191,0.45))', userSelect: 'none',
                  }}>
                    {displayName !== 'Not set yet' ? displayName[0].toUpperCase() : 'M'}
                  </span>
                )}
              </div>
              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label={avatarSrc ? 'Change photo' : 'Upload photo'}
                style={{
                  position: 'absolute', bottom: 0, right: '-4px',
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'rgba(45,212,191,0.14)', border: '1.5px solid rgba(45,212,191,0.48)',
                  color: colors.teal, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 700, lineHeight: 1,
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                }}
              >+</button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            </div>
          </div>

          {/* Photo action links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px', minHeight: '18px' }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.teal, fontSize: '12px', fontWeight: 600, fontFamily: fonts.ui, padding: 0 }}>
              {avatarSrc ? 'Change photo' : 'Upload photo'}
            </button>
            {avatarSrc && (
              <>
                <span style={{ color: colors.textMuted, fontSize: '12px' }}>·</span>
                <button onClick={handleRemovePhoto} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: '12px', fontWeight: 600, fontFamily: fonts.ui, padding: 0 }}>
                  Remove
                </button>
              </>
            )}
          </div>
          {/* Local preview hint */}
          {photoPreview && !profile.avatar_url && (
            <p style={{ fontSize: '11px', color: colors.textMuted, margin: '4px 0 0', opacity: 0.7 }}>
              Preview only — storage connection pending.
            </p>
          )}

          {/* Display name */}
          <h1 style={{
            fontFamily: fonts.heading, fontSize: 'clamp(28px, 7vw, 38px)',
            fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, color: colors.text,
            margin: '14px 0 5px',
          }}>
            {displayName}
          </h1>

          {/* Email */}
          <p style={{ fontSize: '13px', color: colors.textMuted, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
            {userEmail}
          </p>

          {/* Status chip row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '7px' }}>
            {/* Always: Profile active */}
            <HeroChip active>Profile active</HeroChip>
            {/* Bio */}
            <HeroChip active={!!profile.biological_profile} dim={!profile.biological_profile}>
              {profile.biological_profile ? BIO_MAP[profile.biological_profile] : 'Biology pending'}
            </HeroChip>
            {/* Focus */}
            <HeroChip active={!!profile.user_profile} dim={!profile.user_profile}>
              {profile.user_profile && GOAL_MAP[profile.user_profile]
                ? GOAL_MAP[profile.user_profile].label
                : 'Focus not set'}
            </HeroChip>
          </div>
        </div>

        {/* ════════════════════════ BIOLOGICAL PASSPORT ═══ */}
        <div style={cardStyle}>
          {/* Passport header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardLabel}>Biological Passport</span>
              <div style={{ width: '1px', height: '10px', background: colors.cardBorder }} />
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted, opacity: 0.6 }}>Identity signals</span>
            </div>
            {editingSection !== 'identity' && (
              <SmallButton onClick={startEditIdentity}>Edit</SmallButton>
            )}
          </div>

          {editingSection === 'identity' ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={fieldLabel}>First name</label>
                  <input
                    type="text" value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    placeholder="First"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Last name</label>
                  <input
                    type="text" value={editLastName}
                    onChange={e => setEditLastName(e.target.value)}
                    placeholder="Last"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={fieldLabel}>Display name <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input
                  type="text" value={editDisplayName}
                  onChange={e => setEditDisplayName(e.target.value)}
                  placeholder="How Meridian addresses you — defaults to first name"
                  style={inputStyle}
                />
                <p style={fieldHint}>Leave blank to use first name. Falls back to full name if both are empty.</p>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={fieldLabel}>Date of birth</label>
                <input
                  type="date" value={editBirthDate}
                  onChange={e => setEditBirthDate(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark', WebkitAppearance: 'none' as React.CSSProperties['WebkitAppearance'] }}
                />
                <p style={fieldHint}>Used for age-adjusted biological context. Stored as YYYY-MM-DD.</p>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={fieldLabel}>Biological profile</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['female', 'male'] as BiologicalProfile[]).map(bp => (
                    <button key={bp} type="button" onClick={() => setEditBioProfile(bp)} style={{
                      flex: 1, padding: '10px 14px', borderRadius: '10px',
                      border: editBioProfile === bp ? '1px solid rgba(45,212,191,0.78)' : `1px solid ${colors.cardBorder}`,
                      background: editBioProfile === bp ? 'rgba(45,212,191,0.10)' : colors.inputBg,
                      color: editBioProfile === bp ? colors.teal : colors.textSoft,
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui,
                      letterSpacing: '-0.01em', transition: 'all 160ms ease',
                    }}>
                      {BIO_MAP[bp]}
                    </button>
                  ))}
                </div>
                <p style={fieldHint}>Used for accurate reference ranges — not your identity.</p>
              </div>
              <SaveFeedback status={saveStatus} />
              <EditActions onCancel={cancelEdit} onSave={saveIdentity} saving={saving} saveLabel="Save changes" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <PassportRow
                label="First name"
                value={profile.first_name || null}
                emptyLabel="Not set yet"
                onAdd={startEditIdentity}
              />
              <div style={{ height: '1px', background: colors.cardBorder, margin: '14px 0' }} />
              <PassportRow
                label="Last name"
                value={profile.last_name || null}
                emptyLabel="Not set yet"
                onAdd={startEditIdentity}
              />
              <div style={{ height: '1px', background: colors.cardBorder, margin: '14px 0' }} />
              <PassportRow label="Email" value={userEmail} />
              <div style={{ height: '1px', background: colors.cardBorder, margin: '14px 0' }} />
              <PassportRow
                label="Biological profile"
                value={profile.biological_profile ? BIO_MAP[profile.biological_profile] : null}
                emptyLabel="Pending calibration"
                emptyHint="Used to personalize lab interpretation."
                onAdd={startEditIdentity}
              />
              <div style={{ height: '1px', background: colors.cardBorder, margin: '14px 0' }} />
              <PassportRow
                label="Date of birth"
                value={profile.birth_date ? formatBirthDate(profile.birth_date) : null}
                emptyLabel="Not set yet"
                emptyHint="Tap Edit to add."
                onAdd={startEditIdentity}
              />
            </div>
          )}
        </div>

        {/* ══════════════════════════ HEALTH CONTEXT ═══ */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <span style={{ ...cardLabel, display: 'block', marginBottom: '4px' }}>Health Context</span>
              <p style={{ margin: 0, fontSize: '11px', color: colors.textMuted, lineHeight: 1.45 }}>
                Helps Meridian understand your body&apos;s baseline. Update it whenever things change.
              </p>
            </div>
            {editingSection !== 'health_context' && (
              <SmallButton onClick={startEditHealthContext}>Edit</SmallButton>
            )}
          </div>

          {editingSection === 'health_context' ? (
            <div>
              {/* ─── Group 1: Body stats ─── */}
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: colors.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Body stats</p>

              {/* Height */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                  <label style={fieldLabel}>Height</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['ftin', 'cm'] as const).map(u => (
                      <button key={u} type="button" onClick={() => setEditHeightUnit(u)} style={{
                        padding: '2px 9px', borderRadius: '6px', border: editHeightUnit === u ? '1px solid rgba(45,212,191,0.6)' : `1px solid ${colors.cardBorder}`,
                        background: editHeightUnit === u ? 'rgba(45,212,191,0.10)' : 'transparent',
                        color: editHeightUnit === u ? colors.teal : colors.textMuted,
                        fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui,
                      }}>{u === 'ftin' ? 'ft / in' : 'cm'}</button>
                    ))}
                  </div>
                </div>
                {editHeightUnit === 'ftin' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <input type="number" min="0" max="9" value={editHeightFt} onChange={e => setEditHeightFt(e.target.value)} placeholder="5" style={{ ...inputStyle }} />
                      <p style={{ ...fieldHint, marginTop: '4px' }}>Feet</p>
                    </div>
                    <div>
                      <input type="number" min="0" max="11" value={editHeightIn} onChange={e => setEditHeightIn(e.target.value)} placeholder="4" style={{ ...inputStyle }} />
                      <p style={{ ...fieldHint, marginTop: '4px' }}>Inches (0–11)</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input type="number" min="0" value={editHeightCm} onChange={e => setEditHeightCm(e.target.value)} placeholder="162.6" style={inputStyle} />
                    <p style={fieldHint}>Centimetres</p>
                  </div>
                )}
              </div>

              {/* Weight */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                  <label style={fieldLabel}>Weight</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['lbs', 'kg'] as const).map(u => (
                      <button key={u} type="button" onClick={() => setEditWeightUnit(u)} style={{
                        padding: '2px 9px', borderRadius: '6px', border: editWeightUnit === u ? '1px solid rgba(45,212,191,0.6)' : `1px solid ${colors.cardBorder}`,
                        background: editWeightUnit === u ? 'rgba(45,212,191,0.10)' : 'transparent',
                        color: editWeightUnit === u ? colors.teal : colors.textMuted,
                        fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui,
                      }}>{u}</button>
                    ))}
                  </div>
                </div>
                <input
                  type="number" min="0" value={editWeightVal}
                  onChange={e => setEditWeightVal(e.target.value)}
                  placeholder={editWeightUnit === 'lbs' ? '150' : '68'}
                  style={inputStyle}
                />
                <p style={fieldHint}>{editWeightUnit === 'lbs' ? 'Pounds — stored as kg automatically' : 'Kilograms'}</p>
              </div>

              {/* Training days */}
              <div style={{ marginBottom: '22px' }}>
                <label style={fieldLabel}>Training days / week</label>
                <input
                  type="number" min="0" max="7" step="1" inputMode="numeric"
                  value={editTrainingDays}
                  onChange={e => { setEditTrainingDays(e.target.value); setEditDaysError(null) }}
                  placeholder="e.g. 4"
                  style={inputStyle}
                />
                {editDaysError ? (
                  <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#F87171', lineHeight: 1.45 }}>{editDaysError}</p>
                ) : (
                  <p style={fieldHint}>Enter one number from 0 to 7. If your week varies, choose your usual average.</p>
                )}
              </div>

              {/* ─── Group 2: Context ─── */}
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: colors.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Context</p>

              {/* Activity level */}
              <div style={{ marginBottom: '14px' }}>
                <label style={fieldLabel}>Activity level</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ALL_ACTIVITY_LEVELS.map(al => (
                    <button key={al} type="button" onClick={() => setEditActivityLevel(al)} style={{
                      textAlign: 'left', padding: '10px 13px', borderRadius: '10px',
                      border: editActivityLevel === al ? '1px solid rgba(45,212,191,0.75)' : `1px solid ${colors.cardBorder}`,
                      background: editActivityLevel === al ? 'rgba(45,212,191,0.09)' : colors.inputBg,
                      cursor: 'pointer', fontFamily: fonts.ui,
                    }}>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: editActivityLevel === al ? colors.teal : colors.text, marginBottom: '2px' }}>
                        {ACTIVITY_MAP[al].label}
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', color: editActivityLevel === al ? '#9EEFE4' : colors.textMuted }}>
                        {ACTIVITY_MAP[al].description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Current goal */}
              <div style={{ marginBottom: '14px' }}>
                <label style={fieldLabel}>Current goal</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ALL_GOAL_PHASES.map(gp => (
                    <button key={gp} type="button" onClick={() => setEditBodyGoalPhase(gp)} style={{
                      padding: '8px 12px', borderRadius: '10px',
                      border: editBodyGoalPhase === gp ? '1px solid rgba(45,212,191,0.75)' : `1px solid ${colors.cardBorder}`,
                      background: editBodyGoalPhase === gp ? 'rgba(45,212,191,0.09)' : colors.inputBg,
                      color: editBodyGoalPhase === gp ? colors.teal : colors.textSoft,
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui,
                    }}>
                      {GOAL_PHASE_MAP[gp]}
                    </button>
                  ))}
                </div>
                <p style={fieldHint}>What you are focused on right now. This can change.</p>
              </div>

              {/* Diet pattern */}
              <div style={{ marginBottom: '20px' }}>
                <label style={fieldLabel}>Diet pattern</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ALL_DIET_PATTERNS.map(dp => (
                    <button key={dp} type="button" onClick={() => setEditDietPattern(dp)} style={{
                      padding: '8px 12px', borderRadius: '10px',
                      border: editDietPattern === dp ? '1px solid rgba(45,212,191,0.75)' : `1px solid ${colors.cardBorder}`,
                      background: editDietPattern === dp ? 'rgba(45,212,191,0.09)' : colors.inputBg,
                      color: editDietPattern === dp ? colors.teal : colors.textSoft,
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui,
                    }}>
                      {DIET_MAP[dp]}
                    </button>
                  ))}
                </div>
                <p style={fieldHint}>Your usual eating pattern.</p>
              </div>

              <SaveFeedback status={saveStatus} />
              <EditActions onCancel={cancelEdit} onSave={saveHealthContext} saving={saving} saveLabel="Save health context" />
            </div>
          ) : (
            /* ─── Read-only view ─── */
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <ContextRow label="Height"    value={profile.height_cm    !== null ? displayHeight(profile.height_cm)          : null} />
              <div style={{ height: '1px', background: colors.cardBorder, margin: '12px 0' }} />
              <ContextRow label="Weight"    value={profile.weight_kg    !== null ? displayWeight(profile.weight_kg)          : null} />
              <div style={{ height: '1px', background: colors.cardBorder, margin: '12px 0' }} />
              <ContextRow label="Activity"  value={profile.activity_level  ? ACTIVITY_MAP[profile.activity_level].label      : null} />
              <div style={{ height: '1px', background: colors.cardBorder, margin: '12px 0' }} />
              <ContextRow label="Training"  value={profile.training_days  !== null ? `${profile.training_days} day${profile.training_days === 1 ? '' : 's'}/week` : null} />
              <div style={{ height: '1px', background: colors.cardBorder, margin: '12px 0' }} />
              <ContextRow label="Goal phase" value={profile.body_goal_phase ? GOAL_PHASE_MAP[profile.body_goal_phase]        : null} />
              <div style={{ height: '1px', background: colors.cardBorder, margin: '12px 0' }} />
              <ContextRow label="Diet"       value={profile.diet_pattern   ? DIET_MAP[profile.diet_pattern]                 : null} />
            </div>
          )}
        </div>

        {/* ════════════════════════════ HEALTH FOCUS ═══ */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <span style={cardLabel}>Health Focus Mode</span>
            {editingSection !== 'focus' && (
              <SmallButton onClick={startEditFocus}>Adjust</SmallButton>
            )}
          </div>

          {editingSection === 'focus' ? (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: colors.textSoft, lineHeight: 1.6 }}>
                Your health focus shapes how Meridian interprets results and prioritizes what matters.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {ALL_GOALS.map(goal => {
                  const isSelected = editUserProfile === goal
                  const info = GOAL_MAP[goal]
                  return (
                    <button key={goal} type="button" onClick={() => setEditUserProfile(goal)} style={{
                      textAlign: 'left', padding: '12px 14px', borderRadius: '12px',
                      border: isSelected ? '1px solid rgba(45,212,191,0.75)' : `1px solid ${colors.cardBorder}`,
                      background: isSelected ? 'rgba(45,212,191,0.09)' : colors.inputBg,
                      cursor: 'pointer', fontFamily: fonts.ui, transition: 'all 160ms ease',
                    }}>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: isSelected ? colors.teal : colors.text, marginBottom: '3px', letterSpacing: '-0.01em' }}>
                        {info.label}
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', color: isSelected ? '#9EEFE4' : colors.textMuted, lineHeight: 1.45 }}>
                        {info.description.slice(0, 74)}…
                      </span>
                    </button>
                  )
                })}
              </div>
              <SaveFeedback status={saveStatus} />
              <EditActions onCancel={cancelEdit} onSave={saveFocus} saving={saving} saveLabel="Save focus" disabled={!editUserProfile} />
            </div>
          ) : profile.user_profile && GOAL_MAP[profile.user_profile] ? (
            <div>
              {/* Mode label */}
              <p style={{ fontFamily: fonts.heading, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: colors.text, margin: '0 0 8px', lineHeight: 1.1 }}>
                {GOAL_MAP[profile.user_profile].label}
              </p>
              {/* Signal chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                {GOAL_SIGNALS[profile.user_profile].map(sig => (
                  <SignalChip key={sig}>{sig}</SignalChip>
                ))}
              </div>
              {/* Description */}
              <p style={{ margin: 0, fontSize: '13px', color: colors.textSoft, lineHeight: 1.65 }}>
                {GOAL_MAP[profile.user_profile].description}
              </p>
            </div>
          ) : (
            /* Empty state */
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: colors.textSoft }}>No health focus set</p>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: colors.textMuted, lineHeight: 1.55 }}>
                Choose how Meridian should personalize your insights.
              </p>
              <SmallButton onClick={startEditFocus}>Set focus</SmallButton>
            </div>
          )}
        </div>

        {/* ═══════════════════════════ MEDICATIONS ═══ */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <span style={cardLabel}>Medications</span>
            {editingSection !== 'medications' && (
              <SmallButton onClick={startEditMeds}>
                {profile.medications && profile.medications.length > 0 ? 'Edit' : 'Add'}
              </SmallButton>
            )}
          </div>

          {editingSection === 'medications' ? (
            <div>
              {/* Current list */}
              {editMedList.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  {editMedList.map((med, i) => (
                    <div key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '5px 10px', borderRadius: '20px',
                      background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.20)',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, letterSpacing: '-0.01em' }}>{med}</span>
                      <button
                        type="button"
                        onClick={() => removeMedEntry(i)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 2px',
                          color: colors.textMuted, fontSize: '14px', lineHeight: 1, fontFamily: fonts.ui,
                          display: 'flex', alignItems: 'center',
                        }}
                        aria-label={`Remove ${med}`}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Add input */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={editMedInput}
                  onChange={e => setEditMedInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMedEntry() } }}
                  placeholder="e.g. Levothyroxine"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={addMedEntry}
                  disabled={!editMedInput.trim()}
                  style={{
                    padding: '0 16px', borderRadius: '10px', border: 'none',
                    background: editMedInput.trim() ? 'rgba(45,212,191,0.14)' : 'rgba(45,212,191,0.05)',
                    color: editMedInput.trim() ? colors.teal : colors.textMuted,
                    fontSize: '13px', fontWeight: 700, cursor: editMedInput.trim() ? 'pointer' : 'not-allowed',
                    fontFamily: fonts.ui, whiteSpace: 'nowrap',
                  }}
                >
                  Add
                </button>
              </div>
              <p style={fieldHint}>Separate medications as individual entries. Name only — dose and frequency coming later.</p>
              <div style={{ marginTop: '16px' }}>
                <SaveFeedback status={saveStatus} />
                <EditActions onCancel={cancelEdit} onSave={saveMeds} saving={saving} saveLabel="Save medications" />
              </div>
            </div>
          ) : profile.medications && profile.medications.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {profile.medications.map((med, i) => (
                <div key={i} style={{
                  padding: '5px 12px', borderRadius: '20px',
                  background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.18)',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textSoft }}>{med}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted, fontStyle: 'italic' }}>
              None reported. Tap Add to list current medications.
            </p>
          )}
        </div>

        {/* ═══════════════════════════ PLAN PROTOCOLS ═══ */}
        <div style={{ marginBottom: '10px' }}>
          <Glp1ProtocolToggle />
        </div>

        {/* ════════════════════════ DATA CONSTELLATION ═══ */}
        <div style={cardStyle}>
          <span style={{ ...cardLabel, display: 'block', marginBottom: '6px' }}>Data Constellation</span>
          <p style={{ margin: '0 0 18px', fontSize: '12px', color: colors.textMuted, lineHeight: 1.55 }}>
            Meridian gets smarter as your biological signals connect.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ConstellationNode name="Lab Results"   description="Blood panels, metabolic markers, CBC"  status={hasLabs ? 'connected' : 'disconnected'} />
            <ConstellationNode name="Wearables"     description="Continuous vitals, HRV, sleep data"    status="soon" />
            <ConstellationNode name="Genetic Data"  description="SNP analysis, pharmacogenomics"         status="soon" />
            <ConstellationNode name="Feedback Loop" description="Insight accuracy improves over time"    status="soon" />
          </div>
        </div>

        {/* ════════════════════ PERSONALIZATION MATRIX ═══ */}
        <div style={cardStyle}>
          <span style={{ ...cardLabel, display: 'block', marginBottom: '6px' }}>Personalization Matrix</span>
          <p style={{ margin: '0 0 18px', fontSize: '12px', color: colors.textMuted, lineHeight: 1.55 }}>
            Complete your profile to improve context over time. Meridian interprets. You decide.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {matrixRows.map((row, i) => (
              <div key={row.label}>
                <MatrixRowItem label={row.label} description={row.description} status={row.status} />
                {i < matrixRows.length - 1 && (
                  <div style={{ height: '1px', background: colors.cardBorder, margin: '0' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════ SYSTEM ACCESS (admins only) ═══ */}
        {isAdmin && (
          <div style={{
            background:          'rgba(103,232,249,0.03)',
            border:              '1px solid rgba(103,232,249,0.12)',
            borderRadius:        '20px',
            backdropFilter:      'blur(24px)',
            WebkitBackdropFilter:'blur(24px)',
            padding:             '22px',
            marginBottom:        '10px',
            boxShadow:           'inset 0 1px 0 rgba(103,232,249,0.06)',
          }}>
            {/* Section label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{
                fontSize:      '10px',
                fontWeight:    700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color:         colors.textMuted,
              }}>
                System Access
              </span>
              <div style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          '5px',
                padding:      '2px 8px',
                borderRadius: '20px',
                background:   'rgba(103,232,249,0.06)',
                border:       '1px solid rgba(103,232,249,0.16)',
              }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.cyan, boxShadow: '0 0 5px rgba(103,232,249,0.8)' }} />
                <span style={{ fontSize: '9px', fontWeight: 700, color: colors.cyan, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  Operator Console Enabled
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 18px', fontSize: '12px', color: colors.textMuted, lineHeight: 1.55 }}>
              Administrative access is active for this account.
            </p>

            <button
              onClick={() => window.location.href = '/admin'}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                width:          '100%',
                padding:        '12px 16px',
                borderRadius:   '12px',
                border:         '1px solid rgba(103,232,249,0.15)',
                background:     'rgba(103,232,249,0.05)',
                cursor:         'pointer',
                fontFamily:     fonts.ui,
                transition:     'all 0.18s ease',
                boxSizing:      'border-box',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background     = 'rgba(103,232,249,0.10)'
                el.style.borderColor    = 'rgba(103,232,249,0.28)'
                el.style.boxShadow      = '0 0 14px rgba(103,232,249,0.08)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background     = 'rgba(103,232,249,0.05)'
                el.style.borderColor    = 'rgba(103,232,249,0.15)'
                el.style.boxShadow      = 'none'
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textSoft, letterSpacing: '-0.01em' }}>
                Open Admin Console
              </span>
              <span style={{ fontSize: '16px', color: colors.textMuted, lineHeight: 1 }}>›</span>
            </button>
          </div>
        )}

        {/* ════════════════════════════ CONTROL LAYER ═══ */}
        <div style={cardStyle}>
          <span style={{ ...cardLabel, display: 'block', marginBottom: '4px' }}>Control Layer</span>
          <p style={{ margin: '0 0 18px', fontSize: '12px', color: colors.textMuted, lineHeight: 1.5 }}>
            Your Meridian experience, on your terms.
          </p>

          <div>
            {/* App preferences */}
            <div style={{
              padding: '13px 0',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '14px', color: colors.textSoft, fontWeight: 700 }}>App preferences</span>
                  <p style={{ margin: '3px 0 0', fontSize: '11px', color: colors.textMuted, lineHeight: 1.4 }}>
                    Language and interface settings.
                  </p>
                </div>
                <span style={{
                  fontSize: '10px',
                  color: colors.textMuted,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'rgba(95,142,133,0.10)',
                  border: '1px solid rgba(95,142,133,0.18)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                }}>
                  {lang === 'es' ? 'Español' : 'English'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(['en', 'es'] as MeridianLanguage[]).map(option => {
                  const active = lang === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setLanguage(option)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: active ? '1px solid rgba(45,212,191,0.72)' : `1px solid ${colors.cardBorder}`,
                        background: active ? 'rgba(45,212,191,0.09)' : colors.inputBg,
                        color: active ? colors.teal : colors.textSoft,
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontFamily: fonts.ui,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {option === 'es' ? 'Español' : 'English'}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Data sources */}
            <ControlRow label="Data sources" soon />
            {/* Privacy controls */}
            <ControlRow label="Privacy controls" soon />
            {/* Sign out */}
            <button
              onClick={handleSignOut}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: fonts.ui, padding: '13px 0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#F87171' }}>Sign out</span>
              <span style={{ fontSize: '14px', color: colors.textMuted }}>›</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: '11px', color: colors.textMuted, marginTop: '16px', opacity: 0.35, letterSpacing: '0.04em' }}>
          Meridian · Health Intelligence System
        </p>

      </div>
      <NavBar />
    </div>
  )
}

// ════════════════════════════════ SHARED STYLES ═══

const cardStyle: React.CSSProperties = {
  background: colors.cardBg,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: '20px',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  padding: '22px',
  marginBottom: '10px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const cardLabel: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  color: colors.textMuted,
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: colors.inputBg, border: `1px solid ${colors.cardBorder}`,
  borderRadius: '10px', padding: '11px 14px',
  color: colors.text, fontSize: '14px', fontFamily: fonts.ui,
  outline: 'none', colorScheme: 'dark',
}

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700,
  color: colors.textMuted, letterSpacing: '0.06em',
  textTransform: 'uppercase', marginBottom: '7px',
}

const fieldHint: React.CSSProperties = {
  margin: '5px 0 0', fontSize: '11px', color: colors.textMuted, lineHeight: 1.45,
}

// ════════════════════════════════ SUB-COMPONENTS ═══

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.20)',
      borderRadius: '8px', color: colors.teal, fontSize: '11px', fontWeight: 700,
      cursor: 'pointer', padding: '4px 11px', fontFamily: fonts.ui, letterSpacing: '-0.01em',
    }}>
      {children}
    </button>
  )
}

function HeroChip({ children, active, dim }: { children: React.ReactNode; active?: boolean; dim?: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: '20px',
      background: active ? 'rgba(45,212,191,0.08)' : 'rgba(95,142,133,0.07)',
      border: active ? '1px solid rgba(45,212,191,0.20)' : '1px solid rgba(95,142,133,0.18)',
    }}>
      {active && (
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 5px rgba(45,212,191,0.8)', flexShrink: 0 }} />
      )}
      <span style={{
        fontSize: '11px', fontWeight: 700,
        color: active ? colors.teal : (dim ? colors.textMuted : colors.textSoft),
        letterSpacing: '-0.01em',
      }}>
        {children}
      </span>
    </div>
  )
}

function PassportRow({ label, value, emptyLabel, emptyHint, onAdd }: {
  label: string
  value: string | null | undefined
  emptyLabel?: string
  emptyHint?: string
  onAdd?: () => void
}) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: colors.textMuted, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '5px' }}>
        {label}
      </span>
      {value ? (
        <span style={{ fontSize: '15px', fontWeight: 600, color: colors.text, letterSpacing: '-0.01em' }}>{value}</span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textMuted, fontStyle: 'italic' }}>
            {emptyLabel ?? 'Not set'}
          </span>
          {emptyHint && (
            <span style={{ fontSize: '11px', color: colors.textMuted, opacity: 0.7 }}>{emptyHint}</span>
          )}
          {onAdd && (
            <button type="button" onClick={onAdd} style={{
              background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.25)',
              borderRadius: '20px', cursor: 'pointer', padding: '3px 10px',
              color: colors.teal, fontSize: '11px', fontWeight: 700, fontFamily: fonts.ui,
              letterSpacing: '-0.01em', display: 'inline-flex', alignItems: 'center', gap: '3px',
            }}>
              Complete identity <span style={{ fontSize: '13px', lineHeight: 1 }}>›</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ContextRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, color: colors.textMuted, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: value ? colors.text : colors.textMuted, fontStyle: value ? 'normal' : 'italic', textAlign: 'right' }}>
        {value ?? 'Not set yet'}
      </span>
    </div>
  )
}

function SignalChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 9px', borderRadius: '8px',
      background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.18)',
      fontSize: '11px', fontWeight: 700, color: colors.teal, letterSpacing: '0.02em',
    }}>
      <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 4px rgba(45,212,191,0.8)' }} />
      {children}
    </span>
  )
}

function ConstellationNode({ name, description, status }: {
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'soon'
}) {
  const cfg = {
    connected:    { label: 'Connected',     color: '#2DD4BF', bg: 'rgba(45,212,191,0.08)',  border: 'rgba(45,212,191,0.22)', dot: true },
    disconnected: { label: 'Not connected', color: '#5F8E85', bg: 'rgba(95,142,133,0.07)',  border: 'rgba(95,142,133,0.18)', dot: false },
    soon:         { label: 'Coming soon',   color: '#5F8E85', bg: 'rgba(95,142,133,0.07)',  border: 'rgba(95,142,133,0.18)', dot: false },
  }[status]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px',
      background: status === 'connected' ? 'rgba(45,212,191,0.03)' : 'rgba(232,248,245,0.02)',
      border: `1px solid ${status === 'connected' ? 'rgba(45,212,191,0.14)' : colors.cardBorder}`,
      borderRadius: '12px', gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        {/* Node dot indicator */}
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
          background: status === 'connected' ? 'rgba(45,212,191,0.3)' : 'rgba(95,142,133,0.2)',
          border: status === 'connected' ? '1.5px solid rgba(45,212,191,0.7)' : '1.5px solid rgba(95,142,133,0.4)',
          boxShadow: status === 'connected' ? '0 0 8px rgba(45,212,191,0.4)' : 'none',
        }} />
        <div>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: '1px' }}>{name}</span>
          <span style={{ display: 'block', fontSize: '11px', color: colors.textMuted, lineHeight: 1.4 }}>{description}</span>
        </div>
      </div>
      <div style={{
        flexShrink: 0, padding: '3px 8px', borderRadius: '7px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        {cfg.dot && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: cfg.color, boxShadow: '0 0 5px rgba(45,212,191,0.8)' }} />}
        <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

function MatrixRowItem({ label, description, status }: {
  label: string
  description: string
  status: 'active' | 'pending' | 'soon'
}) {
  const cfg = {
    active:  { label: 'Active',   color: '#2DD4BF', bg: 'rgba(45,212,191,0.07)',  border: 'rgba(45,212,191,0.20)' },
    pending: { label: 'Pending',  color: '#FCD34D', bg: 'rgba(252,211,77,0.07)',  border: 'rgba(252,211,77,0.22)' },
    soon:    { label: 'Soon',     color: '#5F8E85', bg: 'rgba(95,142,133,0.07)',  border: 'rgba(95,142,133,0.18)' },
  }[status]

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', gap: '12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: status === 'active' ? colors.text : colors.textSoft, marginBottom: '2px' }}>
          {label}
        </span>
        <span style={{ display: 'block', fontSize: '11px', color: colors.textMuted, lineHeight: 1.4 }}>{description}</span>
      </div>
      <div style={{
        flexShrink: 0, padding: '3px 9px', borderRadius: '7px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

function ControlRow({ label, soon }: { label: string; soon?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 0', borderBottom: `1px solid ${colors.cardBorder}`,
    }}>
      <span style={{ fontSize: '14px', color: colors.textMuted, fontWeight: 600 }}>{label}</span>
      {soon && (
        <span style={{
          fontSize: '10px', color: colors.textMuted, fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'rgba(95,142,133,0.10)', border: '1px solid rgba(95,142,133,0.18)',
          borderRadius: '6px', padding: '2px 8px',
        }}>
          Soon
        </span>
      )}
    </div>
  )
}

function SaveFeedback({ status }: { status: 'idle' | 'success' | 'error' }) {
  if (status === 'idle') return null
  return (
    <p style={{ margin: '0 0 12px', fontSize: '12px', lineHeight: 1.4, color: status === 'success' ? colors.teal : '#F87171' }}>
      {status === 'success' ? 'Saved.' : 'Something went wrong. Please try again.'}
    </p>
  )
}

function EditActions({ onCancel, onSave, saving, saveLabel, disabled }: {
  onCancel: () => void
  onSave: () => void
  saving: boolean
  saveLabel: string
  disabled?: boolean
}) {
  const inactive = saving || disabled
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button type="button" onClick={onCancel} style={{
        flex: 1, padding: '10px', borderRadius: '10px',
        background: 'transparent', border: `1px solid ${colors.cardBorder}`,
        color: colors.textSoft, fontSize: '13px', fontWeight: 700,
        cursor: 'pointer', fontFamily: fonts.ui,
      }}>
        Cancel
      </button>
      <button type="button" onClick={onSave} disabled={!!inactive} style={{
        flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
        background: inactive ? 'rgba(45,212,191,0.22)' : 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)',
        color: '#061316', fontSize: '13px', fontWeight: 700,
        cursor: inactive ? 'not-allowed' : 'pointer', fontFamily: fonts.ui,
        boxShadow: inactive ? 'none' : '0 0 18px rgba(45,212,191,0.28)',
      }}>
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  )
}
