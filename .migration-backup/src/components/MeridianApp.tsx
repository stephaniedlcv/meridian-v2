'use client'

import { useRouter }             from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { createBrowserClient }   from '@supabase/ssr'
import { getNextOnboardingStep } from '@/lib/onboarding'
import type { LandingExperience, BackgroundTheme, AmbientMode } from '@/types/experience'
import {
  FALLBACK_CONFIG, THEME_BG, THEME_ORBS, AMBIENT_INTENSITY,
} from '@/types/experience'

// ── Orb intensity helper ───────────────────────────────────────────
function orbOpacity(base: string, intensity: number): string {
  return base.replace(/[\d.]+\)$/, v => `${Math.min(1, parseFloat(v) * intensity * 10) / 10})`)
}

// ── Logo halo glyph or custom image ───────────────────────────────
function LogoMark({ url }: { url: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Meridian"
        style={{ width: '72px', height: '72px', objectFit: 'contain', position: 'relative', zIndex: 1 }}
      />
    )
  }
  return (
    <div style={{
      fontFamily:           'var(--font-fraunces), serif',
      fontSize:             '64px',
      fontWeight:           700,
      background:           'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor:  'transparent',
      position:             'relative',
      zIndex:               1,
    }}>
      M
    </div>
  )
}

// ── Cinematic video background ─────────────────────────────────────
function VideoBackground({
  desktopUrl, mobileUrl, posterUrl, overlayOpacity,
}: {
  desktopUrl:     string
  mobileUrl:      string | null
  posterUrl:      string | null
  overlayOpacity: number
}) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => {})
  }, [])

  // Pick the right source — mobile viewport uses the mobile variant if provided
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const src      = (isMobile && mobileUrl) ? mobileUrl : desktopUrl

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={posterUrl ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onCanPlay={() => setReady(true)}
        style={{
          position:   'absolute',
          inset:      0,
          width:      '100%',
          height:     '100%',
          objectFit:  'cover',
          opacity:    ready ? 1 : 0,
          transition: 'opacity 1.2s ease',
        }}
      />

      {/* Poster shown while video loads */}
      {posterUrl && !ready && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt=""
          aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Atmosphere overlay — darkens video for text legibility */}
      <div style={{
        position:        'absolute',
        inset:           0,
        backgroundColor: `rgba(6,19,22,${overlayOpacity.toFixed(2)})`,
        pointerEvents:   'none',
      }} />

      {/* Soft vignette — always present */}
      <div style={{
        position:   'absolute',
        inset:      0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(6,19,22,0.55) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ── Ambient orb background ─────────────────────────────────────────
function AmbientBackground({
  theme, mode,
}: { theme: BackgroundTheme; mode: AmbientMode }) {
  const orbs      = THEME_ORBS[theme] ?? THEME_ORBS.deep_teal
  const intensity = AMBIENT_INTENSITY[mode] ?? 1

  if (intensity === 0) return null

  const p = orbOpacity(orbs.primary,   intensity)
  const s = orbOpacity(orbs.secondary, intensity)

  return (
    <>
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '55%', height: '55%', background: `radial-gradient(circle, ${p} 0%, transparent 70%)`, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '55%', height: '55%', background: `radial-gradient(circle, ${s} 0%, transparent 70%)`, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '40%', height: '30%', background: `radial-gradient(circle, ${p.replace(/[\d.]+\)$/, '0.05)')} 0%, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />
    </>
  )
}

// ── Loading skeleton — shown while auth + config resolve ───────────
function LoadingSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#061316', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-15%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-15%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(103,232,249,0.10) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', width: '112px', height: '112px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(103,232,249,0.09)', boxShadow: '0 0 48px rgba(45,212,191,0.08), 0 0 120px rgba(45,212,191,0.04)' }} />
        <div style={{ position: 'absolute', inset: '16px', borderRadius: '50%', border: '0.5px solid rgba(103,232,249,0.13)' }} />
        <div style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '58px', fontWeight: 700, background: 'linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', position: 'relative', zIndex: 1 }}>M</div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────
export default function MeridianApp() {
  const router = useRouter()

  const [authChecking, setAuthChecking] = useState(true)
  const [config,       setConfig]       = useState<LandingExperience>(FALLBACK_CONFIG)
  const [configReady,  setConfigReady]  = useState(false)

  // Fetch landing config (non-blocking — fallback always available)
  useEffect(() => {
    fetch('/api/landing-config')
      .then(r => r.ok ? r.json() : null)
      .then((data: LandingExperience | null) => {
        if (data) setConfig(data)
      })
      .catch(() => {})
      .finally(() => setConfigReady(true))
  }, [])

  // Auth check — redirect if logged in
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
      if (nextStep) { router.push(nextStep); return }
      router.push('/dashboard')
    }

    checkAuth()
  }, [router])

  // Show skeleton while auth resolves (same as original loading state)
  if (authChecking && !configReady) return <LoadingSkeleton />

  // Auth redirecting — keep skeleton up silently
  if (authChecking) return <LoadingSkeleton />

  const bg          = THEME_BG[config.background_theme] ?? '#061316'
  const hasVideo    = !!config.hero_video_url

  return (
    <div style={{
      minHeight:       '100vh',
      background:      bg,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexDirection:   'column',
      position:        'relative',
      overflow:        'hidden',
    }}>
      {/* ── Background layer: video OR ambient orbs ── */}
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

      {/* ── Foreground content ── */}
      <div style={{
        position:       'relative',
        zIndex:         1,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            '0px',
      }}>
        {/* Logo halo */}
        <div style={{
          position:       'relative',
          width:          '128px',
          height:         '128px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          marginBottom:   '20px',
        }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(103,232,249,0.09)', boxShadow: '0 0 56px rgba(45,212,191,0.07), 0 0 140px rgba(45,212,191,0.03)' }} />
          <div style={{ position: 'absolute', inset: '18px', borderRadius: '50%', border: '0.5px solid rgba(103,232,249,0.14)' }} />
          <LogoMark url={config.logo_variant_url} />
        </div>

        {/* Headline */}
        <div style={{
          fontFamily:    'var(--font-fraunces), serif',
          fontSize:      '32px',
          fontWeight:    700,
          color:         '#EAFBF7',
          letterSpacing: '-0.05em',
          marginBottom:  '10px',
          textAlign:     'center',
          maxWidth:      '480px',
          lineHeight:    1.15,
        }}>
          {config.headline}
        </div>

        {/* Subcopy */}
        <div style={{
          display:       'flex',
          alignItems:    'center',
          gap:           '8px',
          marginBottom:  '48px',
        }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#2DD4BF', boxShadow: '0 0 8px rgba(45,212,191,0.9), 0 0 16px rgba(45,212,191,0.4)', flexShrink: 0 }} />
          <div style={{
            fontSize:      '10px',
            fontWeight:    700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color:         '#5F8E85',
          }}>
            {config.subcopy}
          </div>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#2DD4BF', boxShadow: '0 0 8px rgba(45,212,191,0.9), 0 0 16px rgba(45,212,191,0.4)', flexShrink: 0 }} />
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/onboarding/welcome?mode=signup')}
            style={{
              padding:     '15px 32px',
              background:  'linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)',
              border:      'none',
              borderRadius:'14px',
              color:       '#061316',
              fontFamily:  'var(--font-plus-jakarta), "Plus Jakarta Sans", sans-serif',
              fontSize:    '15px',
              fontWeight:  700,
              cursor:      'pointer',
              boxShadow:   '0 0 24px rgba(45,212,191,0.35), 0 0 60px rgba(45,212,191,0.12), inset 0 1px 0 rgba(255,255,255,0.25)',
              letterSpacing:'-0.01em',
            }}
          >
            {config.primary_cta_label}
          </button>

          <button
            onClick={() => router.push('/onboarding/welcome?mode=login')}
            style={{
              padding:       '15px 32px',
              background:    'rgba(232,248,245,0.055)',
              border:        '1px solid rgba(103,232,249,0.22)',
              borderRadius:  '14px',
              color:         '#9ACBC1',
              fontFamily:    'var(--font-plus-jakarta), "Plus Jakarta Sans", sans-serif',
              fontSize:      '15px',
              fontWeight:    600,
              cursor:        'pointer',
              backdropFilter:'blur(20px)',
              boxShadow:     'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 16px rgba(103,232,249,0.06)',
              letterSpacing: '-0.01em',
            }}
          >
            {config.secondary_cta_label}
          </button>
        </div>
      </div>
    </div>
  )
}
