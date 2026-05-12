'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { getNextOnboardingStep } from '@/lib/onboarding'

// ── Diagnostic page — NO design, NO auth guard, intentionally ugly ─────────────
// Visit /debug/profile-health to see a raw dump of:
//   • Supabase URL in use
//   • Auth session state
//   • profiles row query result + full error details
//   • getNextOnboardingStep resolution
//   • Whether /profile should load or redirect
// REMOVE this page once the root cause is confirmed.

interface DiagResult {
  supabaseUrl: string
  userId: string | null
  userEmail: string | null
  sessionError: string | null
  selectString: string
  profileData: unknown
  profileError: {
    code: string | null
    message: string | null
    details: string | null
    hint: string | null
  } | null
  nextStep: string | null
  verdict: string
}

const SELECT = 'full_name, biological_profile, user_profile, birth_date, avatar_url, medications, onboarding_completed'

export default function ProfileHealthPage() {
  const [result, setResult] = useState<DiagResult | null>(null)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    async function run() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(not set)'

      // Use fresh browser client — same env vars as the rest of the app
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // 1. Auth check
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (!user) {
        setResult({
          supabaseUrl,
          userId: null,
          userEmail: null,
          sessionError: authError?.message ?? 'No active session — user is null',
          selectString: SELECT,
          profileData: null,
          profileError: null,
          nextStep: null,
          verdict: 'FAIL: No auth session. User must be logged in to run this diagnostic.',
        })
        setRunning(false)
        return
      }

      // 2. Profile query — capture full error
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select(SELECT)
        .eq('id', user.id)
        .single()

      // 3. Resolver
      const nextStep = getNextOnboardingStep(prof)

      // 4. Verdict
      let verdict: string
      if (profError) {
        verdict = `FAIL: Supabase returned an error — code=${profError.code ?? 'n/a'} message="${profError.message}"`
      } else if (prof === null) {
        verdict = 'FAIL: Query succeeded but returned null — no matching row, or RLS blocked the read silently'
      } else if (nextStep !== null) {
        verdict = `REDIRECT: Profile row exists but getNextOnboardingStep returned "${nextStep}" — see missing fields below`
      } else {
        verdict = 'OK: Profile row exists, all fields present, getNextOnboardingStep → null. /profile should load.'
      }

      setResult({
        supabaseUrl,
        userId: user.id,
        userEmail: user.email ?? null,
        sessionError: null,
        selectString: SELECT,
        profileData: prof,
        profileError: profError
          ? {
              code:    profError.code    ?? null,
              message: profError.message ?? null,
              details: (profError as unknown as Record<string, unknown>).details as string ?? null,
              hint:    (profError as unknown as Record<string, unknown>).hint    as string ?? null,
            }
          : null,
        nextStep,
        verdict,
      })
      setRunning(false)
    }
    run()
  }, [])

  const pre: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '13px',
    background: '#111',
    color: '#eee',
    padding: '12px',
    borderRadius: '4px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: '0 0 16px',
  }
  const h2: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#ccc',
    margin: '20px 0 6px',
    borderBottom: '1px solid #333',
    paddingBottom: '4px',
  }
  const warn: React.CSSProperties = { ...pre, color: '#f87171' }
  const ok: React.CSSProperties = { ...pre, color: '#4ade80' }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '16px', marginBottom: '4px' }}>
        /debug/profile-health
      </h1>
      <p style={{ color: '#666', fontSize: '12px', marginBottom: '24px' }}>
        Meridian diagnostic harness — remove after root cause confirmed. Does NOT log secret keys.
      </p>

      {running && <pre style={pre}>Running diagnostics…</pre>}

      {result && (
        <>
          {/* Verdict — most important, shown first */}
          <h2 style={h2}>VERDICT</h2>
          <pre style={result.verdict.startsWith('OK') ? ok : warn}>{result.verdict}</pre>

          {/* Auth */}
          <h2 style={h2}>AUTH SESSION</h2>
          <pre style={pre}>{result.sessionError
            ? `ERROR: ${result.sessionError}`
            : `user.id    = ${result.userId}\nuser.email = ${result.userEmail}`
          }</pre>

          {/* Supabase URL */}
          <h2 style={h2}>SUPABASE URL (public)</h2>
          <pre style={pre}>{result.supabaseUrl}</pre>

          {/* Select string */}
          <h2 style={h2}>SELECT STRING</h2>
          <pre style={pre}>{result.selectString}</pre>

          {/* Query error */}
          <h2 style={h2}>PROFILE QUERY ERROR</h2>
          {result.profileError ? (
            <pre style={warn}>{JSON.stringify(result.profileError, null, 2)}</pre>
          ) : (
            <pre style={ok}>null — no error</pre>
          )}

          {/* Profile data */}
          <h2 style={h2}>PROFILE ROW RETURNED</h2>
          <pre style={pre}>{JSON.stringify(result.profileData, null, 2)}</pre>

          {/* Field-by-field check */}
          {result.profileData && (
            <>
              <h2 style={h2}>FIELD CHECK (what getNextOnboardingStep sees)</h2>
              <pre style={pre}>{(() => {
                const p = result.profileData as Record<string, unknown>
                const fields = [
                  'full_name',
                  'birth_date',
                  'biological_profile',
                  'user_profile',
                  'onboarding_completed',
                ]
                return fields.map(f => {
                  const v = p[f]
                  const type = typeof v
                  const truthy = !!v
                  return `${f.padEnd(22)} = ${JSON.stringify(v)} (type: ${type}, truthy: ${truthy})`
                }).join('\n')
              })()}</pre>
            </>
          )}

          {/* Resolver */}
          <h2 style={h2}>getNextOnboardingStep RESULT</h2>
          <pre style={result.nextStep === null ? ok : warn}>
            {result.nextStep === null ? 'null — /profile should load normally' : `"${result.nextStep}" — will redirect`}
          </pre>

          {/* Interpretation guide */}
          <h2 style={h2}>HOW TO READ THIS</h2>
          <pre style={pre}>{[
            'profileError.code = "PGRST116"  → .single() found 0 rows (no profile row, or RLS blocked)',
            'profileError.code = "42703"      → column does not exist in the table (bad select)',
            'profileError.code = "42501"      → RLS permission denied',
            'profileError = null, data = null → PostgREST anomaly or session mismatch',
            'onboarding_completed truthy=false → column is null/false/0/"" in DB',
            'onboarding_completed type=string → column is TEXT not BOOLEAN — value like "true" is truthy, ok',
            'SUPABASE_URL wrong domain        → requests going to wrong project, all queries will fail',
            'user.id = null                   → no active session; user must sign in first',
          ].join('\n')}</pre>
        </>
      )}
    </div>
  )
}
