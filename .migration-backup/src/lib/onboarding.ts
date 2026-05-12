/**
 * Centralized onboarding step resolver.
 *
 * Single source of truth for determining where a user should be in the
 * onboarding flow, used by every page that needs to guard or redirect.
 *
 * Priority order:
 *   1. no profile                          → /onboarding/identity
 *   2. missing full_name OR birth_date     → /onboarding/identity
 *   3. missing biological_profile          → /onboarding/profile
 *   4. missing user_profile                → /onboarding/goals
 *   5. onboarding_completed !== true       → /onboarding/connect
 *   6. complete                            → null
 */
export function getNextOnboardingStep(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return '/onboarding/identity'
  const p = profile as Record<string, unknown>
  if (!p.full_name || !p.birth_date) return '/onboarding/identity'
  if (!p.biological_profile) return '/onboarding/profile'
  if (!p.user_profile) return '/onboarding/goals'
  // Use loose truthiness (not strict === true) so boolean true, string "true",
  // and any other truthy DB serialisation all pass the guard correctly.
  if (!p.onboarding_completed) return '/onboarding/connect'
  return null
}
