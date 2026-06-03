-- Migration 004: Tirzepatide / GLP-1 protocol entries
--
-- Creates the user-owned injection tracking table used by /protocol.
-- Run this before 005_glp1_protocol_toggle.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tirzepatide_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  dose numeric(4,1) NOT NULL,
  site text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Keep this migration safe if the table was created manually before.
ALTER TABLE public.tirzepatide_entries
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

ALTER TABLE public.tirzepatide_entries
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.tirzepatide_entries
  ADD COLUMN IF NOT EXISTS date date;

ALTER TABLE public.tirzepatide_entries
  ADD COLUMN IF NOT EXISTS dose numeric(4,1);

ALTER TABLE public.tirzepatide_entries
  ADD COLUMN IF NOT EXISTS site text;

ALTER TABLE public.tirzepatide_entries
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.tirzepatide_entries
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Enforce required fields when the table already existed.
ALTER TABLE public.tirzepatide_entries
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN date SET NOT NULL,
  ALTER COLUMN dose SET NOT NULL,
  ALTER COLUMN site SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

-- Ensure primary key exists if the table was created manually without one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tirzepatide_entries_pkey'
      AND conrelid = 'public.tirzepatide_entries'::regclass
  ) THEN
    ALTER TABLE public.tirzepatide_entries
      ADD CONSTRAINT tirzepatide_entries_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- One entry per user per date prevents duplicate weekly/day records.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tirzepatide_entries_user_date_unique'
      AND conrelid = 'public.tirzepatide_entries'::regclass
  ) THEN
    ALTER TABLE public.tirzepatide_entries
      ADD CONSTRAINT tirzepatide_entries_user_date_unique UNIQUE (user_id, date);
  END IF;
END $$;

-- Limit injection sites to the rotation map supported by the UI.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tirzepatide_entries_site_allowed_check'
      AND conrelid = 'public.tirzepatide_entries'::regclass
  ) THEN
    ALTER TABLE public.tirzepatide_entries
      ADD CONSTRAINT tirzepatide_entries_site_allowed_check
      CHECK (
        site IN (
          'abdomen_left',
          'abdomen_right',
          'thigh_left',
          'thigh_right'
        )
      );
  END IF;
END $$;

-- Match the dose options currently exposed in the UI.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tirzepatide_entries_dose_allowed_check'
      AND conrelid = 'public.tirzepatide_entries'::regclass
  ) THEN
    ALTER TABLE public.tirzepatide_entries
      ADD CONSTRAINT tirzepatide_entries_dose_allowed_check
      CHECK (dose IN (2.5, 5.0, 7.5, 10.0, 12.5, 15.0));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tirzepatide_entries_user_id_idx
  ON public.tirzepatide_entries (user_id);

CREATE INDEX IF NOT EXISTS tirzepatide_entries_date_desc_idx
  ON public.tirzepatide_entries (date DESC);

CREATE INDEX IF NOT EXISTS tirzepatide_entries_user_date_desc_idx
  ON public.tirzepatide_entries (user_id, date DESC);

ALTER TABLE public.tirzepatide_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tirzepatide_entries_select_own" ON public.tirzepatide_entries;
CREATE POLICY "tirzepatide_entries_select_own"
  ON public.tirzepatide_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tirzepatide_entries_insert_own" ON public.tirzepatide_entries;
CREATE POLICY "tirzepatide_entries_insert_own"
  ON public.tirzepatide_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tirzepatide_entries_update_own" ON public.tirzepatide_entries;
CREATE POLICY "tirzepatide_entries_update_own"
  ON public.tirzepatide_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tirzepatide_entries_delete_own" ON public.tirzepatide_entries;
CREATE POLICY "tirzepatide_entries_delete_own"
  ON public.tirzepatide_entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tirzepatide_entries TO authenticated;
