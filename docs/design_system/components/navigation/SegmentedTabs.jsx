import React, { useState } from 'react';

/**
 * SegmentedTabs — the pill segmented control used to switch views (Visão Geral
 * / Elenco / Estatísticas). Active segment is an emerald-tinted chip.
 */
export function SegmentedTabs({ tabs = [], value, defaultValue, onChange, fullWidth = true, style }) {
  const [internal, setInternal] = useState(defaultValue ?? (tabs[0] && (tabs[0].id ?? tabs[0])));
  const active = value !== undefined ? value : internal;

  const select = (id) => {
    if (value === undefined) setInternal(id);
    onChange && onChange(id);
  };

  return (
    <div
      style={{
        display: 'flex', gap: 4, padding: 4,
        background: 'var(--surface-deep)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-pill)',
        ...style,
      }}
    >
      {tabs.map((t) => {
        const id = t.id ?? t;
        const label = t.label ?? t;
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            style={{
              flex: fullWidth ? 1 : 'initial',
              height: 34, padding: '0 16px',
              borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
              background: isActive ? 'var(--emerald-tint-12)' : 'transparent',
              color: isActive ? 'var(--emerald-400)' : 'var(--text-muted)',
              font: `${isActive ? 'var(--weight-bold)' : 'var(--weight-semibold)'} var(--text-sm) var(--font-sans)`,
              letterSpacing: '0.02em',
              boxShadow: isActive ? 'inset 0 0 0 1px var(--emerald-tint-30)' : 'none',
              transition: 'background var(--dur-fast), color var(--dur-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
