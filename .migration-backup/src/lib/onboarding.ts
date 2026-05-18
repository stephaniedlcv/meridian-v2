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
 *   4. onboarding_completed !== truthy                       → /onboarding/connect
 *   5. complete                                              → null
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
  if (!p.current_state) return '/onboarding/current-state'

  // Step 3: Goals (Meridian mode)
  if (!p.user_profile) return '/onboarding/goals'

  // Step 4: Connect data
  return '/onboarding/connect'
}
