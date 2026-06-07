'use client'

import MetricOrb from './MetricOrb'

export type SignalRailItem = {
  label: string
  value?: string
  sublabel?: string
  accent?: string
}

export default function SignalRail({ items }: { items: SignalRailItem[] }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '2px',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            minWidth: '190px',
            padding: '13px 14px',
            borderRadius: '18px',
            background: 'rgba(6,19,22,0.42)',
            border: '1px solid rgba(103,232,249,0.11)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <MetricOrb
            label={item.label}
            value={item.value}
            sublabel={item.sublabel}
            accent={item.accent}
          />
        </div>
      ))}
    </div>
  )
}
