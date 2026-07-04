import React from 'react';

/**
 * RatingBadge — the colored overall-rating chip on player cards. The fill hue
 * scales with the score (elite emerald → mid amber → low red), mono numerals.
 */
export function RatingBadge({ value, size = 'md', style, ...rest }) {
  const tier =
    value >= 90 ? { bg: 'var(--emerald-tint-20)', fg: 'var(--emerald-400)', ring: 'var(--emerald-tint-30)' } :
    value >= 80 ? { bg: 'rgba(59,130,246,0.14)', fg: '#60a5fa', ring: 'rgba(59,130,246,0.3)' } :
    value >= 70 ? { bg: 'var(--warning-tint)', fg: '#fbbf24', ring: 'rgba(245,158,11,0.3)' } :
                  { bg: 'var(--danger-tint)', fg: '#f87171', ring: 'rgba(239,68,68,0.3)' };
  const sizes = { sm: { w: 34, fs: 14 }, md: { w: 42, fs: 17 }, lg: { w: 52, fs: 22 } };
  const s = sizes[size] || sizes.md;
  return (
    <div
      style={{
        width: s.w, height: s.w, flexShrink: 0,
        borderRadius: 'var(--radius-md)',
        background: tier.bg, border: `1px solid ${tier.ring}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: `var(--weight-black) ${s.fs}px var(--font-mono)`,
        fontVariantNumeric: 'tabular-nums', color: tier.fg,
        ...style,
      }}
      {...rest}
    >
      {value}
    </div>
  );
}
