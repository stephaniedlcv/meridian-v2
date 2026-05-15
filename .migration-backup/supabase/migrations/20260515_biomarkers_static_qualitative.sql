-- Meridian — biomarkers_static qualitative support migration
-- Adds columns required for qualitative result types (serology, urinalysis dipstick,
-- microscopy, immunology).  All columns are nullable so existing quantitative rows
-- are unaffected.
--
-- HOW TO RUN:
--   Supabase Dashboard → your project → SQL Editor → New Query → paste & Run
--
-- After running, the PostgREST schema cache is refreshed automatically via NOTIFY.
-- No app restart required.

-- ── Add missing columns ────────────────────────────────────────────────────────
ALTER TABLE biomarkers_static
  ADD COLUMN IF NOT EXISTS value_qualitative  TEXT,
  ADD COLUMN IF NOT EXISTS result_type        TEXT,
  ADD COLUMN IF NOT EXISTS source_marker_name TEXT,
  ADD COLUMN IF NOT EXISTS source_raw_value   TEXT,
  ADD COLUMN IF NOT EXISTS panel_type         TEXT;

-- ── Optional: index for qualitative result lookups ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_biomarkers_static_result_type
  ON biomarkers_static (result_type)
  WHERE result_type IS NOT NULL;

-- ── Refresh PostgREST schema cache immediately ────────────────────────────────
-- This eliminates the "could not find column in schema cache" error without
-- requiring a Supabase project restart.
NOTIFY pgrst, 'reload schema';
