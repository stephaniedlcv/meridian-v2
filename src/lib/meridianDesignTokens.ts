import type { CSSProperties } from 'react';

export const meridianColors = {
  background: '#061316',
  backgroundDeep: '#02090B',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  cardBorderActive: 'rgba(45,212,191,0.34)',
  recovery: 'rgba(45,212,191,0.07)',
  recoveryBorder: 'rgba(45,212,191,0.3)',
  alert: 'rgba(248,113,113,0.07)',
  alertBorder: 'rgba(248,113,113,0.3)',
  optimal: 'rgba(74,222,128,0.07)',
  optimalBorder: 'rgba(74,222,128,0.3)',
  error: '#EF4444',
};

export const meridianFonts = {
  heading: '"Fraunces", serif',
  ui: '"Plus Jakarta Sans", sans-serif',
};

export const meridianPageStyles = {
  // Premium app page foundation.
  // Mobile keeps the same compact rhythm; desktop gains wider editorial spacing.
  page: {
    minHeight: '100vh',
    backgroundColor: meridianColors.background,
    color: meridianColors.text,
    fontFamily: meridianFonts.ui,
    position: 'relative',
    overflow: 'hidden',
    padding: 'clamp(44px, 5vw, 64px) clamp(20px, 4vw, 48px) 120px',
  } satisfies CSSProperties,

  // Premium desktop canvas.
  // This replaces the old mobile-first 680px shell while staying safe on small screens.
  shell: {
    width: '100%',
    maxWidth: '1120px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  } satisfies CSSProperties,

  header: {
    marginBottom: '34px',
  } satisfies CSSProperties,

  eyebrowRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '18px',
  } satisfies CSSProperties,

  eyebrowDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: meridianColors.teal,
    boxShadow: '0 0 8px rgba(45,212,191,0.72)',
    flexShrink: 0,
  } satisfies CSSProperties,

  eyebrow: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: meridianColors.textMuted,
  } satisfies CSSProperties,

  title: {
    fontFamily: meridianFonts.heading,
    fontSize: 'clamp(32px, 4vw, 52px)',
    fontWeight: 700,
    color: meridianColors.text,
    margin: '0 0 14px',
    lineHeight: 1.04,
    letterSpacing: '-0.055em',
    textShadow: '0 18px 54px rgba(103,232,249,0.10)',
  } satisfies CSSProperties,

  subtitle: {
    margin: 0,
    maxWidth: '620px',
    color: meridianColors.textSoft,
    fontSize: '15px',
    lineHeight: 1.7,
  } satisfies CSSProperties,

  divider: {
    height: '1px',
    background:
      'linear-gradient(90deg, rgba(45,212,191,0.0), rgba(103,232,249,0.18) 34%, rgba(45,212,191,0.10) 70%, rgba(103,232,249,0.0))',
    marginTop: '28px',
    marginBottom: '34px',
  } satisfies CSSProperties,

  actionButton: {
    border: `1px solid ${meridianColors.cardBorderActive}`,
    borderRadius: 16,
    padding: '10px 14px',
    color: meridianColors.teal,
    background:
      'linear-gradient(135deg, rgba(45,212,191,0.14), rgba(103,232,249,0.055))',
    boxShadow:
      '0 14px 40px rgba(45,212,191,0.08), inset 0 1px 0 rgba(255,255,255,0.07)',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,
};
