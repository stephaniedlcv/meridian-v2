"use client";

export default function MeridianApp() {
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
      }}>
        Health Intelligence · Phase 2
      </div>
    </div>
  );
}
