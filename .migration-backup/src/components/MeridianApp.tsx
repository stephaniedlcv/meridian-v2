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
      if (user) {
        router.push("/dashboard");
        return;
      }
      setChecking(false);
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
        {/* Logo glow container */}
        <div style={{ position: "relative", width: "88px", height: "88px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            boxShadow: "0 0 0 1px rgba(103,232,249,0.18), 0 0 40px rgba(45,212,191,0.22), 0 0 90px rgba(45,212,191,0.08)",
          }} />
          <div style={{
            position: "absolute", inset: "10px", borderRadius: "50%",
            border: "1px solid rgba(103,232,249,0.12)",
            background: "radial-gradient(circle, rgba(45,212,191,0.07) 0%, transparent 70%)",
          }} />
          <div style={{
            fontFamily: "var(--font-fraunces), serif",
            fontSize: "60px",
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

        {/* Logo glow container */}
        <div style={{
          position: "relative",
          width: "96px",
          height: "96px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
        }}>
          {/* Outer glow ring */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            boxShadow: "0 0 0 1px rgba(103,232,249,0.2), 0 0 40px rgba(45,212,191,0.25), 0 0 100px rgba(45,212,191,0.1)",
          }} />
          {/* Inner ring */}
          <div style={{
            position: "absolute", inset: "10px", borderRadius: "50%",
            border: "1px solid rgba(103,232,249,0.14)",
            background: "radial-gradient(circle, rgba(45,212,191,0.09) 0%, transparent 70%)",
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
            onClick={() => router.push("/onboarding/welcome")}
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
            onClick={() => router.push("/onboarding/welcome")}
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
