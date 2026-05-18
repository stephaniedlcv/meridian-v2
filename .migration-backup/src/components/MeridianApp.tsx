'use client'

import { useRouter }             from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { createBrowserClient }   from '@supabase/ssr'
import { getNextOnboardingStep } from '@/lib/onboarding'
import type { LandingExperience, BackgroundTheme, AmbientMode } from '@/types/experience'
import {
  FALLBACK_CONFIG, THEME_BG, THEME_ORBS, AMBIENT_INTENSITY,
} from '@/types/experience'

const F_SERIF = 'var(--font-fraunces), Fraunces, serif'
const F_UI    = 'var(--font-plus-jakarta), "Plus Jakarta Sans", sans-serif'

// ─────────────────────────────────────────────────────────────────────────────
// Video background
// ─────────────────────────────────────────────────────────────────────────────
function VideoBackground({
  desktopUrl, mobileUrl, posterUrl, overlayOpacity,
}: {
  desktopUrl:     string
  mobileUrl:      string | null
  posterUrl:      string | null
  overlayOpacity: number
}) {
  const videoRef        = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  // Pick source based on viewport at mount
  const [src] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && mobileUrl) {
      return mobileUrl
    }
    return desktopUrl
  })

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Poster — visible while video buffers */}
      {posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt=""
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity:    ready ? 0 : 1,
            transition: 'opacity 1.2s ease',
          }}
        />
      )}

      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        autoPlay muted loop playsInline
        preload="metadata"
        onCanPlay={() => setReady(true)}
        style={{
          position:   'absolute', inset: 0,
          width:      '100%', height: '100%',
          objectFit:  'cover',
          opacity:    ready ? 1 : 0,
          transition: 'opacity 1.6s ease',
        }}
      />

      {/* Cinematic gradient overlay — top/mid/bottom graduated for depth */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(
            to bottom,
            rgba(6,19,22,0.52)   0%,
            rgba(6,19,22,${Math.max(0.22, overlayOpacity - 0.1).toFixed(2)}) 38%,
            rgba(6,19,22,${overlayOpacity.toFixed(2)}) 60%,
            rgba(6,19,22,0.68)  100%
          )`,
        }}
      />

      {/* Soft edge vignette — adds cinematic letterbox depth */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 42%, transparent 40%, rgba(6,19,22,0.48) 100%)',
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient orb background (no video)
// ─────────────────────────────────────────────────────────────────────────────
function AmbientBackground({
  theme, mode,
}: { theme: BackgroundTheme; mode: AmbientMode }) {
  const orbs      = THEME_ORBS[theme] ?? THEME_ORBS.deep_teal
  const intensity = AMBIENT_INTENSITY[mode] ?? 1
  if (intensity === 0) return null

  function scale(rgba: string): string {
    return rgba.replace(/[\d.]+(?=\))/, v =>
      String(Math.round(Math.min(0.99, parseFloat(v) * intensity) * 100) / 100),
    )
  }

  return (
    <>
      <div aria-hidden style={{ position: 'absolute', top: '-18%', left: '-12%', width: '58%', height: '58%', background: `radial-gradient(circle, ${scale(orbs.primary)} 0%, transparent 70%)`, filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-18%', right: '-12%', width: '58%', height: '58%', background: `radial-gradient(circle, ${scale(orbs.secondary)} 0%, transparent 70%)`, filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '44%', height: '32%', background: `radial-gradient(circle, rgba(45,212,191,0.04) 0%, transparent 70%)`, filter: 'blur(70px)', pointerEvents: 'none' }} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton — while auth resolves
// ─────────────────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{
      minHeight:       '100svh',
      background:      '#061316',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      position:        'relative',
      overflow:        'hidden',
    }}>
      <div aria-hidden style={{ position: 'absolute', top: '-20%', left: '-15%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(45,212,191,0.10) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-20%', right: '-15%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(103,232,249,0.08) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      <Halo url={null} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo halo — shared between skeleton and landing
// ─────────────────────────────────────────────────────────────────────────────
function Halo({ url, size = 92 }: { url: string | null; size?: number }) {
  return (
    <div style={{
      position:       'relative',
      width:          `${size}px`,
      height:         `${size}px`,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexShrink:     0,
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(103,232,249,0.10)', boxShadow: '0 0 60px rgba(45,212,191,0.07), 0 0 130px rgba(45,212,191,0.03)' }} />
      <div style={{ position: 'absolute', inset: `${Math.round(size * 0.15)}px`, borderRadius: '50%', border: '0.5px solid rgba(103,232,249,0.13)' }} />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Meridian"
          style={{ width: `${Math.round(size * 0.56)}px`, height: `${Math.round(size * 0.56)}px`, objectFit: 'contain', position: 'relative', zIndex: 1 }}
        />
      ) : (
        <div style={{
          fontFamily:           F_SERIF,
          fontSize:             `${Math.round(size * 0.58)}px`,
          fontWeight:           700,
          lineHeight:           1,
          background:           'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 42%, #2DD4BF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          position:             'relative',
          zIndex:               1,
        }}>
          M
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cinematic exit overlay
// ─────────────────────────────────────────────────────────────────────────────
function ExitOverlay({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          300,
        backgroundColor: '#061316',
        opacity:         active ? 1 : 0,
        transition:      active
          ? 'opacity 0.55s cubic-bezier(0.45, 0, 0.9, 1)'
          : 'none',
        pointerEvents:   active ? 'auto' : 'none',
      }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function MeridianApp() {
  const router = useRouter()

  const [authChecking,  setAuthChecking]  = useState(true)
  const [config,        setConfig]        = useState<LandingExperience>(FALLBACK_CONFIG)
  const [mounted,       setMounted]       = useState(false)   // entrance animation
  const [transitioning, setTransitioning] = useState(false)   // exit animation

  // Fetch live config — non-blocking, fallback always ready
  useEffect(() => {
    fetch('/api/landing-config')
      .then(r => r.ok ? r.json() : null)
      .then((data: LandingExperience | null) => { if (data) setConfig(data) })
      .catch(() => {})
  }, [])

  // Auth check — redirect if user is already logged in
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthChecking(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, birth_date, biological_profile, user_profile, onboarding_completed')
        .eq('id', user.id)
        .single()

      const nextStep = getNextOnboardingStep(profile)
      router.push(nextStep ?? '/dashboard')
    }
    checkAuth()
  }, [router])

  // Trigger entrance animation after auth resolves
  useEffect(() => {
    if (authChecking) return
    const t = setTimeout(() => setMounted(true), 120)
    return () => clearTimeout(t)
  }, [authChecking])

  // Premium cinematic navigation — fade to dark then push route
  function navigateTo(path: string) {
    setTransitioning(true)
    setTimeout(() => router.push(path), 560)
  }

  if (authChecking) return <LoadingSkeleton />

  const bg       = THEME_BG[config.background_theme] ?? '#061316'
  const hasVideo = !!config.hero_video_url

  // CSS entrance helper — staggered fade + lift
  function enter(delayMs: number): React.CSSProperties {
    return {
      opacity:    mounted ? 1 : 0,
      transform:  mounted ? 'translateY(0)' : 'translateY(16px)',
      transition: `opacity 1s ease ${delayMs}ms, transform 1s ease ${delayMs}ms`,
    }
  }

  return (
    <>
      <ExitOverlay active={transitioning} />

      <div style={{
        minHeight:      '100svh',
        backgroundColor: bg,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        position:       'relative',
        overflow:       'hidden',
      }}>

        {/* ── Background layer ── */}
        {hasVideo ? (
          <VideoBackground
            desktopUrl={config.hero_video_url!}
            mobileUrl={config.mobile_video_url}
            posterUrl={config.poster_image_url}
            overlayOpacity={config.overlay_opacity}
          />
        ) : (
          <AmbientBackground
            theme={config.background_theme}
            mode={config.ambient_mode}
          />
        )}

        {/* ── Content column ── */}
        <div style={{
          position:      'relative',
          zIndex:        1,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          padding:       '32px 28px 72px',
          width:         '100%',
          maxWidth:      '640px',
          boxSizing:     'border-box',
        }}>

          {/* Logo halo */}
          <div style={{ ...enter(0), marginBottom: '18px' }}>
            <Halo url={config.logo_variant_url} />
          </div>

          {/* Wordmark */}
          <div style={{
            ...enter(100),
            fontFamily:    F_SERIF,
            fontSize:      'clamp(20px, 3.8vw, 26px)',
            fontWeight:    700,
            color:         '#EAFBF7',
            letterSpacing: '-0.045em',
            lineHeight:    1,
            marginBottom:  '10px',
            textAlign:     'center',
          }}>
            Meridian
          </div>

          {/* System tag — fixed brand identity */}
          <div style={{
            ...enter(160),
            display:       'flex',
            alignItems:    'center',
            gap:           '8px',
            marginBottom:  '52px',
          }}>
            <span style={{
              display:       'block',
              width:         '4px',
              height:        '4px',
              borderRadius:  '50%',
              background:    '#2DD4BF',
              boxShadow:     '0 0 8px rgba(45,212,191,0.95), 0 0 18px rgba(45,212,191,0.4)',
              flexShrink:    0,
            }} />
            <span style={{
              fontFamily:    F_UI,
              fontSize:      '9.5px',
              fontWeight:    700,
              letterSpacing: '0.20em',
              textTransform: 'uppercase' as const,
              color:         '#4D7A73',
            }}>
              Biological Intelligence System
            </span>
            <span style={{
              display:       'block',
              width:         '4px',
              height:        '4px',
              borderRadius:  '50%',
              background:    '#2DD4BF',
              boxShadow:     '0 0 8px rgba(45,212,191,0.95), 0 0 18px rgba(45,212,191,0.4)',
              flexShrink:    0,
            }} />
          </div>

          {/* Editorial headline */}
          <div style={{
            ...enter(260),
            fontFamily:    F_SERIF,
            fontSize:      'clamp(30px, 5.8vw, 50px)',
            fontWeight:    300,
            color:         '#EAFBF7',
            letterSpacing: '-0.04em',
            lineHeight:    1.18,
            textAlign:     'center',
            maxWidth:      '540px',
            marginBottom:  '20px',
            whiteSpace:    'pre-line',
          }}>
            {config.headline}
          </div>

          {/* Subcopy */}
          <div style={{
            ...enter(380),
            fontFamily:    F_UI,
            fontSize:      'clamp(13px, 2.4vw, 15px)',
            fontWeight:    400,
            color:         '#7BB5AC',
            lineHeight:    1.72,
            textAlign:     'center',
            maxWidth:      '390px',
            marginBottom:  '52px',
          }}>
            {config.subcopy}
          </div>

          {/* CTA row */}
          <div style={{
            ...enter(500),
            display:        'flex',
            gap:            '12px',
            flexWrap:       'wrap' as const,
            justifyContent: 'center',
          }}>
            <PrimaryButton
              label={config.primary_cta_label}
              onClick={() => navigateTo('/onboarding/welcome?mode=signup')}
            />
            <SecondaryButton
              label={config.secondary_cta_label}
              onClick={() => navigateTo('/onboarding/welcome?mode=login')}
            />
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA buttons — extracted to avoid inline handler complexity
// ─────────────────────────────────────────────────────────────────────────────
function PrimaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding:       '15px 36px',
        minWidth:      '148px',
        minHeight:     '52px',
        background:    'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)',
        border:        'none',
        borderRadius:  '14px',
        color:         '#061316',
        fontFamily:    F_UI,
        fontSize:      '15px',
        fontWeight:    700,
        letterSpacing: '-0.01em',
        cursor:        'pointer',
        boxShadow:     hovered
          ? '0 0 40px rgba(45,212,191,0.50), 0 0 88px rgba(45,212,191,0.18), inset 0 1px 0 rgba(255,255,255,0.28)'
          : '0 0 24px rgba(45,212,191,0.32), 0 0 60px rgba(45,212,191,0.10), inset 0 1px 0 rgba(255,255,255,0.22)',
        transform:     hovered ? 'scale(1.03)' : 'scale(1)',
        transition:    'transform 0.20s ease, box-shadow 0.20s ease',
      }}
    >
      {label}
    </button>
  )
}

function SecondaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding:        '15px 36px',
        minWidth:       '120px',
        minHeight:      '52px',
        background:     hovered ? 'rgba(232,248,245,0.08)' : 'rgba(232,248,245,0.045)',
        border:         `1px solid ${hovered ? 'rgba(103,232,249,0.38)' : 'rgba(103,232,249,0.18)'}`,
        borderRadius:   '14px',
        color:          hovered ? '#EAFBF7' : '#7BB5AC',
        fontFamily:     F_UI,
        fontSize:       '15px',
        fontWeight:     600,
        letterSpacing:  '-0.01em',
        cursor:         'pointer',
        backdropFilter: 'blur(18px)',
        boxShadow:      'inset 0 1px 0 rgba(255,255,255,0.05)',
        transition:     'all 0.20s ease',
      }}
    >
      {label}
    </button>
  )
}
