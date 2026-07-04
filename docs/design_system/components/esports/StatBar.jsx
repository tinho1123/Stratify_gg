import React from 'react';

/**
 * StatBar — labeled progress meter for player attributes (Aim, Game Sense,
 * Awareness…). Track over dark, fill in a per-attribute hue, mono value.
 */
export function StatBar({ label, value, max = 100, tone = 'emerald', showValue = true, style }) {
  const tones = {
    emerald: 'var(--emerald-500)',
    blue: 'var(--accent-blue)',
    purple: 'var(--accent-purple)',
    pink: 'var(--accent-pink)',
    warning: 'var(--warning)',
  };
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = tones[tone] || tones.emerald;
  return (
    <div style={{ ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ font: 'var(--weight-semibold) var(--text-xs) var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
        {showValue && (
          <span style={{ font: 'var(--weight-bold) var(--text-sm) var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{value}</span>
        )}
      </div>
      <div style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--surface-control)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: color, transition: 'width var(--dur-slow) var(--ease-standard)' }} />
      </div>
    </div>
  );
}
