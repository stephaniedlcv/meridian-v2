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
  // Based on Labs real page wrapper:
  // padding: 44px 20px 120px
  page: {
    minHeight: '100vh',
    backgroundColor: meridianColors.background,
    color: meridianColors.text,
    fontFamily: meridianFonts.ui,
    position: 'relative',
    overflow: 'hidden',
    padding: '44px 20px 120px',
  } satisfies CSSProperties,

  // Based on Labs real content width:
  // maxWidth: 680px
  shell: {
    width: '100%',
    maxWidth: '680px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  } satisfies CSSProperties,

  // Based on Dashboard/Labs header rhythm.
  header: {
    marginBottom: '28px',
  } satisfies CSSProperties,

  // Based on Labs page context label:
  // flex row + dot + uppercase 11px label.
  eyebrowRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    marginBottom: '20px',
  } satisfies CSSProperties,

  eyebrowDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: meridianColors.teal,
    boxShadow: '0 0 6px rgba(45,212,191,0.6)',
    flexShrink: 0,
  } satisfies CSSProperties,

  eyebrow: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: meridianColors.textMuted,
  } satisfies CSSProperties,

  // Based on Labs real title:
  // clamp(26px, 5vw, 32px), lineHeight 1.2, marginBottom 16px.
  title: {
    fontFamily: meridianFonts.heading,
    fontSize: 'clamp(26px, 5vw, 32px)',
    fontWeight: 700,
    color: meridianColors.text,
    margin: '0 0 16px',
    lineHeight: 1.2,
    letterSpacing: '-0.04em',
  } satisfies CSSProperties,

  // Based on Dashboard/Labs body copy:
  // 14px, textSoft, readable lineHeight.
  subtitle: {
    margin: 0,
    maxWidth: '360px',
    color: meridianColors.textSoft,
    fontSize: '14px',
    lineHeight: 1.65,
  } satisfies CSSProperties,

  divider: {
    height: '1px',
    background:
      'linear-gradient(90deg, transparent, rgba(103,232,249,0.12) 40%, rgba(103,232,249,0.08) 60%, transparent)',
    marginTop: '24px',
    marginBottom: '28px',
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
