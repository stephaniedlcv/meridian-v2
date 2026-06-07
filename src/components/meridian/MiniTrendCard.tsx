'use client'

import StatusPill from './StatusPill'

type MiniTrendCardProps = {
  label: string
  value: string
  delta?: string
  status?: string
  tone?: 'optimal' | 'watch' | 'attention' | 'critical' | 'neutral' | 'cyan'
  accent?: string
  points?: number[]
}

export default function MiniTrendCard({
  label,
  value,
  delta,
  status = 'Stable',
  tone = 'neutral',
  accent = '#2DD4BF',
  points = [18, 13, 15, 9, 11, 7, 10],
}: MiniTrendCardProps) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = Math.max(1, max - min)

  const polyline = points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * 100
      const y = 30 - ((point - min) / range) * 24
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '18px',
        border: '1px solid rgba(103,232,249,0.13)',
        background: 'rgba(232,248,245,0.045)',
        padding: '15px',
        minHeight: '132px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(circle at top right, ${accent}1f, transparent 42%)`,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '11px', color: '#5F8E85', fontWeight: 700 }}>
              {label}
            </p>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '24px',
                color: '#EAFBF7',
                fontWeight: 800,
                letterSpacing: '-0.05em',
              }}
            >
              {value}
            </p>
          </div>
          <StatusPill label={status} tone={tone} />
        </div>

        {delta && (
          <p style={{ margin: '8px 0 0', color: '#9ACBC1', fontSize: '11px', fontWeight: 600 }}>
            {delta}
          </p>
        )}

        <svg
          viewBox="0 0 100 34"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '38px', marginTop: '10px', display: 'block' }}
        >
          <polyline
            points={polyline}
            fill="none"
            stroke={accent}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  )
}
