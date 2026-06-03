-- Migration 004: Onboarding Phase 1 Refactor
--
-- Adds current_state to profiles for the new onboarding step 2.
-- Stores a JSON array string of StateValue slugs selected by the user
-- (e.g. '["burned_out","poor_sleep"]'). Empty selection is stored as '[]'.
--
-- Existing users with onboarding_completed = true are unaffected — the
-- getNextOnboardingStep fast-pass returns null for them regardless of
-- current_state being null.
--
-- Run once against your Supabase project:
--   psql $DATABASE_URL -f 004_onboarding_current_state.sql
--   OR paste into the Supabase SQL editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_state text DEFAULT NULL;

COMMENT ON COLUMN profiles.current_state IS
  'JSON array string of current-state slugs from onboarding step 2 '
  '(e.g. "[\"burned_out\",\"poor_sleep\"]"). Null means step not yet completed.';
