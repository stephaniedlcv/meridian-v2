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
      {posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl} alt="" aria-hidden
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', opacity: ready ? 0 : 1, transition: 'opacity 1.4s ease',
          }}
        />
      )}

      <video
        ref={videoRef} src={src}
        autoPlay muted loop playsInline preload="metadata"
        onCanPlay={() => setReady(true)}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', opacity: ready ? 1 : 0, transition: 'opacity 1.8s ease',
        }}
      />

      {/* Layer 1 — Atmospheric ceiling + cinematic ground */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `linear-gradient(
          to bottom,
          rgba(6,19,22,0.70)  0%,
          rgba(6,19,22,0.18) 20%,
          rgba(6,19,22,${Math.max(0.12, overlayOpacity - 0.12).toFixed(2)}) 48%,
          rgba(6,19,22,0.52) 74%,
          rgba(6,19,22,0.92) 100%
        )`,
      }} />

      {/* Layer 2 — Radial edge diffusion */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 68% 58% at 50% 44%, transparent 20%, rgba(6,19,22,0.54) 100%)',
      }} />

      {/* Layer 3 — Horizontal edge shadow */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to right, rgba(6,19,22,0.28) 0%, transparent 18%, transparent 82%, rgba(6,19,22,0.28) 100%)',
      }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient orb background
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
      <div aria-hidden style={{ position: 'absolute', top: '30%', left: '20%', width: '32%', height: '28%', background: `radial-gradient(circle, rgba(45,212,191,0.055) 0%, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%', background: 'linear-gradient(to top, rgba(6,19,22,0.70) 0%, rgba(6,19,22,0.20) 60%, transparent 100%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '32%', background: 'linear-gradient(to bottom, rgba(6,19,22,0.32) 0%, transparent 100%)', pointerEvents: 'none' }} />
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
      <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, rgba(6,19,22,0.65) 0%, transparent 100%)', pointerEvents: 'none' }} />
      <Halo url={null} size={82} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo halo — 92px cinematic depth system
//
// Layer order (back → front):
//   1. Dark smoked-glass backing  — radial gradient + backdrop blur
//      separates the glyph from the video entirely
//   2. Outer halo ring            — cyan border, visible but restrained
//   3. Inner halo ring            — closer to glyph, subtle
//   4. M glyph                    — gradient + soft drop-shadow bloom
// ─────────────────────────────────────────────────────────────────────────────
function Halo({ url, size = 92 }: { url: string | null; size?: number }) {
  const insetPx  = Math.round(size * 0.06)   // backing inset from outer ring
  const ringInset = Math.round(size * 0.15)  // inner ring inset

  return (
    <div style={{
      position: 'relative', width: `${size}px`, height: `${size}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>

      {/* 1 — Smoked-glass atmospheric backing.
          Blurs the video behind the orb, creates depth separation.
          Radial: deepest at center (where the M sits), fades at the rim
          so the outer ring still reads as floating above the environment. */}
      <div style={{
        position:           'absolute',
        inset:              `${insetPx}px`,
        borderRadius:       '50%',
        background:         'radial-gradient(circle at 50% 48%, rgba(3,10,14,0.56) 0%, rgba(6,19,22,0.40) 50%, transparent 82%)',
        backdropFilter:     'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }} />

      {/* 2 — Outer halo ring — slightly stronger than before */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: '1.5px solid rgba(103,232,249,0.40)',
        boxShadow: '0 0 18px rgba(45,212,191,0.18), 0 0 40px rgba(45,212,191,0.08), inset 0 0 10px rgba(45,212,191,0.06)',
      }} />

      {/* 3 — Inner halo ring */}
      <div style={{
        position: 'absolute', inset: `${ringInset}px`, borderRadius: '50%',
        border: '1px solid rgba(103,232,249,0.26)',
      }} />

      {/* 4 — Glyph / logo image */}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url} alt="Meridian"
          style={{
            width: `${Math.round(size * 0.55)}px`, height: `${Math.round(size * 0.55)}px`,
            objectFit: 'contain', position: 'relative', zIndex: 1,
          }}
        />
      ) : (
        <div style={{
          fontFamily:           F_SERIF,
          fontSize:             `${Math.round(size * 0.56)}px`,
          fontWeight:           700,
          lineHeight:           1,
          background:           'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 42%, #2DD4BF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          position:             'relative',
          zIndex:               1,
          // Soft inner bloom — illuminated-from-within feel, not neon
          filter:               'drop-shadow(0 0 5px rgba(103,232,249,0.30))',
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
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 300, backgroundColor: '#061316',
      opacity: active ? 1 : 0,
      transition: active ? 'opacity 0.55s cubic-bezier(0.45, 0, 0.9, 1)' : 'none',
      pointerEvents: active ? 'auto' : 'none',
    }} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Log In corner utility — top-right, small, restrained
// ─────────────────────────────────────────────────────────────────────────────
function LoginCornerButton({
  label, onClick, visible,
}: { label: string; onClick: () => void; visible: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:    'fixed',
        top:         '22px',
        right:       '24px',
        zIndex:      10,
        fontFamily:  F_UI,
        fontSize:    '12px',
        fontWeight:  400,
        letterSpacing: '0.01em',
        color:       hovered ? '#AFDAD4' : '#537D77',
        background:  hovered ? 'rgba(232,248,245,0.04)' : 'transparent',
        border:      `1px solid ${hovered ? 'rgba(103,232,249,0.16)' : 'rgba(103,232,249,0.07)'}`,
        borderRadius: '8px',
        padding:     '7px 14px',
        cursor:      'pointer',
        transition:  'all 0.18s ease',
        backdropFilter: 'blur(12px)',
        // Entrance fade — matches content animation
        opacity:     visible ? 1 : 0,
        transform:   visible ? 'translateY(0)' : 'translateY(-6px)',
      }}
    >
      {label}
    </button>
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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/landing-config')
      .then(r => r.ok ? r.json() : null)
      .then((data: LandingExperience | null) => { if (data) setConfig(data) })
      .catch(() => {})
  }, [])

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

  useEffect(() => {
    if (authChecking) return
    const t = setTimeout(() => setMounted(true), 120)
    return () => clearTimeout(t)
  }, [authChecking])

  function navigateTo(path: string) {
    setTransitioning(true)
    setTimeout(() => router.push(path), 560)
  }

  if (authChecking) return <LoadingSkeleton />

  const bg       = THEME_BG[config.background_theme] ?? '#061316'
  const hasVideo = !!config.hero_video_url

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

      {/* Log In — fixed top-right utility position */}
      <LoginCornerButton
        label={config.secondary_cta_label}
        onClick={() => navigateTo('/onboarding/welcome?mode=login')}
        visible={mounted}
      />

      <div style={{
        minHeight:       '100svh',
        backgroundColor: bg,
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  isMobile ? 'flex-end' : 'center',
        position:        'relative',
        overflow:        'hidden',
      }}>

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

        {/* Content column
            Desktop: translateY(-6vh) for soft asymmetric cinematic offset.
            Mobile: padding-bottom for bottom-weighted composition. */}
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
          transform:     isMobile ? 'none' : 'translateY(-6vh)',
        }}>

          {/* Logo halo — 72px, visible rings */}
          <div style={{ ...enter(0), marginBottom: '18px' }}>
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
            marginBottom:  '10px',
            textAlign:     'center',
          }}>
            Meridian
          </div>

          {/* System tag — increased opacity + weight for video readability */}
          <div style={{
            ...enter(160),
            display:      'flex',
            alignItems:   'center',
            gap:          '8px',
            marginBottom: '48px',
          }}>
            <span style={{
              display: 'block', width: '4px', height: '4px', borderRadius: '50%',
              background: '#2DD4BF',
              boxShadow: '0 0 7px rgba(45,212,191,0.90), 0 0 16px rgba(45,212,191,0.35)',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily:    F_UI,
              fontSize:      '9.5px',
              fontWeight:    700,
              letterSpacing: '0.20em',
              textTransform: 'uppercase' as const,
              // Lifted for readability over moving video — teal, not white
              color:         '#9EC8C1',
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

          {/* Editorial headline
              −13% scale: clamp(28px,5.6vw,48px) → clamp(24px,4.9vw,42px)
              line-height lifted 1.18 → 1.28 for more editorial luxury feel */}
          <div style={{
            ...enter(260),
            fontFamily:    F_SERIF,
            fontSize:      'clamp(24px, 4.9vw, 42px)',
            fontWeight:    300,
            color:         '#EAFBF7',
            letterSpacing: '-0.04em',
            lineHeight:    1.28,
            textAlign:     'center',
            maxWidth:      '500px',
            marginBottom:  '20px',
            whiteSpace:    'pre-line',
          }}>
            {config.headline}
          </div>

          {/* Subcopy */}
          <div style={{
            ...enter(360),
            fontFamily:    F_UI,
            fontSize:      'clamp(13px, 2.2vw, 15px)',
            fontWeight:    400,
            color:         '#7BB5AC',
            lineHeight:    1.70,
            textAlign:     'center',
            maxWidth:      '360px',
            marginBottom:  '44px',
          }}>
            {config.subcopy}
          </div>

          {/* Primary CTA only — Log In has moved to top-right corner */}
          <div style={{ ...enter(460) }}>
            <PrimaryButton
              label={config.primary_cta_label}
              onClick={() => navigateTo('/onboarding/welcome?mode=signup')}
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
        display:        'inline-flex',
        alignItems:     'center',
        gap:            '9px',
        padding:        '14px 48px',
        minWidth:       '160px',
        minHeight:      '52px',
        // Glass / editorial — not a solid fill
        background:     hovered ? 'rgba(45,212,191,0.10)' : 'rgba(45,212,191,0.055)',
        border:         `1px solid ${hovered ? 'rgba(45,212,191,0.52)' : 'rgba(45,212,191,0.28)'}`,
        borderRadius:   '14px',
        color:          hovered ? '#E8FAF7' : '#9ECFC6',
        fontFamily:     F_UI,
        fontSize:       '15px',
        fontWeight:     500,
        letterSpacing:  '0.01em',
        cursor:         'pointer',
        backdropFilter: 'blur(20px)',
        boxShadow:      hovered
          ? '0 0 28px rgba(45,212,191,0.18), 0 0 56px rgba(45,212,191,0.07)'
          : '0 0 14px rgba(45,212,191,0.09)',
        transform:      hovered ? 'scale(1.02)' : 'scale(1)',
        transition:     'all 0.22s ease',
      }}
    >
      {label}
      <span aria-hidden style={{
        fontSize: '14px', lineHeight: 1,
        opacity: hovered ? 0.85 : 0.40,
        transition: 'opacity 0.22s ease',
        marginTop: '1px',
      }}>→</span>
    </button>
  )
}
