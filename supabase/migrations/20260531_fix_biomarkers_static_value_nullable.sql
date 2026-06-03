-- Meridian — allow qualitative lab results in biomarkers_static
-- Fixes: null value in column "value" violates not-null constraint

ALTER TABLE biomarkers_static
  ADD COLUMN IF NOT EXISTS value_qualitative TEXT,
  ADD COLUMN IF NOT EXISTS result_type TEXT,
  ADD COLUMN IF NOT EXISTS source_marker_name TEXT,
  ADD COLUMN IF NOT EXISTS source_raw_value TEXT,
  ADD COLUMN IF NOT EXISTS panel_type TEXT;

ALTER TABLE biomarkers_static
  ALTER COLUMN value DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_biomarkers_static_result_type
  ON biomarkers_static (result_type)
  WHERE result_type IS NOT NULL;

NOTIFY pgrst, 'reload schema';
