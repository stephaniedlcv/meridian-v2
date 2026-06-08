-- Meridian V2 — Lab Upload Sessions
--
-- Adds per-upload traceability for OCR lab uploads.
-- A single session can connect confirmed biomarkers_static rows and
-- pending_biomarkers rows back to the same PDF/upload attempt.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.lab_upload_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  source_pdf_name     text,
  source_pdf_url      text,
  source_pdf_hash     text,
  source_file_type    text,
  file_size           bigint,
  page_count          integer,

  status              text NOT NULL DEFAULT 'processing',
  collected_at        timestamptz,
  processed_at        timestamptz,
  confirmed_at        timestamptz,

  total_extracted     integer NOT NULL DEFAULT 0,
  total_matched       integer NOT NULL DEFAULT 0,
  total_errors        integer NOT NULL DEFAULT 0,
  confirmed_count     integer NOT NULL DEFAULT 0,
  quantitative_count  integer NOT NULL DEFAULT 0,
  qualitative_count   integer NOT NULL DEFAULT 0,
  pending_count       integer NOT NULL DEFAULT 0,

  error_message       text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at          timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_upload_sessions
  DROP CONSTRAINT IF EXISTS lab_upload_sessions_status_check;

ALTER TABLE public.lab_upload_sessions
  ADD CONSTRAINT lab_upload_sessions_status_check
  CHECK (
    status IN (
      'processing',
      'staged',
      'confirmed',
      'failed',
      'cancelled'
    )
  );

ALTER TABLE public.lab_upload_sessions
  DROP CONSTRAINT IF EXISTS lab_upload_sessions_counts_check;

ALTER TABLE public.lab_upload_sessions
  ADD CONSTRAINT lab_upload_sessions_counts_check
  CHECK (
    total_extracted >= 0
    AND total_matched >= 0
    AND total_errors >= 0
    AND confirmed_count >= 0
    AND quantitative_count >= 0
    AND qualitative_count >= 0
    AND pending_count >= 0
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

DROP TRIGGER IF EXISTS lab_upload_sessions_updated_at ON public.lab_upload_sessions;

CREATE TRIGGER lab_upload_sessions_updated_at
  BEFORE UPDATE ON public.lab_upload_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.biomarkers_static
  ADD COLUMN IF NOT EXISTS upload_session_id uuid REFERENCES public.lab_upload_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.biomarkers_static
  ADD COLUMN IF NOT EXISTS source_pdf_name text;

ALTER TABLE public.pending_biomarkers
  ADD COLUMN IF NOT EXISTS upload_session_id uuid REFERENCES public.lab_upload_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lab_upload_sessions_user_id_idx
  ON public.lab_upload_sessions (user_id);

CREATE INDEX IF NOT EXISTS lab_upload_sessions_user_created_idx
  ON public.lab_upload_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lab_upload_sessions_status_idx
  ON public.lab_upload_sessions (status);

CREATE INDEX IF NOT EXISTS lab_upload_sessions_source_pdf_hash_idx
  ON public.lab_upload_sessions (source_pdf_hash)
  WHERE source_pdf_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS biomarkers_static_upload_session_id_idx
  ON public.biomarkers_static (upload_session_id);

CREATE INDEX IF NOT EXISTS biomarkers_static_user_upload_session_idx
  ON public.biomarkers_static (user_id, upload_session_id);

CREATE INDEX IF NOT EXISTS pending_biomarkers_upload_session_id_idx
  ON public.pending_biomarkers (upload_session_id);

CREATE INDEX IF NOT EXISTS pending_biomarkers_user_upload_session_idx
  ON public.pending_biomarkers (user_id, upload_session_id);

ALTER TABLE public.lab_upload_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_upload_sessions_select_own" ON public.lab_upload_sessions;
CREATE POLICY "lab_upload_sessions_select_own"
  ON public.lab_upload_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lab_upload_sessions_insert_own" ON public.lab_upload_sessions;
CREATE POLICY "lab_upload_sessions_insert_own"
  ON public.lab_upload_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lab_upload_sessions_update_own" ON public.lab_upload_sessions;
CREATE POLICY "lab_upload_sessions_update_own"
  ON public.lab_upload_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lab_upload_sessions_delete_own" ON public.lab_upload_sessions;
CREATE POLICY "lab_upload_sessions_delete_own"
  ON public.lab_upload_sessions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_upload_sessions TO authenticated;

COMMENT ON TABLE public.lab_upload_sessions IS
  'Per-PDF OCR upload sessions linking confirmed and pending biomarker records to their source upload.';

COMMENT ON COLUMN public.biomarkers_static.upload_session_id IS
  'Optional link to the OCR lab upload session that created this confirmed biomarker row.';

COMMENT ON COLUMN public.pending_biomarkers.upload_session_id IS
  'Optional link to the OCR lab upload session that produced this pending classification row.';
