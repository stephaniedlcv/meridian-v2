-- Migration 005: Baseline calibration step
--
-- Adds baseline_completed as the routing sentinel for the new /onboarding/baseline
-- step (step 4 of 5). Also safely adds the physical/lifestyle profile fields if
-- they do not already exist (some may have been added in earlier migrations or
-- directly in the Supabase dashboard).
--
-- All columns are nullable with safe defaults — existing users are unaffected.
-- Users with onboarding_completed = true are fast-passed by getNextOnboardingStep
-- and will never see the baseline step regardless of baseline_completed.
--
-- Run once against your Supabase project:
--   psql $DATABASE_URL -f 005_baseline_fields.sql
--   OR paste into the Supabase SQL editor (Dashboard → SQL Editor → New Query).

-- Routing sentinel — checked by getNextOnboardingStep step 4
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS baseline_completed boolean NOT NULL DEFAULT false;

-- Physical context fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS height_cm       numeric       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight_kg       numeric       DEFAULT NULL;

-- Activity & training fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS activity_level  text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS training_days   text          DEFAULT NULL;

-- Lifestyle fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS body_goal_phase text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS diet_pattern    text          DEFAULT NULL;

COMMENT ON COLUMN profiles.baseline_completed IS
  'True once the user has passed through /onboarding/baseline (step 4 of 5). '
  'Set to true by the baseline page on Continue regardless of which optional '
  'fields were filled in. Used as the routing sentinel in getNextOnboardingStep.';
