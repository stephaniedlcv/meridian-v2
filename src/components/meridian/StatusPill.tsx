'use client'

type StatusTone = 'optimal' | 'watch' | 'attention' | 'critical' | 'neutral' | 'cyan'

const toneMap: Record<StatusTone, { color: string; bg: string; border: string }> = {
  optimal: {
    color: '#4ADE80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.24)',
  },
  watch: {
    color: '#FCD34D',
    bg: 'rgba(252,211,77,0.08)',
    border: 'rgba(252,211,77,0.24)',
  },
  attention: {
    color: '#FB923C',
    bg: 'rgba(251,146,60,0.08)',
    border: 'rgba(251,146,60,0.24)',
  },
  critical: {
    color: '#F87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.24)',
  },
  cyan: {
    color: '#67E8F9',
    bg: 'rgba(103,232,249,0.08)',
    border: 'rgba(103,232,249,0.22)',
  },
  neutral: {
    color: '#9ACBC1',
    bg: 'rgba(232,248,245,0.055)',
    border: 'rgba(103,232,249,0.13)',
  },
}

export default function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: StatusTone
}) {
  const styles = toneMap[tone]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        width: 'fit-content',
        padding: '5px 10px',
        borderRadius: '999px',
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.color,
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '999px',
          background: styles.color,
          boxShadow: `0 0 12px ${styles.color}99`,
        }}
      />
      {label}
    </span>
  )
}
