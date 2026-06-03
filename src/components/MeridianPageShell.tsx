import type { CSSProperties, ReactNode } from 'react';
import { meridianPageStyles } from '@/lib/meridianDesignTokens';

type MeridianPageShellProps = {
  children: ReactNode;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
};

export function MeridianPageShell({
  children,
  style,
  contentStyle,
}: MeridianPageShellProps) {
  return (
    <main style={{ ...meridianPageStyles.page, ...style }}>
      <div style={{ ...meridianPageStyles.shell, ...contentStyle }}>
        {children}
      </div>
    </main>
  );
}
