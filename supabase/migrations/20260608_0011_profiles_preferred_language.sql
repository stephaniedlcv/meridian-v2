-- Persist the user's preferred Meridian UI language in Supabase.
-- localStorage remains a fast client fallback, but profiles.preferred_language
-- is the source that survives devices, browsers, and sessions.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text;

UPDATE public.profiles
SET preferred_language = 'es'
WHERE preferred_language IS NULL
   OR preferred_language NOT IN ('en', 'es');

ALTER TABLE public.profiles
  ALTER COLUMN preferred_language SET DEFAULT 'es';

ALTER TABLE public.profiles
  ALTER COLUMN preferred_language SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN ('en', 'es'));

COMMENT ON COLUMN public.profiles.preferred_language IS
  'Preferred Meridian UI language. Supported values: en, es. localStorage may cache this client-side, but Supabase is the persistent source.';
