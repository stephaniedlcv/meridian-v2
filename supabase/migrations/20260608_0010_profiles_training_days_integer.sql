-- Align profiles.training_days with app/Profile/Insight contract.
-- The app treats training_days as a numeric weekly frequency from 0 to 7.
-- Earlier baseline migration created it as text, which caused Profile/Insight to read it as null.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS training_days text DEFAULT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN training_days TYPE integer
  USING CASE
    WHEN training_days IS NULL THEN NULL
    WHEN btrim(training_days::text) = '' THEN NULL
    WHEN training_days::text ~ '^[0-9]+$'
      THEN LEAST(GREATEST((training_days::text)::integer, 0), 7)
    ELSE NULL
  END;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_training_days_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_training_days_check
  CHECK (training_days IS NULL OR (training_days >= 0 AND training_days <= 7));

COMMENT ON COLUMN public.profiles.training_days IS
  'Number of training days per week, from 0 to 7. Used by Profile, onboarding baseline, and Insight health context.';
