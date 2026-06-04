'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import NavBar from '@/components/NavBar'
import { getSafetyStatusForBiomarker } from '@/lib/safety-engine'
import { getNextOnboardingStep } from '@/lib/onboarding'
import { useMeridianLanguage, type MeridianLanguage } from '@/lib/i18n'

const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  recovery: 'rgba(45,212,191,0.07)',
  recoveryBorder: 'rgba(45,212,191,0.3)',
  alert: 'rgba(248,113,113,0.07)',
  alertBorder: 'rgba(248,113,113,0.3)',
  optimal: 'rgba(74,222,128,0.07)',
  optimalBorder: 'rgba(74,222,128,0.3)',
  sidebarBg: '#071A1E',
  sidebarBorder: 'rgba(103,232,249,0.08)',
}

const fonts = {
  heading: '"Fraunces", serif',
  ui: '"Plus Jakarta Sans", sans-serif',
}

// ─── Breakpoint helpers ────────────────────────────────────────────────────────
const DESKTOP_BP = 768

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BP}px)`)
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

interface GoldenInsight {
  headline: string
  status: string
  cause: string
  action_steps: string[]
  trust_line: string
  block_color: 'recovery' | 'alert' | 'optimal'
  logic_trace: string
}

interface UpcomingHealthEvent {
  id: string
  event_type: string | null
  title: string | null
  specialty: string | null
  provider_name: string | null
  starts_at: string
  location: string | null
  is_virtual: boolean | null
  prep_status: string | null
}

function getBlockColors(blockColor: string) {
  switch (blockColor) {
    case 'alert':   return { bg: colors.alert,   border: colors.alertBorder,   accent: '#F87171' }
    case 'optimal': return { bg: colors.optimal, border: colors.optimalBorder, accent: '#4ADE80' }
    default:        return { bg: colors.recovery, border: colors.recoveryBorder, accent: colors.teal }
  }
}

function formatUpcomingEventDate(value: string, lang: MeridianLanguage): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return lang === 'es' ? 'Fecha pendiente' : 'Date pending'
  return date.toLocaleDateString(lang === 'es' ? 'es-PR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatUpcomingEventTime(value: string, lang: MeridianLanguage): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(lang === 'es' ? 'es-PR' : 'en-US', { hour: 'numeric', minute: '2-digit' })
}

function getPrepStatusLabel(status: string | null, lang: MeridianLanguage): string {
  switch (status) {
    case 'ready':       return lang === 'es' ? 'Preparación lista'        : 'Prep ready'
    case 'in_progress': return lang === 'es' ? 'Preparación en progreso'  : 'Prep in progress'
    default:            return lang === 'es' ? 'Preparación pendiente'    : 'Prep pending'
  }
}

function getFirstName(fullName: string): string {
  if (!fullName || fullName === 'there') return ''
  const first = fullName.trim().split(' ')[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

interface GreetingContext {
  state?:       string
  blockColor?:  string
  safetyAlert?: boolean
}

function getTimeGreeting(
  firstName: string,
  lang: MeridianLanguage = 'en',
  ctx?: GreetingContext,
): { greeting: string; subline: string } {
  const hour     = new Date().getHours()
  const dayIndex = new Date().getDay()
  const period   = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening'

  const prefix = lang === 'es'
    ? period === 'morning' ? 'Buenos días' : period === 'afternoon' ? 'Buenas tardes' : 'Buenas noches'
    : period === 'morning' ? 'Good morning' : period === 'afternoon' ? 'Good afternoon' : 'Good evening'

  const greeting = firstName ? `${prefix}, ${firstName}` : `${prefix}.`

  if (ctx) {
    const { state, blockColor, safetyAlert } = ctx
    if (safetyAlert || blockColor === 'alert') {
      const lines = ['Something in your recent markers warrants a closer look today.','Tu cuerpo está señalando algo que merece atención ahora mismo.','One of your recent signals is asking for a careful review.','A result from your last labs merits attention before moving on.','Tu biología está mostrando una señal que merece seguimiento.']
      return { greeting, subline: lines[dayIndex % lines.length] }
    }
    if (blockColor === 'optimal') {
      const lines = ['Recovery systems appear to be responding well.','Tu biología se está moviendo en una dirección favorable.',lang === 'es' ? 'Tus patrones de biomarcadores se ven estables y bien respaldados por ahora.' : 'Biomarker patterns look stable and well-supported right now.','Tu cuerpo está mostrando una buena fase de recuperación sistémica.','Tus marcadores actuales sugieren que tu biología está cerca de su rango óptimo.','Tu sistema muestra señales de balance. Buen día para mantener el ritmo.']
      return { greeting, subline: lines[dayIndex % lines.length] }
    }
    if (blockColor === 'recovery') {
      const lines = ['Recovery capacity appears lower than baseline today.','Tu biología está favoreciendo recuperación sobre esfuerzo ahora mismo.','Tu estado actual de recuperación sugiere una carga más ligera hoy.',`Recovery systems appear more sensitive this ${period}.`,'Tu cuerpo está señalando una necesidad de recuperación hoy.','Lower recovery markers suggest your system is asking for rest.','Tu biología está en una fase de recuperación. Vale la pena respetarlo.']
      return { greeting, subline: lines[dayIndex % lines.length] }
    }
    if (state === 'calibrating') {
      const lines = ['Tu línea base biológica todavía se está construyendo.','More data helps Meridian read your patterns with confidence.','Each upload sharpens how Meridian interprets your biology.']
      return { greeting, subline: lines[dayIndex % lines.length] }
    }
    if (state === 'labs_saved') {
      const lines = ['Tus laboratorios ya están dentro. Meridian está mapeando tu línea base biológica.','Datos recibidos. Tu panorama biológico está tomando forma.','Tus biomarcadores se están integrando a tu línea base.']
      return { greeting, subline: lines[dayIndex % lines.length] }
    }
    if (state === 'no_data') {
      const lines = ['Tu inteligencia de salud comienza con tu primer laboratorio.',lang === 'es' ? 'Sube tus laboratorios para desbloquear tu panorama biológico.' : 'Upload your labs to unlock your biological picture.','Meridian está listo. Tu biología es el punto de partida.']
      return { greeting, subline: lines[dayIndex % lines.length] }
    }
  }

  const ambient = {
    morning:   ['Tus señales de la noche están listas para revisar.',"A quiet moment before the day builds. Here's your read.",'Tu cuerpo ha estado trabajando desde el sueño.','A good time to check in on your biology.','Tu ventana de recuperación está cerrando. Así estás ahora.'],
    afternoon: ["Here's where your biology stands right now.",'A mid-day check-in on your body\'s current state.','Tus biomarcadores tienen algo que decir.','Tu sistema ha estado registrando señales toda la mañana.','Tu biología está en pleno ciclo ahora mismo.'],
    evening:   ['Tu cuerpo ha estado trabajando hoy.','A good time to review before your recovery window opens.','The day\'s signals are in.','Tu sistema tiene datos que vale la pena revisar esta noche.','Tu ciclo de recuperación se acerca. Esta es la lectura de hoy.'],
  }
  return { greeting, subline: ambient[period][dayIndex % ambient[period].length] }
}

// ─── Sidebar (desktop only) ────────────────────────────────────────────────────
function DesktopSidebar({ lang, userName, currentPath }: { lang: MeridianLanguage; userName: string; currentPath: string }) {
  const router = useRouter()
  const firstName = getFirstName(userName)

  const navItems = [
    { path: '/dashboard',   icon: '⌂', label: lang === 'es' ? 'Inicio'         : 'Home'      },
    { path: '/labs/upload', icon: '⬡', label: lang === 'es' ? 'Laboratorios'   : 'Labs'      },
    { path: '/protocol',    icon: '◈', label: lang === 'es' ? 'Plan'           : 'Plan'      },
    { path: '/timeline',    icon: '◷', label: lang === 'es' ? 'Agenda'         : 'Agenda'    },
  ]

  return (
    <aside style={{
      width: '200px',
      flexShrink: 0,
      background: colors.sidebarBg,
      borderRight: `0.5px solid ${colors.sidebarBorder}`,
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{
        padding: '22px 18px 18px',
        borderBottom: `0.5px solid ${colors.sidebarBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{
          fontFamily: 'var(--font-fraunces), serif',
          fontSize: '22px', fontWeight: 700, lineHeight: 1,
          background: 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 45%, #2DD4BF 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          filter: 'drop-shadow(0 0 8px rgba(45,212,191,0.55))',
        }}>M</span>
        <span style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '15px', fontWeight: 700, color: colors.text, letterSpacing: '-0.03em' }}>
          Meridian
        </span>
      </div>

      {/* Nav */}
      <nav style={{ padding: '14px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map(item => {
          const active = currentPath === item.path
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '9px 10px', borderRadius: '7px',
                border: 'none', cursor: 'pointer',
                background: active ? 'rgba(45,212,191,0.09)' : 'transparent',
                color: active ? colors.text : colors.textMuted,
                fontSize: '13px', fontWeight: 500,
                textAlign: 'left', width: '100%',
              }}
            >
              <span style={{ fontSize: '14px', color: active ? colors.teal : colors.textMuted, width: '16px', textAlign: 'center' }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '14px 12px',
        borderTop: `0.5px solid ${colors.sidebarBorder}`,
        display: 'flex', alignItems: 'center', gap: '9px',
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: 'rgba(45,212,191,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 600, color: colors.teal, flexShrink: 0,
        }}>
          {firstName ? firstName.slice(0, 2).toUpperCase() : 'M'}
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: colors.textSoft }}>{firstName || 'Meridian'}</div>
          <div style={{ fontSize: '10px', color: colors.textMuted }}>{lang === 'es' ? 'Plan activo' : 'Active plan'}</div>
        </div>
      </div>
    </aside>
  )
}

// ─── Top bar (desktop only) ────────────────────────────────────────────────────
function DesktopTopBar({ lang, currentPage }: { lang: MeridianLanguage; currentPage: string }) {
  const router = useRouter()
  return (
    <header style={{
      height: '48px',
      borderBottom: `0.5px solid ${colors.sidebarBorder}`,
      display: 'flex', alignItems: 'center',
      padding: '0 28px', gap: '10px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.teal, flexShrink: 0 }} />
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>
          {new Date().toLocaleDateString(lang === 'es' ? 'es-PR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>
      <button
        onClick={() => router.push('/notifications')}
        style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'rgba(6,19,22,0.82)', border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(20px)' }}
        aria-label="Notifications"
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke={colors.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2A4.5 4.5 0 0 0 5.5 6.5v3.2L4 12h12l-1.5-2.3V6.5A4.5 4.5 0 0 0 10 2Z" />
          <path d="M8.5 14.5a1.5 1.5 0 0 0 3 0" />
        </svg>
      </button>
      <button
        onClick={() => router.push('/profile')}
        style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'rgba(6,19,22,0.82)', border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(20px)' }}
        aria-label="Profile"
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke={colors.textSoft} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="6.5" r="3" />
          <path d="M3 18c0-3.9 3.1-6 7-6s7 2.1 7 6" />
        </svg>
      </button>
    </header>
  )
}

// ─── Wearable score pills ──────────────────────────────────────────────────────
function WearableScores({ lang }: { lang: MeridianLanguage }) {
  // Placeholder — will be replaced by real Oura data once wearable integration is live
  const scores = [
    { value: '—', color: colors.teal,        label: lang === 'es' ? 'Readiness' : 'Readiness' },
    { value: '—', color: colors.cyan,         label: lang === 'es' ? 'Sueño'     : 'Sleep'     },
    { value: '—', color: '#A78BFA',           label: 'HRV'                                    },
  ]

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {scores.map(s => (
        <div key={s.label} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(45,212,191,0.04)',
          border: `0.5px solid rgba(45,212,191,0.12)`,
          borderRadius: '10px',
          padding: '9px 16px',
        }}>
          <span style={{ fontFamily: fonts.heading, fontSize: '18px', fontWeight: 700, color: s.color, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {s.value}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: colors.textMuted }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Dashboard Timeline Card ───────────────────────────────────────────────────
function DashboardTimelineCard({ event, onOpen, lang }: { event: UpcomingHealthEvent | null; onOpen: () => void; lang: MeridianLanguage }) {
  const hasEvent   = Boolean(event)
  const title      = event?.title || event?.specialty || (lang === 'es' ? 'Próxima cita' : 'Upcoming appointment')
  const subtitle   = event?.provider_name || event?.specialty || (lang === 'es' ? 'Añade tu próxima cita médica o fecha importante.' : 'Add your next appointment or important health date.')
  const dateLabel  = event ? formatUpcomingEventDate(event.starts_at, lang) : (lang === 'es' ? 'Sin cita próxima' : 'No upcoming date')
  const timeLabel  = event ? formatUpcomingEventTime(event.starts_at, lang) : ''
  const locationLabel = event?.is_virtual ? 'Telehealth / Virtual' : event?.location

  return (
    <motion.div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen() }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.22 }}
      style={{
        padding: '18px', borderRadius: '22px',
        background: 'linear-gradient(135deg, rgba(232,248,245,0.075) 0%, rgba(103,232,249,0.045) 100%)',
        border: `1px solid ${colors.cardBorder}`,
        backdropFilter: 'blur(28px)',
        cursor: 'pointer', outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: colors.teal, marginBottom: '5px' }}>
            {lang === 'es' ? 'Agenda de salud' : 'Health Agenda'}
          </div>
          <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: 1.45 }}>
            {lang === 'es' ? 'Próximas citas, preparación y documentos clave.' : 'Upcoming appointments, prep, and key documents.'}
          </div>
        </div>
        <div style={{ width: '38px', height: '38px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(45,212,191,0.09)', border: '1px solid rgba(45,212,191,0.22)', flexShrink: 0 }}>
          <span style={{ fontSize: '18px' }}>📅</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
        <div style={{ minWidth: '92px', padding: '12px 10px', borderRadius: '16px', background: 'rgba(6,19,22,0.42)', border: '1px solid rgba(103,232,249,0.10)', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: colors.textSoft, fontWeight: 700, lineHeight: 1.35 }}>{dateLabel}</div>
          {timeLabel && <div style={{ marginTop: '5px', fontSize: '11px', color: colors.textMuted, fontWeight: 600 }}>{timeLabel}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: colors.text, letterSpacing: '-0.02em', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ fontSize: '12px', color: colors.textSoft, lineHeight: 1.5, marginBottom: '8px' }}>{subtitle}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', alignItems: 'center' }}>
            <span style={{ padding: '5px 9px', borderRadius: '999px', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.16)', color: colors.textSoft, fontSize: '10.5px', fontWeight: 700 }}>
              {hasEvent ? getPrepStatusLabel(event?.prep_status ?? null, lang) : (lang === 'es' ? 'Crear primera fecha' : 'Add first date')}
            </span>
            {locationLabel && (
              <span style={{ padding: '5px 9px', borderRadius: '999px', background: 'rgba(103,232,249,0.06)', border: '1px solid rgba(103,232,249,0.14)', color: colors.textMuted, fontSize: '10.5px', fontWeight: 600 }}>
                {locationLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router   = useRouter()
  const [lang]   = useMeridianLanguage()
  const isDesktop = useIsDesktop()
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  ), [])

  const [loading,          setLoading]          = useState(true)
  const [userName,         setUserName]          = useState('')
  const [state,            setState]             = useState<string>('loading')
  const [insight,          setInsight]           = useState<GoldenInsight | null>(null)
  const [dominantMarker,   setDominantMarker]    = useState<string | null>(null)
  const [safetyAlert,      setSafetyAlert]       = useState(false)
  const [hasCriticalMarker,setHasCriticalMarker] = useState(false)
  const [nextHealthEvent,  setNextHealthEvent]   = useState<UpcomingHealthEvent | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/onboarding/welcome'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, birth_date, onboarding_completed, biological_profile, current_state, user_profile')
        .eq('id', user.id)
        .single()

      const nextStep = getNextOnboardingStep(profile)
      if (nextStep) { router.push(nextStep); return }

      setUserName(profile?.full_name || 'there')

      try {
        const { data: upcomingEvent } = await (supabase as any)
          .from('health_events')
          .select('id, event_type, title, specialty, provider_name, starts_at, location, is_virtual, prep_status')
          .eq('user_id', user.id)
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        setNextHealthEvent((upcomingEvent ?? null) as UpcomingHealthEvent | null)
      } catch (err) {
        console.error('[Meridian] Upcoming health event error:', err)
        setNextHealthEvent(null)
      }

      const { count: biomarkerCount } = await supabase
        .from('biomarkers_static')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      const hasBiomarkers = typeof biomarkerCount === 'number' && biomarkerCount > 0

      let localCritical = false
      if (hasBiomarkers) {
        const { data: recentForSafety } = await supabase
          .from('biomarkers_static')
          .select('marker_name, value, unit')
          .eq('user_id', user.id)
          .order('collected_at', { ascending: false })
          .limit(60)
        if (recentForSafety && recentForSafety.length > 0) {
          const bioprofile = profile?.biological_profile ?? 'female'
          localCritical = recentForSafety.some(b =>
            b.value !== null &&
            getSafetyStatusForBiomarker(b.marker_name, b.value, b.unit ?? '', bioprofile).status === 'critical'
          )
          if (localCritical) { setHasCriticalMarker(true); setSafetyAlert(true) }
        }
      }

      try {
        const response = await fetch(`/api/insight?lang=${lang}`)
        const data     = await response.json()
        if (data.success && data.state !== 'no_data' && data.state !== 'insight_unavailable') {
          setState(data.state)
          setInsight(data.insight)
          setDominantMarker(data.dominant_marker)
          setSafetyAlert(localCritical || Boolean(data.safety_alert))
        } else {
          setState(hasBiomarkers ? 'labs_saved' : 'no_data')
        }
      } catch (err) {
        console.error('[Meridian] Insight fetch/parse error:', err)
        setState(hasBiomarkers ? 'labs_saved' : 'no_data')
      }

      setLoading(false)
    }
    loadDashboard()
  }, [router, supabase, lang])

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.teal}18 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${colors.cyan}14 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{ width: '48px', height: '48px', border: `2px solid ${colors.cardBorder}`, borderTopColor: colors.teal, borderRadius: '50%' }}
        />
      </div>
    )
  }

  const { greeting, subline } = getTimeGreeting(getFirstName(userName), lang, { state, blockColor: insight?.block_color, safetyAlert })

  // ── DESKTOP layout ────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: fonts.ui, display: 'flex' }}>
        <DesktopSidebar lang={lang} userName={userName} currentPath="/dashboard" />

        {/* Main area — offset by sidebar width */}
        <div style={{ marginLeft: '200px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <DesktopTopBar lang={lang} currentPage="dashboard" />

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 48px' }}>

            {/* ── HERO: full width — greeting + wearables ── */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                paddingBottom: '24px',
                marginBottom: '24px',
                borderBottom: `0.5px solid ${colors.sidebarBorder}`,
              }}
            >
              {/* Greeting — single line */}
              <div style={{ fontFamily: fonts.heading, fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '6px' }}>
                <span style={{ color: colors.text }}>{greeting.includes(', ') ? greeting.slice(0, greeting.indexOf(', ') + 1) : greeting}</span>
                {greeting.includes(', ') && (
                  <span style={{ background: 'linear-gradient(90deg, #F8FFFC 0%, #67E8F9 45%, #2DD4BF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    {' '}{greeting.slice(greeting.indexOf(', ') + 2)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '14px', color: colors.textSoft, lineHeight: 1.65, marginBottom: '18px' }}>
                {subline}
              </div>
              <WearableScores lang={lang} />
            </motion.div>

            {/* ── FULL WIDTH: Intelligence Block ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{ marginBottom: '20px' }}
            >
              {state === 'no_data'   && <NoDataBlock   onUpload={() => router.push('/labs/upload')} lang={lang} />}
              {state === 'labs_saved' && <LabsSavedBlock onHistory={() => router.push('/labs/upload?view=history')} onUpload={() => router.push('/labs/upload')} hasCritical={hasCriticalMarker} lang={lang} />}
              {state === 'calibrating' && <CalibratingBlock onUpload={() => router.push('/labs/upload')} lang={lang} />}
              {(state === 'solved' || state === 'safety_alert') && insight && <SolvedBlock insight={insight} safetyAlert={safetyAlert} lang={lang} />}
            </motion.div>

            {/* ── TWO COLUMNS: Timeline card + disclaimer (only when solved) ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {(state === 'solved' || state === 'safety_alert') ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
                  <DashboardTimelineCard event={nextHealthEvent} onOpen={() => router.push('/timeline')} lang={lang} />
                  <div style={{ padding: '16px', borderRadius: '22px', background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, fontSize: '11px', color: colors.textMuted, textAlign: 'center', lineHeight: 1.7 }}>
                    {lang === 'es' ? 'Meridian ofrece información de salud solo con fines educativos. No es consejo médico, diagnóstico ni tratamiento. Consulta siempre a un profesional de salud cualificado.' : 'Meridian provides health insights for informational purposes only. Not medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.'}
                  </div>
                </div>
              ) : state === 'no_data' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
                  <DashboardTimelineCard event={nextHealthEvent} onOpen={() => router.push('/timeline')} lang={lang} />
                  <button
                    onClick={() => router.push('/labs/upload')}
                    style={{ padding: '18px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '22px', cursor: 'pointer', textAlign: 'center', width: '100%' }}
                  >
                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>🧪</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>{lang === 'es' ? 'Subir laboratorios' : 'Upload Labs'}</div>
                  </button>
                </div>
              ) : (
                <DashboardTimelineCard event={nextHealthEvent} onOpen={() => router.push('/timeline')} lang={lang} />
              )}
            </motion.div>

          </div>
        </div>
      </div>
    )
  }

  // ── MOBILE layout (original) ──────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: fonts.ui, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '55%', height: '55%', background: `radial-gradient(circle, ${colors.teal}1E 0%, transparent 70%)`, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '55%', height: '55%', background: `radial-gradient(circle, ${colors.cyan}18 0%, transparent 70%)`, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '35%', background: `radial-gradient(circle, ${colors.cyan}0A 0%, transparent 70%)`, filter: 'blur(120px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '44px 20px 120px', position: 'relative', zIndex: 1 }}>

        {/* Mobile header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '26px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: '12px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.teal, boxShadow: '0 0 6px rgba(45,212,191,0.65)', flexShrink: 0 }} />
            {new Date().toLocaleDateString(lang === 'es' ? 'es-PR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ fontFamily: fonts.heading, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '8px' }}>
            {(() => {
              const commaIdx = greeting.indexOf(', ')
              if (commaIdx === -1) return <span style={{ fontSize: 'clamp(26px, 6vw, 34px)', color: colors.text }}>{greeting}</span>
              const prefix = greeting.slice(0, commaIdx) + ','
              const name   = greeting.slice(commaIdx + 2)
              return (
                <>
                  <span style={{ display: 'block', fontSize: 'clamp(22px, 5vw, 28px)', color: colors.text }}>{prefix}</span>
                  <span style={{ display: 'block', fontSize: 'clamp(26px, 6vw, 34px)', background: 'linear-gradient(90deg, #F8FFFC 0%, #67E8F9 45%, #2DD4BF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{name}</span>
                </>
              )
            })()}
          </div>
          <div style={{ fontSize: '14px', color: colors.textSoft, lineHeight: 1.65, maxWidth: '360px' }}>{subline}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          {state === 'no_data'    && <NoDataBlock    onUpload={() => router.push('/labs/upload')} lang={lang} />}
          {state === 'labs_saved' && <LabsSavedBlock onHistory={() => router.push('/labs/upload?view=history')} onUpload={() => router.push('/labs/upload')} hasCritical={hasCriticalMarker} lang={lang} />}
          {state === 'calibrating' && <CalibratingBlock onUpload={() => router.push('/labs/upload')} lang={lang} />}
          {(state === 'solved' || state === 'safety_alert') && insight && <SolvedBlock insight={insight} safetyAlert={safetyAlert} lang={lang} />}
        </motion.div>

        <div style={{ marginTop: '24px' }}>
          <DashboardTimelineCard event={nextHealthEvent} onOpen={() => router.push('/timeline')} lang={lang} />
        </div>

        {state === 'no_data' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button onClick={() => router.push('/labs/upload')} style={{ flex: 1, padding: '16px', backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '18px', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>🧪</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>{lang === 'es' ? 'Subir laboratorios' : 'Upload Labs'}</div>
            </button>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ marginTop: '32px', padding: '16px', fontSize: '11px', color: colors.textMuted, textAlign: 'center', lineHeight: 1.6 }}>
          {lang === 'es' ? 'Meridian ofrece información de salud solo con fines educativos. No es consejo médico, diagnóstico ni tratamiento. Consulta siempre a un profesional de salud cualificado para decisiones médicas. Meridian interpreta, tú decides.' : 'Meridian provides health insights for informational purposes only. It is not medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical decisions. Meridian interprets, you decide.'}
        </motion.div>
      </div>
      <NavBar />
    </div>
  )
}

// ===== STATE BLOCKS (shared between mobile and desktop) =====

function NoDataBlock({ onUpload, lang }: { onUpload: () => void; lang: MeridianLanguage }) {
  return (
    <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '24px', borderLeft: `3px solid ${colors.teal}`, overflow: 'hidden', backdropFilter: 'blur(28px)' }}>
      <div style={{ padding: '28px 24px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.teal, marginBottom: '16px', padding: '4px 10px', border: `1px solid rgba(45,212,191,0.25)`, borderRadius: '20px', background: 'rgba(45,212,191,0.06)' }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.teal }} />
          {lang === 'es' ? 'Esperando datos de laboratorio' : 'Awaiting Biomarker Data'}
        </div>
        <h2 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px' }}>
          {lang === 'es' ? 'Tu inteligencia de salud comienza con tus laboratorios' : 'Your health intelligence starts with your labs'}
        </h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65 }}>
          {lang === 'es' ? 'Sube un PDF de tu laboratorio. Meridian extraerá tus biomarcadores, los analizará y te dará una prioridad clara para hoy.' : 'Upload a PDF from your lab provider. Meridian will extract your biomarkers, analyze them, and give you one clear priority for today.'}
        </p>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <button onClick={onUpload} style={{ width: '100%', padding: '18px 24px', borderRadius: '16px', border: 'none', background: `linear-gradient(135deg, ${colors.teal}, ${colors.cyan})`, color: colors.background, fontSize: '16px', fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.01em' }}>
          {lang === 'es' ? 'Subir mi primer PDF de laboratorio →' : 'Upload your first lab PDF →'}
        </button>
        <div style={{ marginTop: '10px', fontSize: '11px', color: colors.textMuted, textAlign: 'center' }}>
          {lang === 'es' ? 'Toma menos de 60 segundos · Meridian interpreta, tú decides.' : 'Takes less than 60 seconds · Meridian interprets, you decide.'}
        </div>
      </div>
    </div>
  )
}

function LabsSavedBlock({ onHistory, onUpload, hasCritical = false, lang }: { onHistory: () => void; onUpload: () => void; hasCritical?: boolean; lang: MeridianLanguage }) {
  const steps = [
    lang === 'es' ? 'Revisa tu resumen de laboratorios para ver tus marcadores actuales' : 'Review your Lab Snapshot to see current markers',
    lang === 'es' ? 'Sube laboratorios nuevos cuando los tengas disponibles' : 'Upload newer labs when available',
    lang === 'es' ? 'Las lecturas ganan precisión mientras se acumula más historial' : 'Insights gain precision as more history accumulates',
  ]

  if (hasCritical) {
    return (
      <div style={{ backgroundColor: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: '24px', borderLeft: '3px solid #F87171', overflow: 'hidden', backdropFilter: 'blur(28px)' }}>
        <div style={{ padding: '28px 24px 24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#F87171', marginBottom: '16px', padding: '4px 10px', border: '1px solid rgba(248,113,113,0.28)', borderRadius: '20px', background: 'rgba(248,113,113,0.07)' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#F87171' }} />
            {lang === 'es' ? 'Revisión de seguridad' : 'Safety Review'}
          </div>
          <h2 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px' }}>
            {lang === 'es' ? 'Se recomienda revisión de seguridad' : 'Safety review recommended'}
          </h2>
          <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65, marginBottom: '10px' }}>
            {lang === 'es' ? 'Uno o más biomarcadores recientes podrían requerir revisión médica pronta.' : 'One or more recent biomarkers may require prompt medical review.'}
          </p>
          <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: 1.7 }}>
            {lang === 'es' ? 'Meridian limitará la guía de optimización hasta que estos resultados sean revisados con un profesional de salud cualificado.' : 'Meridian is limiting optimization guidance until these results are reviewed with a qualified healthcare professional.'}
          </p>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <button onClick={onHistory} style={{ width: '100%', padding: '16px 20px', borderRadius: '16px', border: 'none', background: 'linear-gradient(135deg, #F87171, #FB923C)', color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.01em' }}>
            {lang === 'es' ? 'Revisar resultados de laboratorio →' : 'Review lab results →'}
          </button>
        </div>
        <div style={{ padding: '14px 24px', borderTop: 'rgba(248,113,113,0.1) solid 1px', fontSize: '11px', color: colors.textMuted, textAlign: 'center' }}>
          {lang === 'es' ? 'Meridian interpreta, tú decides · Consulta siempre a un profesional cualificado.' : 'Meridian interprets, you decide · Always consult a qualified professional.'}
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '24px', borderLeft: `3px solid ${colors.teal}`, overflow: 'hidden', backdropFilter: 'blur(28px)' }}>
      <div style={{ padding: '28px 24px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.teal, marginBottom: '16px', padding: '4px 10px', border: `1px solid rgba(45,212,191,0.25)`, borderRadius: '20px', background: 'rgba(45,212,191,0.06)' }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.teal }} />
          {lang === 'es' ? 'Construyendo línea base' : 'Baseline Building'}
        </div>
        <h2 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px' }}>
          {lang === 'es' ? 'Laboratorios recibidos' : 'Labs received'}
        </h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65, marginBottom: '12px' }}>
          {lang === 'es' ? 'Meridian está construyendo tu línea base biológica.' : 'Meridian is building your biological baseline.'}
        </p>
        <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: 1.7 }}>
          {lang === 'es' ? 'Tu historial de laboratorios guardado ya forma parte de tu perfil de Meridian. Las lecturas se vuelven más precisas mientras se acumulan más datos y contexto.' : 'Your saved lab history is now part of your Meridian profile. Insights become more precise as more lab history and context accumulate.'}
        </p>
      </div>
      <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: '14px', border: `1px solid ${colors.cardBorder}` }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '8px', flexShrink: 0, backgroundColor: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: colors.teal }}>
              {i + 1}
            </div>
            <span style={{ fontSize: '14px', color: colors.text, lineHeight: 1.4 }}>{step}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 24px 24px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={onHistory} style={{ flex: 1, minWidth: '160px', padding: '16px 20px', borderRadius: '16px', border: 'none', background: `linear-gradient(135deg, ${colors.teal}, ${colors.cyan})`, color: colors.background, fontSize: '15px', fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.01em' }}>
          {lang === 'es' ? 'Ver historial de laboratorios →' : 'View Lab History →'}
        </button>
        <button onClick={onUpload} style={{ padding: '16px 18px', borderRadius: '16px', border: `1px solid ${colors.cardBorder}`, background: colors.cardBg, color: colors.textSoft, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
          Upload
        </button>
      </div>
      <div style={{ padding: '14px 24px', borderTop: `1px solid rgba(103,232,249,0.07)`, fontSize: '11px', color: colors.textMuted, textAlign: 'center' }}>
        {lang === 'es' ? 'Basado en tus biomarcadores guardados · Meridian interpreta, tú decides.' : 'Based on your saved biomarkers · Meridian interprets, you decide.'}
      </div>
    </div>
  )
}

function CalibratingBlock({ onUpload, lang }: { onUpload: () => void; lang: MeridianLanguage }) {
  return (
    <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '24px', borderLeft: `3px solid ${colors.cyan}`, overflow: 'hidden', backdropFilter: 'blur(28px)' }}>
      <div style={{ padding: '28px 24px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.cyan, marginBottom: '16px', padding: '4px 10px', border: `1px solid rgba(103,232,249,0.25)`, borderRadius: '20px', background: 'rgba(103,232,249,0.06)' }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.cyan }} />
          {lang === 'es' ? 'Estado de calibración' : 'Calibration State'}
        </div>
        <h2 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: '12px' }}>
          {lang === 'es' ? 'Ya tenemos tus datos — construyendo tu línea base' : 'We have your data — building your baseline'}
        </h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.65 }}>
          {lang === 'es' ? 'Meridian está analizando tus biomarcadores, pero todavía necesita más contexto para generar una lectura con mayor confianza. Sube laboratorios adicionales para fortalecer la señal.' : 'Meridian is analyzing your biomarkers but does not yet have enough context for a confident insight. Upload additional labs to help Meridian build a stronger signal.'}
        </p>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <button onClick={onUpload} style={{ width: '100%', padding: '18px 24px', borderRadius: '16px', border: 'none', background: `linear-gradient(135deg, ${colors.teal}, ${colors.cyan})`, color: colors.background, fontSize: '16px', fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.01em' }}>
          {lang === 'es' ? 'Subir más laboratorios →' : 'Upload more labs →'}
        </button>
      </div>
    </div>
  )
}

function SolvedBlock({ insight, safetyAlert, lang }: { insight: GoldenInsight; safetyAlert: boolean; lang: MeridianLanguage }) {
  const bc = getBlockColors(insight.block_color)
  return (
    <div style={{ backgroundColor: bc.bg, border: `1px solid ${bc.border}`, borderRadius: '24px', borderLeft: `3px solid ${bc.accent}`, overflow: 'hidden', backdropFilter: 'blur(28px)' }}>
      <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${colors.cardBorder}` }}>
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: bc.accent, padding: '3px 9px', border: `1px solid ${bc.accent}33`, borderRadius: '20px', background: `${bc.accent}0A` }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: bc.accent }} />
            {insight.block_color === 'alert' ? (lang === 'es' ? 'Señal prioritaria' : 'Priority signal') : insight.block_color === 'optimal' ? (lang === 'es' ? 'Funcionando bien' : 'Performing well') : (lang === 'es' ? 'Señal de recuperación' : 'Recovery signal')}
          </div>
        </div>
        {safetyAlert && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#F87171', marginBottom: '12px', padding: '4px 10px', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '20px', background: 'rgba(248,113,113,0.07)' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#F87171' }} />
            {lang === 'es' ? '⚠ Requiere atención' : '⚠ Requires Attention'}
          </div>
        )}
        <h2 style={{ fontFamily: fonts.heading, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, color: colors.text, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '10px' }}>
          {insight.headline}
        </h2>
        <p style={{ fontSize: '15px', color: colors.textSoft, lineHeight: 1.5 }}>{insight.status}</p>
      </div>
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.cardBorder}` }}>
        <p style={{ fontSize: '14px', color: colors.textSoft, lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: insight.cause.replace(/\*\*(.*?)\*\*/g, `<strong style="color: ${colors.text}; font-weight: 700;">$1</strong>`) }}
        />
      </div>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: bc.accent, marginBottom: '14px' }}>
          {lang === 'es' ? 'Prioridad de hoy' : "Today's Priority"}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {insight.action_steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: '14px', border: `1px solid ${colors.cardBorder}` }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '8px', backgroundColor: `${bc.accent}1A`, border: `1px solid ${bc.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: bc.accent, flexShrink: 0 }}>{i + 1}</div>
              <p style={{ fontSize: '14px', color: colors.text, lineHeight: 1.5 }}>{step}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: '4px' }}>
            {lang === 'es' ? 'Ten en cuenta' : 'Keep in mind'}
          </div>
          <p style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.55, fontStyle: 'italic' }}>
            {(safetyAlert || insight.block_color === 'alert')
              ? (lang === 'es' ? 'Este resultado merece revisarse con un clínico cualificado antes de sacar conclusiones. Meridian interpreta datos; no diagnostica.' : 'This result is worth reviewing with a qualified clinician before drawing conclusions. Meridian interprets data; it does not diagnose.')
              : insight.block_color === 'optimal'
                ? (lang === 'es' ? 'Esta es una señal direccional, no una conclusión. Los patrones en el tiempo son más importantes que una sola lectura.' : 'This is a directional signal, not a conclusion. Patterns over time are more meaningful than any single reading.')
                : (lang === 'es' ? 'Esta es una señal para observar, no un diagnóstico. Una lectura refleja un momento: el contexto, la hidratación y la actividad reciente también importan.' : 'This is a signal to watch, not a diagnosis. One reading reflects a moment — context, hydration, and recent activity all matter.')
            }
          </p>
        </div>
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: `1px solid rgba(103,232,249,0.07)` }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: '6px', textAlign: 'center' }}>
            {lang === 'es' ? 'Rastro de confianza' : 'Confidence Trace'}
          </div>
          <div style={{ fontSize: '11px', color: colors.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
            {insight.trust_line}
          </div>
        </div>
      </div>
    </div>
  )
}
