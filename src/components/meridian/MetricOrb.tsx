'use client'

type MetricOrbProps = {
  label: string
  value?: string
  accent?: string
  sublabel?: string
}

export default function MetricOrb({
  label,
  value = '—',
  accent = '#2DD4BF',
  sublabel,
}: MetricOrbProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
      <div
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: '#EAFBF7',
          fontSize: '13px',
          fontWeight: 800,
          background: `radial-gradient(circle at 35% 25%, rgba(255,255,255,0.22), transparent 22%), radial-gradient(circle, ${accent}44, rgba(6,19,22,0.8) 64%)`,
          border: `1px solid ${accent}55`,
          boxShadow: `0 0 28px ${accent}30`,
        }}
      >
        {value}
      </div>

      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 700,
            color: '#EAFBF7',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </p>
        {sublabel && (
          <p
            style={{
              margin: '3px 0 0',
              fontSize: '11px',
              color: '#5F8E85',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sublabel}
          </p>
        )}
      </div>
    </div>
  )
}
