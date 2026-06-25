import React from 'react';

/**
 * Surface card — the dark, hairline-bordered container that holds nearly
 * every block in the app (team list, performance, sheets sections).
 * Optional emerald glow ring for "active / highlighted" cards.
 */
export function Card({
  children,
  glow = false,
  padded = true,
  surface = 'deep',
  style,
  ...rest
}) {
  const surfaces = {
    deep: 'var(--surface-deep)',
    raised: 'var(--surface-raised)',
    control: 'var(--surface-control)',
  };
  return (
    <div
      style={{
        background: surfaces[surface] || surfaces.deep,
        border: `1px solid ${glow ? 'var(--emerald-tint-30)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-2xl)',
        padding: padded ? 'var(--space-6)' : 0,
        boxShadow: glow ? 'var(--glow-emerald-soft)' : 'none',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Header row inside a section: eyebrow label on the left, optional action link on the right. */
export function SectionHeader({ title, action, onAction, style }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-4)', ...style,
      }}
    >
      <span
        style={{
          font: 'var(--weight-extrabold) var(--text-xs) var(--font-sans)',
          letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {title}
      </span>
      {action && (
        <button
          type="button"
          onClick={onAction}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            font: 'var(--weight-semibold) var(--text-sm) var(--font-sans)',
            color: 'var(--emerald-500)',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
