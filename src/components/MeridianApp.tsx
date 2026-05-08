"use client";
import { useRouter } from "next/navigation";

export default function MeridianApp() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#061316",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: "16px",
    }}>
      <div style={{
        fontFamily: "var(--font-fraunces), serif",
        fontSize: "64px",
        fontWeight: 700,
        background: "linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}>
        M
      </div>
      <div style={{
        fontFamily: "var(--font-fraunces), serif",
        fontSize: "28px",
        fontWeight: 700,
        color: "#EAFBF7",
        letterSpacing: "-0.04em",
      }}>
        Meridian
      </div>
      <div style={{
        fontSize: "13px",
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#5F8E85",
        marginBottom: "32px",
      }}>
        Health Intelligence · Phase 2
      </div>
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={() => router.push("/labs/upload")}
          style={{
            padding: "14px 28px",
            background: "linear-gradient(135deg, #2DD4BF 0%, #67E8F9 100%)",
            border: "none",
            borderRadius: "12px",
            color: "#061316",
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Upload Labs
        </button>
        <button
          onClick={() => router.push("/onboarding/welcome")}
          style={{
            padding: "14px 28px",
            background: "rgba(232,248,245,0.055)",
            border: "1px solid rgba(103,232,249,0.13)",
            borderRadius: "12px",
            color: "#9ACBC1",
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}
