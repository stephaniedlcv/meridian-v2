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
// Video background — cinematic depth system
// Three independent overlay layers: atmospheric ceiling, cinematic ground,
// radial edge diffusion. Config opacity only controls the mid-zone.
// ─────────────────────────────────────────────────────────────────────────────
function VideoBackground({
  desktopUrl, mobileUrl, posterUrl, overlayOpacity,
}: {
  desktopUrl:     string
  mobileUrl:      string | null
  posterUrl:      string | null
  overlayOpacity: number
}) {
  const videoRef          = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  const [src] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && mobileUrl) {
      return mobileUrl
    }
    return desktopUrl
  })

  useEffect(() => { videoRef.current?.play().catch(() => {}) }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Poster — visible while video buffers */}
      {posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt="" aria-hidden
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: ready ? 0 : 1,
            transition: 'opacity 1.4s ease',
          }}
        />
      )}

      <video
        ref={videoRef}
        src={src}
        autoPlay muted loop playsInline preload="metadata"
        onCanPlay={() => setReady(true)}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: ready ? 1 : 0,
          transition: 'opacity 1.8s ease',
        }}
      />

      {/* Layer 1 — Atmospheric ceiling + cinematic ground.
          Always on. Creates the sense that the environment exists
          beyond the video frame — not a flat rectangle. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(
            to bottom,
            rgba(6,19,22,0.70)  0%,
            rgba(6,19,22,0.18) 20%,
            rgba(6,19,22,${Math.max(0.12, overlayOpacity - 0.12).toFixed(2)}) 48%,
            rgba(6,19,22,0.52) 74%,
            rgba(6,19,22,0.92) 100%
          )`,
        }}
      />

      {/* Layer 2 — Radial edge diffusion.
          Darkens the peripheral frame, pulls focus to center.
          Cinematic depth without visible vignette shape. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 68% 58% at 50% 44%, transparent 20%, rgba(6,19,22,0.54) 100%)',
        }}
      />

      {/* Layer 3 — Soft horizontal edge shadow.
          Adds dimensionality — left/right edges recede slightly. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to right, rgba(6,19,22,0.28) 0%, transparent 18%, transparent 82%, rgba(6,19,22,0.28) 100%)',
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient orb background — added spatial depth layers
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
      {/* Background orbs — far layer */}
      <div aria-hidden style={{ position: 'absolute', top: '-18%', left: '-12%', width: '58%', height: '58%', background: `radial-gradient(circle, ${scale(orbs.primary)} 0%, transparent 70%)`, filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-18%', right: '-12%', width: '58%', height: '58%', background: `radial-gradient(circle, ${scale(orbs.secondary)} 0%, transparent 70%)`, filter: 'blur(100px)', pointerEvents: 'none' }} />

      {/* Midground diffusion — biological ambient glow, tighter focus */}
      <div aria-hidden style={{ position: 'absolute', top: '30%', left: '20%', width: '32%', height: '28%', background: `radial-gradient(circle, rgba(45,212,191,0.055) 0%, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />

      {/* Foreground depth — cinematic atmospheric floor.
          Darkens the bottom to ground the composition
          and prevent the content from floating formlessly. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '48%',
          background: 'linear-gradient(to top, rgba(6,19,22,0.70) 0%, rgba(6,19,22,0.20) 60%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Atmospheric ceiling — subtle top fade, creates sense of enclosure */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '32%',
          background: 'linear-gradient(to bottom, rgba(6,19,22,0.32) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{
      minHeight: '100svh', background: '#061316',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{ position: 'absolute', top: '-20%', left: '-15%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(45,212,191,0.10) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-20%', right: '-15%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(103,232,249,0.08) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      {/* Cinematic ground on skeleton too */}
      <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, rgba(6,19,22,0.65) 0%, transparent 100%)', pointerEvents: 'none' }} />
      <Halo url={null} size={76} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo halo — lighter visual weight (76px default, was 92)
// ─────────────────────────────────────────────────────────────────────────────
function Halo({ url, size = 76 }: { url: string | null; size?: number }) {
  return (
    <div style={{
      position: 'relative', width: `${size}px`, height: `${size}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(103,232,249,0.09)', boxShadow: '0 0 48px rgba(45,212,191,0.06), 0 0 110px rgba(45,212,191,0.025)' }} />
      <div style={{ position: 'absolute', inset: `${Math.round(size * 0.15)}px`, borderRadius: '50%', border: '0.5px solid rgba(103,232,249,0.11)' }} />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Meridian"
          style={{ width: `${Math.round(size * 0.55)}px`, height: `${Math.round(size * 0.55)}px`, objectFit: 'contain', position: 'relative', zIndex: 1 }}
        />
      ) : (
        <div style={{
          fontFamily: F_SERIF, fontSize: `${Math.round(size * 0.56)}px`,
          fontWeight: 700, lineHeight: 1,
          background: 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 42%, #2DD4BF 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          position: 'relative', zIndex: 1,
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
        position: 'fixed', inset: 0, zIndex: 300, backgroundColor: '#061316',
        opacity: active ? 1 : 0,
        transition: active ? 'opacity 0.55s cubic-bezier(0.45, 0, 0.9, 1)' : 'none',
        pointerEvents: active ? 'auto' : 'none',
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
  const [mounted,       setMounted]       = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [isMobile,      setIsMobile]      = useState(false)

  // Responsive composition detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Fetch live config — non-blocking
  useEffect(() => {
    fetch('/api/landing-config')
      .then(r => r.ok ? r.json() : null)
      .then((data: LandingExperience | null) => { if (data) setConfig(data) })
      .catch(() => {})
  }, [])

  // Auth check — redirect if already logged in
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

  // Entrance animation — triggers after auth resolves
  useEffect(() => {
    if (authChecking) return
    const t = setTimeout(() => setMounted(true), 120)
    return () => clearTimeout(t)
  }, [authChecking])

  // Premium cinematic navigation
  function navigateTo(path: string) {
    setTransitioning(true)
    setTimeout(() => router.push(path), 560)
  }

  if (authChecking) return <LoadingSkeleton />

  const bg       = THEME_BG[config.background_theme] ?? '#061316'
  const hasVideo = !!config.hero_video_url

  // Staggered entrance — fade + lift per element
  function enter(delayMs: number): React.CSSProperties {
    return {
      opacity:    mounted ? 1 : 0,
      transform:  mounted ? 'translateY(0)' : 'translateY(14px)',
      transition: `opacity 1s ease ${delayMs}ms, transform 1s ease ${delayMs}ms`,
    }
  }

  return (
    <>
      <ExitOverlay active={transitioning} />

      <div style={{
        minHeight:       '100svh',
        backgroundColor: bg,
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',

        // Desktop: center — content is shifted up via transform below.
        // Mobile: flex-end — cinematic bottom-weighted composition.
        justifyContent: isMobile ? 'flex-end' : 'center',

        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* ── Background ── */}
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

        {/* ── Content column ──
            Desktop: translateY(-6vh) breaks the dead-center position,
            creating the soft editorial asymmetry the brief describes.
            Mobile: padding-bottom anchors the block above the viewport floor. */}
        <div style={{
          position:      'relative',
          zIndex:        1,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          width:         '100%',
          maxWidth:      '600px',
          boxSizing:     'border-box',
          padding:       isMobile
            ? '0 24px clamp(56px, 10svh, 80px)'
            : '0 28px',
          transform: isMobile ? 'none' : 'translateY(-6vh)',
        }}>

          {/* Logo halo — 76px, lighter presence */}
          <div style={{ ...enter(0), marginBottom: '10px' }}>
            <Halo url={config.logo_variant_url} />
          </div>

          {/* Wordmark */}
          <div style={{
            ...enter(100),
            fontFamily:    F_SERIF,
            fontSize:      'clamp(18px, 3.2vw, 23px)',
            fontWeight:    700,
            color:         '#EAFBF7',
            letterSpacing: '-0.045em',
            lineHeight:    1,
            marginBottom:  '7px',
            textAlign:     'center',
          }}>
            Meridian
          </div>

          {/* System tag — tighter margin, closer to headline */}
          <div style={{
            ...enter(160),
            display:       'flex',
            alignItems:    'center',
            gap:           '8px',
            marginBottom:  '38px',
          }}>
            <span style={{
              display: 'block', width: '4px', height: '4px', borderRadius: '50%',
              background: '#2DD4BF',
              boxShadow: '0 0 7px rgba(45,212,191,0.90), 0 0 16px rgba(45,212,191,0.35)',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: F_UI, fontSize: '9.5px', fontWeight: 700,
              letterSpacing: '0.20em', textTransform: 'uppercase' as const,
              color: '#4D7A73',
            }}>
              Biological Intelligence System
            </span>
            <span style={{
              display: 'block', width: '4px', height: '4px', borderRadius: '50%',
              background: '#2DD4BF',
              boxShadow: '0 0 7px rgba(45,212,191,0.90), 0 0 16px rgba(45,212,191,0.35)',
              flexShrink: 0,
            }} />
          </div>

          {/* Editorial headline — tighter to subcopy */}
          <div style={{
            ...enter(260),
            fontFamily:    F_SERIF,
            fontSize:      'clamp(28px, 5.6vw, 48px)',
            fontWeight:    300,
            color:         '#EAFBF7',
            letterSpacing: '-0.04em',
            lineHeight:    1.18,
            textAlign:     'center',
            maxWidth:      '510px',
            marginBottom:  '13px',
            whiteSpace:    'pre-line',
          }}>
            {config.headline}
          </div>

          {/* Subcopy — closer to CTAs, tighter grouping */}
          <div style={{
            ...enter(360),
            fontFamily:    F_UI,
            fontSize:      'clamp(13px, 2.2vw, 15px)',
            fontWeight:    400,
            color:         '#7BB5AC',
            lineHeight:    1.70,
            textAlign:     'center',
            maxWidth:      '360px',
            marginBottom:  '36px',
          }}>
            {config.subcopy}
          </div>

          {/* CTAs — anchored, not floating */}
          <div style={{
            ...enter(460),
            display: 'flex', gap: '12px',
            flexWrap: 'wrap' as const, justifyContent: 'center',
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
// CTA buttons
// ─────────────────────────────────────────────────────────────────────────────
function PrimaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '15px 36px', minWidth: '148px', minHeight: '52px',
        background: 'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)',
        border: 'none', borderRadius: '14px',
        color: '#061316', fontFamily: F_UI, fontSize: '15px', fontWeight: 700,
        letterSpacing: '-0.01em', cursor: 'pointer',
        boxShadow: hovered
          ? '0 0 40px rgba(45,212,191,0.50), 0 0 88px rgba(45,212,191,0.18), inset 0 1px 0 rgba(255,255,255,0.28)'
          : '0 0 24px rgba(45,212,191,0.32), 0 0 60px rgba(45,212,191,0.10), inset 0 1px 0 rgba(255,255,255,0.22)',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.20s ease, box-shadow 0.20s ease',
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
        padding: '15px 36px', minWidth: '120px', minHeight: '52px',
        background: hovered ? 'rgba(232,248,245,0.08)' : 'rgba(232,248,245,0.045)',
        border: `1px solid ${hovered ? 'rgba(103,232,249,0.38)' : 'rgba(103,232,249,0.18)'}`,
        borderRadius: '14px',
        color: hovered ? '#EAFBF7' : '#7BB5AC',
        fontFamily: F_UI, fontSize: '15px', fontWeight: 600,
        letterSpacing: '-0.01em', cursor: 'pointer',
        backdropFilter: 'blur(18px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'all 0.20s ease',
      }}
    >
      {label}
    </button>
  )
}
