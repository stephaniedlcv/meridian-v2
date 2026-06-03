import type { ReactNode } from 'react';
import { meridianPageStyles } from '@/lib/meridianDesignTokens';

type MeridianPageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function MeridianPageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: MeridianPageHeaderProps) {
  return (
    <header style={meridianPageStyles.header}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 18,
        }}
      >
        <div>
          <p style={meridianPageStyles.eyebrow}>{eyebrow}</p>
          <h1 style={meridianPageStyles.title}>{title}</h1>
          {subtitle ? <p style={meridianPageStyles.subtitle}>{subtitle}</p> : null}
        </div>

        {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
      </div>
    </header>
  );
}
