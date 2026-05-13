'use client'

import { motion } from 'framer-motion'
import NavBar from '@/components/NavBar'

const colors = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
}

const fonts = {
  heading: 'var(--font-fraunces), serif',
  ui: 'Plus Jakarta Sans, sans-serif',
}

export default function ProtocolPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: colors.background,
      color: colors.text,
      fontFamily: fonts.ui,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, rgba(45,212,191,0.13) 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, rgba(103,232,249,0.11) 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '64px 20px 120px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: colors.teal,
              padding: '4px 12px', borderRadius: '20px',
              border: '1px solid rgba(45,212,191,0.28)',
              background: 'rgba(45,212,191,0.07)',
            }}>
              Calibrating
            </span>
          </div>
          <h1 style={{
            fontFamily: fonts.heading,
            fontSize: 'clamp(28px, 6vw, 36px)',
            fontWeight: 700,
            color: colors.text,
            marginBottom: '12px',
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
          }}>
            Protocol
          </h1>
          <p style={{ fontSize: '16px', color: colors.textSoft, lineHeight: 1.7, marginBottom: '8px', maxWidth: '480px' }}>
            Your action layer is being calibrated.
          </p>
          <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: 1.75, maxWidth: '480px' }}>
            As Meridian gathers more signals — labs, patterns, and context — it will surface structured next steps tailored to your biology. Protocol turns insight into action, without noise.
          </p>
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(103,232,249,0.12) 40%, rgba(103,232,249,0.08) 60%, transparent)', margin: '32px 0' }} />
        </motion.div>

        {/* Placeholder cards */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Lab Insights', desc: 'Biomarker-driven recommendations will appear once your labs are processed.' },
              { label: 'Daily Actions', desc: 'Prioritised, evidence-based steps matched to your current health signals.' },
              { label: 'Progress Tracking', desc: 'Meridian will track protocol adherence and adjust over time.' },
            ].map((item) => (
              <div key={item.label} style={{
                padding: '20px 22px',
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: '16px',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                opacity: 0.65,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>{item.label}</span>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: colors.textMuted, padding: '3px 9px', borderRadius: '10px',
                    border: `1px solid ${colors.cardBorder}`, background: 'rgba(232,248,245,0.04)',
                  }}>
                    Coming soon
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      <NavBar />
    </div>
  )
}
