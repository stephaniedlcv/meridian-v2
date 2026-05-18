-- ── Meridian: Landing Experience CMS Layer ───────────────────────────────────
-- Migration: landing_experience
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS landing_experience (
  id                  uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active           boolean         NOT NULL DEFAULT false,

  -- Media
  hero_video_url      text,
  mobile_video_url    text,
  poster_image_url    text,
  logo_variant_url    text,

  -- Copy
  headline            text            NOT NULL DEFAULT 'Meridian',
  subcopy             text            NOT NULL DEFAULT 'Biological Intelligence System',
  primary_cta_label   text            NOT NULL DEFAULT 'Get Started',
  secondary_cta_label text            NOT NULL DEFAULT 'Log In',

  -- Atmosphere
  background_theme    text            NOT NULL DEFAULT 'deep_teal'
                        CHECK (background_theme IN ('deep_teal','midnight','forest','glacier')),
  overlay_opacity     numeric(4,2)    NOT NULL DEFAULT 0.35
                        CHECK (overlay_opacity BETWEEN 0 AND 1),
  ambient_mode        text            NOT NULL DEFAULT 'standard'
                        CHECK (ambient_mode IN ('standard','minimal','intense','disabled')),

  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now()
);

-- Enforce single active configuration at the DB level
-- (partial unique index — only one row where is_active = true)
CREATE UNIQUE INDEX IF NOT EXISTS landing_experience_single_active
  ON landing_experience (is_active)
  WHERE is_active = true;

-- ── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE landing_experience ENABLE ROW LEVEL SECURITY;

-- Public read: landing page fetches the active config without auth
CREATE POLICY "landing_experience_public_read"
  ON landing_experience FOR SELECT
  USING (true);

-- Service role write: all mutations go through API routes using the
-- service role key — no direct client writes allowed
CREATE POLICY "landing_experience_service_write"
  ON landing_experience FOR ALL
  USING (auth.role() = 'service_role');

-- ── Seed: default active configuration ────────────────────────────────────
-- Inserts the canonical default matching the hardcoded fallback in
-- src/types/experience.ts → FALLBACK_CONFIG
INSERT INTO landing_experience (
  is_active,
  headline,
  subcopy,
  primary_cta_label,
  secondary_cta_label,
  background_theme,
  overlay_opacity,
  ambient_mode
) VALUES (
  true,
  'Meridian',
  'Biological Intelligence System',
  'Get Started',
  'Log In',
  'deep_teal',
  0.35,
  'standard'
)
ON CONFLICT DO NOTHING;
