"use client";

import { motion } from "framer-motion";

export default function MeridianApp() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(45,212,191,0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(103,232,249,0.12), transparent 30%), #061316",
        color: "#EAFBF7",
        padding: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        style={{
          width: "100%",
          maxWidth: "920px",
          border: "1px solid rgba(103,232,249,0.13)",
          background: "rgba(232,248,245,0.055)",
          backdropFilter: "blur(24px)",
          borderRadius: "32px",
          padding: "48px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)"
        }}
      >
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "18px",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(135deg, #2DD4BF, #67E8F9)",
            color: "#061316",
            fontFamily: "var(--font-fraunces)",
            fontSize: "34px",
            fontWeight: 700,
            marginBottom: "28px"
          }}
        >
          M
        </div>

        <p
          style={{
            margin: "0 0 12px",
            color: "#9ACBC1",
            fontSize: "14px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700
          }}
        >
          Meridian Phase 2
        </p>

        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-fraunces)",
            fontSize: "clamp(48px, 8vw, 88px)",
            lineHeight: 0.92,
            letterSpacing: "-0.055em"
          }}
        >
          Understand your body.
          <br />
          Stop guessing.
        </h1>

        <p
          style={{
            marginTop: "28px",
            maxWidth: "640px",
            color: "#9ACBC1",
            fontSize: "18px",
            lineHeight: 1.7
          }}
        >
          Meridian connects labs, wearables, and daily context into one clear
          biological priority.
        </p>

        <div
          style={{
            marginTop: "40px",
            display: "flex",
            gap: "14px",
            flexWrap: "wrap"
          }}
        >
          {["Next.js 14", "TypeScript", "Vercel Ready"].map((item) => (
            <div
              key={item}
              style={{
                border: "1px solid rgba(103,232,249,0.18)",
                background: "rgba(232,248,245,0.055)",
                color: "#EAFBF7",
                borderRadius: "999px",
                padding: "12px 18px",
                fontSize: "14px",
                fontWeight: 700
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </motion.section>
    </main>
  );
}
