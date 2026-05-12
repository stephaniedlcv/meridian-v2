"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function MeridianApp() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setChecking(false);
        return;
      }
      // Guard: check onboarding completion before allowing app access.
      // Redirect to the exact step that is missing required data.
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, full_name, biological_profile, user_profile')
        .eq('id', user.id)
        .single();
      if (!profile || !profile.onboarding_completed) {
        if (!profile?.full_name) {
          router.push('/onboarding/identity');
        } else if (!profile?.biological_profile) {
          router.push('/onboarding/profile');
        } else {
          router.push('/onboarding/goals');
        }
        return;
      }
      router.push("/dashboard");
    }
    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#061316",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Ambient orbs */}
        <div style={{ position: "absolute", top: "-20%", left: "-15%", width: "55%", height: "55%", background: "radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)", filter: "blur(80px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-15%", width: "55%", height: "55%", background: "radial-gradient(circle, rgba(103,232,249,0.10) 0%, transparent 70%)", filter: "blur(80px)", pointerEvents: "none" }} />
        {/* Logo halo */}
        <div style={{ position: "relative", width: "112px", height: "112px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Outer faint orbit ring */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "1px solid rgba(103,232,249,0.09)",
            boxShadow: "0 0 48px rgba(45,212,191,0.08), 0 0 120px rgba(45,212,191,0.04)",
          }} />
          {/* Inner reticle ring — closer to the M */}
          <div style={{
            position: "absolute", inset: "16px", borderRadius: "50%",
            border: "0.5px solid rgba(103,232,249,0.13)",
          }} />
          <div style={{
            fontFamily: "var(--font-fraunces), serif",
            fontSize: "58px",
            fontWeight: 700,
            background: "linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            position: "relative",
            zIndex: 1,
          }}>
            M
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#061316",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient background orbs */}
      <div style={{ position: "absolute", top: "-15%", left: "-10%", width: "55%", height: "55%", background: "radial-gradient(circle, rgba(45,212,191,0.13) 0%, transparent 70%)", filter: "blur(90px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: "55%", height: "55%", background: "radial-gradient(circle, rgba(103,232,249,0.11) 0%, transparent 70%)", filter: "blur(90px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "40%", height: "30%", background: "radial-gradient(circle, rgba(45,212,191,0.05) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0px" }}>

        {/* Logo halo */}
        <div style={{
          position: "relative",
          width: "128px",
          height: "128px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}>
          {/* Outer orbit ring — ultra-thin, barely visible */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "1px solid rgba(103,232,249,0.09)",
            boxShadow: "0 0 56px rgba(45,212,191,0.07), 0 0 140px rgba(45,212,191,0.03)",
          }} />
          {/* Inner reticle ring — sits close to the M */}
          <div style={{
            position: "absolute", inset: "18px", borderRadius: "50%",
            border: "0.5px solid rgba(103,232,249,0.14)",
          }} />
          <div style={{
            fontFamily: "var(--font-fraunces), serif",
            fontSize: "64px",
            fontWeight: 700,
            background: "linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            position: "relative",
            zIndex: 1,
          }}>
            M
          </div>
        </div>

        {/* Wordmark */}
        <div style={{
          fontFamily: "var(--font-fraunces), serif",
          fontSize: "32px",
          fontWeight: 700,
          color: "#EAFBF7",
          letterSpacing: "-0.05em",
          marginBottom: "10px",
        }}>
          Meridian
        </div>

        {/* System tag */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "48px",
        }}>
          <div style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: "#2DD4BF",
            boxShadow: "0 0 8px rgba(45,212,191,0.9), 0 0 16px rgba(45,212,191,0.4)",
          }} />
          <div style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#5F8E85",
          }}>
            Biological Intelligence System
          </div>
          <div style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: "#2DD4BF",
            boxShadow: "0 0 8px rgba(45,212,191,0.9), 0 0 16px rgba(45,212,191,0.4)",
          }} />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => router.push("/onboarding/welcome?mode=signup")}
            style={{
              padding: "15px 32px",
              background: "linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)",
              border: "none",
              borderRadius: "14px",
              color: "#061316",
              fontFamily: "Plus Jakarta Sans, sans-serif",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 0 24px rgba(45,212,191,0.35), 0 0 60px rgba(45,212,191,0.12), inset 0 1px 0 rgba(255,255,255,0.25)",
              letterSpacing: "-0.01em",
            }}
          >
            Get Started
          </button>
          <button
            onClick={() => router.push("/onboarding/welcome?mode=login")}
            style={{
              padding: "15px 32px",
              background: "rgba(232,248,245,0.055)",
              border: "1px solid rgba(103,232,249,0.22)",
              borderRadius: "14px",
              color: "#9ACBC1",
              fontFamily: "Plus Jakarta Sans, sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(20px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 16px rgba(103,232,249,0.06)",
              letterSpacing: "-0.01em",
            }}
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  );
}
