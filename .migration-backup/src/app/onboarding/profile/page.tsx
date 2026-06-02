'use client'

/**
 * /onboarding/profile — DEPRECATED
 *
 * Biological profile collection was merged into /onboarding/identity (Step 1).
 * This page exists solely as a backward-compat redirect so users who bookmarked
 * or were mid-flow at this step are routed to the correct next step.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { getNextOnboardingStep } from '@/lib/onboarding'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function ProfilePageRedirect() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/onboarding/welcome'); return }
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, birth_date, biological_profile, current_state, user_profile, onboarding_completed')
        .eq('id', user.id)
        .single()
      const nextStep = getNextOnboardingStep(prof)
      router.replace(nextStep ?? '/dashboard')
    }
    redirect()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#061316',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        border: '2px solid rgba(45,212,191,0.25)',
        borderTopColor: '#2DD4BF',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
