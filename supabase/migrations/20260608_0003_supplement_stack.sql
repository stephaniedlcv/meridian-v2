-- Migration 008: Supplement Stack
-- User's active oral supplement protocol.
-- Each row = one supplement in the user's stack.
-- Run after 007_lab_documents.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.supplement_stack (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_name  text        NOT NULL,
  brand            text,
  dose             numeric(8,2),
  dose_unit        text        NOT NULL DEFAULT 'mg',
  -- How often: daily, 2x_week, 3x_week, as_needed, high_stress_only, cycling
  frequency        text        NOT NULL DEFAULT 'daily',
  -- When to take: morning, evening, midday, with_food, before_training, before_bed
  timing           text,
  -- Optional link to a biomarker slug (e.g. 'vitamin_d') for lab correlation
  connected_biomarker text,
  active           boolean     NOT NULL DEFAULT true,
  notes            text,
  sort_order       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Constraints
ALTER TABLE public.supplement_stack
  DROP CONSTRAINT IF EXISTS supplement_stack_dose_unit_check;

ALTER TABLE public.supplement_stack
  ADD CONSTRAINT supplement_stack_dose_unit_check
  CHECK (dose_unit IN ('mg', 'mcg', 'g', 'IU', 'capsules', 'ml', 'drops', 'servings'));

ALTER TABLE public.supplement_stack
  DROP CONSTRAINT IF EXISTS supplement_stack_frequency_check;

ALTER TABLE public.supplement_stack
  ADD CONSTRAINT supplement_stack_frequency_check
  CHECK (frequency IN ('daily', '2x_week', '3x_week', '5x_week', 'as_needed', 'high_stress_only', 'cycling', 'other'));

ALTER TABLE public.supplement_stack
  DROP CONSTRAINT IF EXISTS supplement_stack_timing_check;

ALTER TABLE public.supplement_stack
  ADD CONSTRAINT supplement_stack_timing_check
  CHECK (timing IS NULL OR timing IN ('morning', 'midday', 'evening', 'before_bed', 'with_food', 'before_training', 'after_training', 'other'));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supplement_stack_updated_at ON public.supplement_stack;
CREATE TRIGGER supplement_stack_updated_at
  BEFORE UPDATE ON public.supplement_stack
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS supplement_stack_user_id_idx
  ON public.supplement_stack (user_id);

CREATE INDEX IF NOT EXISTS supplement_stack_user_active_idx
  ON public.supplement_stack (user_id, active);

CREATE INDEX IF NOT EXISTS supplement_stack_user_order_idx
  ON public.supplement_stack (user_id, sort_order);

-- RLS
ALTER TABLE public.supplement_stack ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplement_stack_select_own" ON public.supplement_stack;
CREATE POLICY "supplement_stack_select_own"
  ON public.supplement_stack FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "supplement_stack_insert_own" ON public.supplement_stack;
CREATE POLICY "supplement_stack_insert_own"
  ON public.supplement_stack FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "supplement_stack_update_own" ON public.supplement_stack;
CREATE POLICY "supplement_stack_update_own"
  ON public.supplement_stack FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "supplement_stack_delete_own" ON public.supplement_stack;
CREATE POLICY "supplement_stack_delete_own"
  ON public.supplement_stack FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplement_stack TO authenticated;
