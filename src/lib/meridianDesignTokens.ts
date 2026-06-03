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
  page: {
    minHeight: '100vh',
    color: meridianColors.text,
    background:
      'radial-gradient(circle at 50% 0%, rgba(45,212,191,0.08) 0%, rgba(45,212,191,0.025) 28%, transparent 58%), linear-gradient(180deg, #061316 0%, #02090B 100%)',
    padding: '24px 24px 100px',
    fontFamily: meridianFonts.ui,
  } satisfies CSSProperties,

  shell: {
    width: '100%',
    maxWidth: 640,
    margin: '0 auto',
  } satisfies CSSProperties,

  header: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: 26,
  } satisfies CSSProperties,

  eyebrow: {
    margin: '0 0 12px',
    color: meridianColors.textMuted,
    fontSize: 11,
    lineHeight: 1,
    fontWeight: 600,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
  } satisfies CSSProperties,

  title: {
    margin: 0,
    color: meridianColors.text,
    fontFamily: meridianFonts.heading,
    fontSize: 'clamp(26px, 6vw, 34px)',
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: '-0.04em',
  } satisfies CSSProperties,

  subtitle: {
    margin: '8px 0 0',
    maxWidth: 360,
    color: meridianColors.textSoft,
    fontSize: 14,
    lineHeight: 1.65,
  } satisfies CSSProperties,

  actionButton: {
    border: `1px solid ${meridianColors.cardBorderActive}`,
    borderRadius: 14,
    padding: '8px 12px',
    color: meridianColors.teal,
    background:
      'linear-gradient(135deg, rgba(45,212,191,0.12), rgba(103,232,249,0.045))',
    boxShadow:
      '0 12px 32px rgba(45,212,191,0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,
};
