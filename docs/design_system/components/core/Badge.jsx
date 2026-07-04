import React from 'react';

/**
 * Badge / status pill. Compact label with a tinted fill matching a semantic
 * hue — used for player status (Online, Lesionado), roles, and counts.
 */
export function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  dot = false,
  size = 'md',
  style,
  ...rest
}) {
  const tones = {
    neutral: { fg: 'var(--text-secondary)', solidBg: 'var(--surface-control)', softBg: 'var(--surface-control)', ring: 'var(--border-strong)' },
    emerald: { fg: 'var(--emerald-400)', solidBg: 'var(--emerald-500)', softBg: 'var(--emerald-tint-12)', ring: 'var(--emerald-tint-30)' },
    danger: { fg: '#f87171', solidBg: 'var(--danger)', softBg: 'var(--danger-tint)', ring: 'rgba(239,68,68,0.3)' },
    warning: { fg: '#fbbf24', solidBg: 'var(--warning)', softBg: 'var(--warning-tint)', ring: 'rgba(245,158,11,0.3)' },
    info: { fg: '#818cf8', solidBg: 'var(--info)', softBg: 'var(--info-tint)', ring: 'rgba(99,102,241,0.3)' },
    pink: { fg: '#f472b6', solidBg: 'var(--accent-pink)', softBg: 'var(--pink-tint)', ring: 'rgba(236,72,153,0.3)' },
  };
  const t = tones[tone] || tones.neutral;
  const sizes = {
    sm: { fs: 9, px: 7, h: 18 },
    md: { fs: 10.5, px: 9, h: 22 },
    lg: { fs: 12, px: 12, h: 26 },
  };
  const s = sizes[size] || sizes.md;
  const solid = variant === 'solid';

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: s.h, padding: `0 ${s.px}px`,
        borderRadius: 'var(--radius-pill)',
        background: solid ? t.solidBg : t.softBg,
        border: `1px solid ${solid ? 'transparent' : t.ring}`,
        color: solid ? (tone === 'emerald' ? '#000' : '#fff') : t.fg,
        font: `var(--weight-bold) ${s.fs}px var(--font-sans)`,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        whiteSpace: 'nowrap', lineHeight: 1,
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: solid ? 'currentColor' : t.fg, flexShrink: 0 }} />
      )}
      {children}
    </span>
  );
}
