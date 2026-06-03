import type { ReactNode } from 'react';
import { meridianPageStyles } from '@/lib/meridianDesignTokens';

type MeridianPageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  showDivider?: boolean;
};

export function MeridianPageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  showDivider = true,
}: MeridianPageHeaderProps) {
  return (
    <header style={meridianPageStyles.header}>
      <div style={meridianPageStyles.eyebrowRow}>
        <div style={meridianPageStyles.eyebrowDot} />
        <span style={meridianPageStyles.eyebrow}>{eyebrow}</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={meridianPageStyles.title}>{title}</h1>
          {subtitle ? <p style={meridianPageStyles.subtitle}>{subtitle}</p> : null}
        </div>

        {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
      </div>

      {showDivider ? <div style={meridianPageStyles.divider} /> : null}
    </header>
  );
}
