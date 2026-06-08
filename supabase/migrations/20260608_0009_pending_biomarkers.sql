-- Meridian V2 — Pending Biomarkers
--
-- Canonical migration for OCR markers that could not be confidently matched
-- to the biomarker dictionary.
--
-- These rows do NOT enter biomarkers_static, dashboard signals, lab history,
-- safety logic, or current snapshot calculations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.pending_biomarkers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Raw OCR marker payload
  raw_name            text        NOT NULL,
  raw_value           numeric,
  raw_unit            text,
  raw_reference_range text,

  -- Source context
  collected_at        timestamptz NOT NULL DEFAULT now(),
  source_pdf_name     text,

  -- Review workflow
  status              text        NOT NULL DEFAULT 'pending_classification',
  reason              text,
  reviewed_by         uuid        REFERENCES auth.users(id),
  reviewed_at         timestamptz,
  resolution          text,
  canonical_slug      text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_biomarkers
  DROP CONSTRAINT IF EXISTS pending_biomarkers_status_check;

ALTER TABLE public.pending_biomarkers
  ADD CONSTRAINT pending_biomarkers_status_check
  CHECK (
    status IN (
      'pending_classification',
      'classified',
      'ignored',
      'rejected'
    )
  );

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pending_biomarkers_updated_at ON public.pending_biomarkers;

CREATE TRIGGER pending_biomarkers_updated_at
  BEFORE UPDATE ON public.pending_biomarkers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS pending_biomarkers_user_id_idx
  ON public.pending_biomarkers (user_id);

CREATE INDEX IF NOT EXISTS pending_biomarkers_status_idx
  ON public.pending_biomarkers (status);

CREATE INDEX IF NOT EXISTS pending_biomarkers_user_status_idx
  ON public.pending_biomarkers (user_id, status);

CREATE INDEX IF NOT EXISTS pending_biomarkers_created_at_idx
  ON public.pending_biomarkers (created_at DESC);

CREATE INDEX IF NOT EXISTS pending_biomarkers_raw_name_idx
  ON public.pending_biomarkers (lower(raw_name));

ALTER TABLE public.pending_biomarkers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_biomarkers_select_own" ON public.pending_biomarkers;
CREATE POLICY "pending_biomarkers_select_own"
  ON public.pending_biomarkers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pending_biomarkers_insert_own" ON public.pending_biomarkers;
CREATE POLICY "pending_biomarkers_insert_own"
  ON public.pending_biomarkers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pending_biomarkers_update_own" ON public.pending_biomarkers;
CREATE POLICY "pending_biomarkers_update_own"
  ON public.pending_biomarkers
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pending_biomarkers_delete_own" ON public.pending_biomarkers;
CREATE POLICY "pending_biomarkers_delete_own"
  ON public.pending_biomarkers
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_biomarkers TO authenticated;
