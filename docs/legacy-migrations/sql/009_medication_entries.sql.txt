-- Migration 009: Medication Entries + profiles toggles
-- Tracks all active medications: Rx, GLP-1, hormones, etc.
-- Tirzepatide lives here as category='glp1', not as a standalone table.
-- Run after 008_supplement_stack.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── New medication_entries table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.medication_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_name  text        NOT NULL,
  -- Category helps drive UI behavior (e.g. glp1 gets rotation map)
  category         text        NOT NULL DEFAULT 'other',
  date             date        NOT NULL,
  dose             numeric(8,3) NOT NULL,
  dose_unit        text        NOT NULL DEFAULT 'mg',
  -- Administration route
  route            text        NOT NULL DEFAULT 'oral',
  -- Injection site — only relevant for subcutaneous route
  -- Reuses same values as tirzepatide_entries for backward compat
  site             text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Category values
ALTER TABLE public.medication_entries
  ADD CONSTRAINT medication_entries_category_check
  CHECK (category IN ('glp1', 'hormone', 'thyroid', 'rx', 'other'));

-- Dose unit values
ALTER TABLE public.medication_entries
  ADD CONSTRAINT medication_entries_dose_unit_check
  CHECK (dose_unit IN ('mg', 'mcg', 'g', 'units', 'IU', 'ml'));

-- Route values
ALTER TABLE public.medication_entries
  ADD CONSTRAINT medication_entries_route_check
  CHECK (route IN ('oral', 'subcutaneous', 'intramuscular', 'topical', 'sublingual', 'intranasal', 'other'));

-- Site values — same rotation map as tirzepatide for consistency
ALTER TABLE public.medication_entries
  ADD CONSTRAINT medication_entries_site_check
  CHECK (
    site IS NULL OR
    site IN ('abdomen_left', 'abdomen_right', 'thigh_left', 'thigh_right', 'arm_left', 'arm_right', 'other')
  );

-- One entry per user per medication per date (prevent accidental duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'medication_entries_user_name_date_unique'
      AND conrelid = 'public.medication_entries'::regclass
  ) THEN
    ALTER TABLE public.medication_entries
      ADD CONSTRAINT medication_entries_user_name_date_unique
      UNIQUE (user_id, medication_name, date);
  END IF;
END $$;

-- GLP-1 dose guard — same valid doses as tirzepatide_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'medication_entries_glp1_dose_check'
      AND conrelid = 'public.medication_entries'::regclass
  ) THEN
    ALTER TABLE public.medication_entries
      ADD CONSTRAINT medication_entries_glp1_dose_check
      CHECK (
        category != 'glp1' OR
        dose IN (2.5, 5.0, 7.5, 10.0, 12.5, 15.0)
      );
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS medication_entries_user_id_idx
  ON public.medication_entries (user_id);

CREATE INDEX IF NOT EXISTS medication_entries_user_date_desc_idx
  ON public.medication_entries (user_id, date DESC);

CREATE INDEX IF NOT EXISTS medication_entries_user_category_idx
  ON public.medication_entries (user_id, category);

-- RLS
ALTER TABLE public.medication_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medication_entries_select_own" ON public.medication_entries;
CREATE POLICY "medication_entries_select_own"
  ON public.medication_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "medication_entries_insert_own" ON public.medication_entries;
CREATE POLICY "medication_entries_insert_own"
  ON public.medication_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "medication_entries_update_own" ON public.medication_entries;
CREATE POLICY "medication_entries_update_own"
  ON public.medication_entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "medication_entries_delete_own" ON public.medication_entries;
CREATE POLICY "medication_entries_delete_own"
  ON public.medication_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_entries TO authenticated;

-- ── Profile toggles ───────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS medications_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS peptides_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.medications_enabled IS
  'Controls whether the Medications section is visible in Plan. Default false — user opts in explicitly.';

COMMENT ON COLUMN public.profiles.peptides_enabled IS
  'Controls whether the Peptides section is visible in Plan. Default false — niche feature, opt-in only.';

-- ── Migration helper: copy tirzepatide_entries → medication_entries ───────────
-- Run this ONCE after creating the table. Safe to re-run (ON CONFLICT DO NOTHING).
-- Existing tirzepatide data is preserved in tirzepatide_entries until fully deprecated.

INSERT INTO public.medication_entries (
  user_id, medication_name, category, date, dose, dose_unit, route, site, notes, created_at
)
SELECT
  user_id,
  'Tirzepatide'     AS medication_name,
  'glp1'            AS category,
  date,
  dose,
  'mg'              AS dose_unit,
  'subcutaneous'    AS route,
  site,
  notes,
  created_at
FROM public.tirzepatide_entries
ON CONFLICT (user_id, medication_name, date) DO NOTHING;
