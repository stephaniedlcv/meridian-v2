-- Migration 005: GLP-1 protocol profile toggle + tirzepatide hardening
--
-- Run after 004_tirzepatide.sql.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS glp1_protocol_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.glp1_protocol_enabled IS
  'Controls whether the user sees GLP-1/tirzepatide protocol tracking inside Plan. Defaults to false for privacy and relevance.';

CREATE INDEX IF NOT EXISTS tirzepatide_entries_user_date_desc_idx
  ON public.tirzepatide_entries (user_id, date DESC);

DO $$
BEGIN
  ALTER TABLE public.tirzepatide_entries
    ADD CONSTRAINT tirzepatide_entries_dose_allowed_check
    CHECK (dose IN (2.5, 5.0, 7.5, 10.0, 12.5, 15.0));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
