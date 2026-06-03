export interface LandingExperience {
  id:                   string
  is_active:            boolean
  hero_video_url:       string | null
  mobile_video_url:     string | null
  poster_image_url:     string | null
  headline:             string
  subcopy:              string
  primary_cta_label:    string
  secondary_cta_label:  string
  logo_variant_url:     string | null
  background_theme:     BackgroundTheme
  overlay_opacity:      number
  ambient_mode:         AmbientMode
  created_at:           string
  updated_at:           string
}

export type BackgroundTheme = 'deep_teal' | 'midnight' | 'forest' | 'glacier'
export type AmbientMode     = 'standard' | 'minimal' | 'intense' | 'disabled'

export const BACKGROUND_THEME_OPTIONS: { value: BackgroundTheme; label: string }[] = [
  { value: 'deep_teal', label: 'Deep Teal (default)' },
  { value: 'midnight',  label: 'Midnight'             },
  { value: 'forest',    label: 'Forest'               },
  { value: 'glacier',   label: 'Glacier'              },
]

export const AMBIENT_MODE_OPTIONS: { value: AmbientMode; label: string }[] = [
  { value: 'standard',  label: 'Standard'  },
  { value: 'minimal',   label: 'Minimal'   },
  { value: 'intense',   label: 'Intense'   },
  { value: 'disabled',  label: 'Disabled'  },
]

// Background base colors per theme
export const THEME_BG: Record<BackgroundTheme, string> = {
  deep_teal: '#061316',
  midnight:  '#06081a',
  forest:    '#060f0a',
  glacier:   '#06101a',
}

// Orb colors per theme
export const THEME_ORBS: Record<BackgroundTheme, { primary: string; secondary: string }> = {
  deep_teal: { primary: 'rgba(45,212,191,0.13)',  secondary: 'rgba(103,232,249,0.11)'  },
  midnight:  { primary: 'rgba(99,102,241,0.13)',   secondary: 'rgba(167,139,250,0.11)'  },
  forest:    { primary: 'rgba(52,211,153,0.13)',   secondary: 'rgba(110,231,183,0.10)'  },
  glacier:   { primary: 'rgba(56,189,248,0.13)',   secondary: 'rgba(125,211,252,0.10)'  },
}

// Orb intensities per ambient mode (multiplier)
export const AMBIENT_INTENSITY: Record<AmbientMode, number> = {
  standard: 1.0,
  minimal:  0.45,
  intense:  1.8,
  disabled: 0.0,
}

/**
 * Production-safe fallback — rendered when DB is unavailable.
 *
 * Semantic contract (as of landing redesign):
 *   headline  = large editorial positioning statement shown below the wordmark
 *   subcopy   = calm supporting sentence shown below the headline
 * The "Biological Intelligence System" system tag is rendered as fixed
 * brand identity in code — not driven from config.
 */
export const FALLBACK_CONFIG: LandingExperience = {
  id:                   'fallback',
  is_active:            true,
  hero_video_url:       null,
  mobile_video_url:     null,
  poster_image_url:     null,
  headline:             'Understand your biology,\nin full context.',
  subcopy:              'A calmer, more intelligent way to understand what your body is adapting to.',
  primary_cta_label:    'Get Started',
  secondary_cta_label:  'Log In',
  logo_variant_url:     null,
  background_theme:     'deep_teal',
  overlay_opacity:      0.35,
  ambient_mode:         'standard',
  created_at:           '',
  updated_at:           '',
}
