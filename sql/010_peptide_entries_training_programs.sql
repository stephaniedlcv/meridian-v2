-- Migration 010: Peptide Entries + Training Programs
-- peptide_entries: subcutaneous/oral peptide cycles (BPC-157, CJC, etc.)
-- training_programs: user-created or template-based training programs
--   (replaces the hardcoded planConfig.js with a DB-backed multi-user system)
-- Run after 009_medication_entries.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── peptide_entries ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.peptide_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peptide_name     text        NOT NULL,
  date             date        NOT NULL,
  dose             numeric(8,2) NOT NULL,
  -- mcg is most common for peptides; mg for some (e.g. BPC oral); units for GH
  dose_unit        text        NOT NULL DEFAULT 'mcg',
  route            text        NOT NULL DEFAULT 'subcutaneous',
  -- Cycle tracking: a cycle is a bounded period of use
  cycle_id         uuid,       -- groups entries into a named cycle
  cycle_active     boolean     NOT NULL DEFAULT true,
  cycle_start      date,
  cycle_end        date,       -- null = open-ended / maintenance
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.peptide_entries
  ADD CONSTRAINT peptide_entries_dose_unit_check
  CHECK (dose_unit IN ('mcg', 'mg', 'units', 'IU'));

ALTER TABLE public.peptide_entries
  ADD CONSTRAINT peptide_entries_route_check
  CHECK (route IN ('subcutaneous', 'intramuscular', 'oral', 'intranasal', 'sublingual', 'other'));

ALTER TABLE public.peptide_entries
  ADD CONSTRAINT peptide_entries_cycle_dates_check
  CHECK (cycle_end IS NULL OR cycle_end >= cycle_start);

-- One log per peptide per day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'peptide_entries_user_name_date_unique'
      AND conrelid = 'public.peptide_entries'::regclass
  ) THEN
    ALTER TABLE public.peptide_entries
      ADD CONSTRAINT peptide_entries_user_name_date_unique
      UNIQUE (user_id, peptide_name, date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS peptide_entries_user_id_idx
  ON public.peptide_entries (user_id);

CREATE INDEX IF NOT EXISTS peptide_entries_user_date_desc_idx
  ON public.peptide_entries (user_id, date DESC);

CREATE INDEX IF NOT EXISTS peptide_entries_user_active_idx
  ON public.peptide_entries (user_id, cycle_active);

ALTER TABLE public.peptide_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "peptide_entries_select_own" ON public.peptide_entries;
CREATE POLICY "peptide_entries_select_own"
  ON public.peptide_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "peptide_entries_insert_own" ON public.peptide_entries;
CREATE POLICY "peptide_entries_insert_own"
  ON public.peptide_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "peptide_entries_update_own" ON public.peptide_entries;
CREATE POLICY "peptide_entries_update_own"
  ON public.peptide_entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "peptide_entries_delete_own" ON public.peptide_entries;
CREATE POLICY "peptide_entries_delete_own"
  ON public.peptide_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.peptide_entries TO authenticated;

-- ── training_programs ─────────────────────────────────────────────────────────
-- Stores user training programs. Replaces hardcoded planConfig.js.
-- A program has phases; phases have weeks; the UI derives current week from start_date.

CREATE TABLE IF NOT EXISTS public.training_programs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  -- goal drives template suggestions and phase descriptions
  goal             text        NOT NULL DEFAULT 'recomposition',
  -- total_weeks: 12, 16, 20, 24 — drives all week calculations
  total_weeks      integer     NOT NULL DEFAULT 24,
  start_date       date        NOT NULL,
  -- sessions_per_week: how many training days per week (2–6)
  sessions_per_week integer    NOT NULL DEFAULT 4,
  -- template used as starting point (null = built from scratch)
  template_id      text,
  -- phases stored as JSONB array: [{name, start_week, end_week, rir_target, description, color}]
  phases           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- milestones: [{week, label, type}] — type: 'assessment' | 'deload' | 'event' | 'other'
  milestones       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- deload_weeks: array of week numbers, e.g. [4, 8, 12, 16, 20, 24]
  deload_weeks     integer[]   NOT NULL DEFAULT '{}',
  active           boolean     NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_programs
  ADD CONSTRAINT training_programs_goal_check
  CHECK (goal IN ('recomposition', 'fat_loss', 'muscle_gain', 'strength', 'endurance', 'maintenance', 'custom'));

ALTER TABLE public.training_programs
  ADD CONSTRAINT training_programs_total_weeks_check
  CHECK (total_weeks BETWEEN 4 AND 52);

ALTER TABLE public.training_programs
  ADD CONSTRAINT training_programs_sessions_check
  CHECK (sessions_per_week BETWEEN 2 AND 6);

DROP TRIGGER IF EXISTS training_programs_updated_at ON public.training_programs;
CREATE TRIGGER training_programs_updated_at
  BEFORE UPDATE ON public.training_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Only one active program per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS training_programs_one_active_per_user
  ON public.training_programs (user_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS training_programs_user_id_idx
  ON public.training_programs (user_id);

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_programs_select_own" ON public.training_programs;
CREATE POLICY "training_programs_select_own"
  ON public.training_programs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "training_programs_insert_own" ON public.training_programs;
CREATE POLICY "training_programs_insert_own"
  ON public.training_programs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "training_programs_update_own" ON public.training_programs;
CREATE POLICY "training_programs_update_own"
  ON public.training_programs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "training_programs_delete_own" ON public.training_programs;
CREATE POLICY "training_programs_delete_own"
  ON public.training_programs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_programs TO authenticated;
