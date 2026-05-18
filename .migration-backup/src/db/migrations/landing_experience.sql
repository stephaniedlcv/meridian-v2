-- ── Meridian: Landing Experience CMS Layer ───────────────────────────────────
-- Run once in Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Landing config table
CREATE TABLE IF NOT EXISTS landing_experience (
  id                  uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active           boolean         NOT NULL DEFAULT false,

  -- Media
  hero_video_url      text,
  mobile_video_url    text,
  poster_image_url    text,
  logo_variant_url    text,

  -- Copy
  headline            text            NOT NULL DEFAULT 'Understand your biology, in full context.',
  subcopy             text            NOT NULL DEFAULT 'A calmer, more intelligent way to understand what your body is adapting to.',
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

-- 2. Enforce single active row at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS landing_experience_single_active
  ON landing_experience (is_active)
  WHERE is_active = true;

-- 3. Row Level Security
ALTER TABLE landing_experience ENABLE ROW LEVEL SECURITY;

-- Public read (landing page fetch, no auth required)
DO $$ BEGIN
  CREATE POLICY "landing_experience_public_read"
    ON landing_experience FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role write (API routes use service role key)
DO $$ BEGIN
  CREATE POLICY "landing_experience_service_write"
    ON landing_experience FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Seed: default active configuration
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
  'Understand your biology, in full context.',
  'A calmer, more intelligent way to understand what your body is adapting to.',
  'Get Started',
  'Log In',
  'deep_teal',
  0.35,
  'standard'
)
ON CONFLICT DO NOTHING;

-- ── Storage bucket for media uploads ──────────────────────────────────────────
-- Creates the public bucket used by the Experience Manager file upload feature.
-- If it already exists this is a no-op.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meridian-assets',
  'meridian-assets',
  true,
  104857600,  -- 100 MB per file
  ARRAY[
    'video/mp4', 'video/webm', 'video/ogg',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "meridian_assets_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'meridian-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "meridian_assets_auth_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'meridian-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "meridian_assets_auth_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'meridian-assets')
    WITH CHECK (bucket_id = 'meridian-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "meridian_assets_auth_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'meridian-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
