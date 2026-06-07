'use client'

import type { ReactNode } from 'react'

type FuturisticPanelProps = {
  children: ReactNode
  title?: string
  eyebrow?: string
  accent?: string
  style?: React.CSSProperties
}

export default function FuturisticPanel({
  children,
  title,
  eyebrow,
  accent = '#2DD4BF',
  style,
}: FuturisticPanelProps) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '22px',
        border: `1px solid rgba(103,232,249,0.14)`,
        background:
          'linear-gradient(135deg, rgba(232,248,245,0.075), rgba(6,19,22,0.72))',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 24px 80px rgba(0,0,0,0.28), 0 0 42px ${accent}18`,
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(circle at top right, ${accent}22, transparent 34%), radial-gradient(circle at bottom left, rgba(103,232,249,0.08), transparent 34%)`,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, padding: '20px' }}>
        {(eyebrow || title) && (
          <div style={{ marginBottom: '16px' }}>
            {eyebrow && (
              <p
                style={{
                  margin: '0 0 6px',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(154,203,193,0.72)',
                }}
              >
                {eyebrow}
              </p>
            )}
            {title && (
              <h3
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: '#EAFBF7',
                }}
              >
                {title}
              </h3>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
