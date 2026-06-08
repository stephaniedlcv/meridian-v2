-- Align legacy tirzepatide_entries injection sites with medication_entries.
-- This keeps backward compatibility while allowing the same standard subcutaneous
-- site options exposed by the Medication model, excluding 'other' for rotation logic.

ALTER TABLE public.tirzepatide_entries
  DROP CONSTRAINT IF EXISTS tirzepatide_entries_site_allowed_check;

ALTER TABLE public.tirzepatide_entries
  ADD CONSTRAINT tirzepatide_entries_site_allowed_check
  CHECK (
    site IN (
      'abdomen_left',
      'abdomen_right',
      'thigh_left',
      'thigh_right',
      'arm_left',
      'arm_right'
    )
  );

COMMENT ON CONSTRAINT tirzepatide_entries_site_allowed_check
  ON public.tirzepatide_entries IS
  'Allowed dose log injection sites aligned with medication_entries, excluding other for rotation logic.';
