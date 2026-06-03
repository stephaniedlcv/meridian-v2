/**
 * Centralized onboarding step resolver.
 *
 * Single source of truth for determining where a user should be in the
 * onboarding flow, used by every page that needs to guard or redirect.
 *
 * Fast-pass: if onboarding_completed is truthy the user is done — return null
 * immediately regardless of any other field state.
 *
 * Step order:
 *   1. missing full_name, birth_date, OR biological_profile  → /onboarding/identity
 *   2. current_state not set                                 → /onboarding/current-state
 *   3. user_profile not set                                  → /onboarding/goals
 *   4. baseline not completed                                → /onboarding/baseline
 *   5. onboarding_completed !== truthy                       → /onboarding/connect
 *   6. complete                                              → null
 *
 * Note: /onboarding/profile is deprecated. biological_profile is now
 * collected in step 1 (identity). The profile route exists only as a
 * backward-compat redirect for users who bookmarked it.
 */
export function getNextOnboardingStep(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return '/onboarding/identity'
  const p = profile as Record<string, unknown>

  // Fast-pass: already completed — skip all field checks
  if (p.onboarding_completed) return null

  // Step 1: Identity (now includes biological_profile)
  if (!p.full_name || !p.birth_date || !p.biological_profile) return '/onboarding/identity'

  // Step 2: Current state
  // Guarded by column existence: if the DB column hasn't been provisioned yet
  // (migration 004 not applied), 'current_state' won't be in the response
  // object at all — skip the step silently rather than looping back to identity.
  // Once migration 004 is applied the key appears and the step activates.
  if ('current_state' in p && !p.current_state) return '/onboarding/current-state'

  // Step 3: Goals (Meridian mode)
  if (!p.user_profile) return '/onboarding/goals'

  // Step 4: Baseline calibration
  // Guarded by column existence — same pattern as current_state.
  // If migration 005 hasn't been applied, 'baseline_completed' won't appear in
  // the select('*') response, so the key is absent and the step is silently
  // skipped. Once migration 005 runs, baseline_completed defaults to false for
  // all new users and the step activates automatically.
  if ('baseline_completed' in p && !p.baseline_completed) return '/onboarding/baseline'

  // Step 5: Connect data
  return '/onboarding/connect'
}
