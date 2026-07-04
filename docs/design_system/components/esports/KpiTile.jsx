import React from 'react';

/**
 * KpiTile — compact metric tile from the dashboard grid. Icon chip, big mono
 * value, small label, optional delta in green/red.
 */
export function KpiTile({ icon, value, label, tone = 'emerald', delta = null, style }) {
  const tones = {
    emerald: { fg: 'var(--emerald-400)', bg: 'var(--emerald-tint-12)' },
    danger: { fg: '#f87171', bg: 'var(--danger-tint)' },
    warning: { fg: '#fbbf24', bg: 'var(--warning-tint)' },
    info: { fg: '#818cf8', bg: 'var(--info-tint)' },
    pink: { fg: '#f472b6', bg: 'var(--pink-tint)' },
  };
  const t = tones[tone] || tones.emerald;
  const deltaUp = delta != null && !String(delta).trim().startsWith('-');

  return (
    <div
      style={{
        background: 'var(--surface-deep)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-2xl)', padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {icon != null && (
          <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: t.bg, color: t.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{icon}</span>
        )}
        {delta != null && (
          <span style={{ font: 'var(--weight-bold) var(--text-xs) var(--font-mono)', color: deltaUp ? 'var(--emerald-500)' : 'var(--danger)' }}>
            {deltaUp ? '▲' : '▼'} {String(delta).replace('-', '')}
          </span>
        )}
      </div>
      <div>
        <div style={{ font: 'var(--weight-black) var(--text-2xl) var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ marginTop: 5, font: 'var(--weight-semibold) var(--text-xs) var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}
