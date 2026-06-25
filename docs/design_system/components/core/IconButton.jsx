import React, { useState } from 'react';

/**
 * Round icon button — the circular control used for back (‹), bell (🔔),
 * and profile actions in screen headers. 36px dark chip with subtle border.
 */
export function IconButton({
  children,
  size = 36,
  variant = 'control',
  badge = null,
  onClick,
  ariaLabel,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const variants = {
    control: { bg: 'var(--surface-control)', border: 'var(--border-strong)', color: 'var(--text-primary)' },
    accent: { bg: 'var(--emerald-500)', border: 'transparent', color: '#000' },
    ghost: { bg: 'transparent', border: 'transparent', color: 'var(--text-secondary)' },
  };
  const v = variants[variant] || variants.control;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        position: 'relative',
        width: size, height: size, flexShrink: 0,
        borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: v.bg, border: `1px solid ${v.border}`, color: v.color,
        fontSize: Math.round(size * 0.44), lineHeight: 1,
        cursor: 'pointer',
        filter: hover ? 'brightness(1.15)' : 'none',
        transform: press ? 'scale(0.92)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-standard), filter var(--dur-fast)',
        ...style,
      }}
      {...rest}
    >
      {children}
      {badge != null && (
        <span
          style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 16, height: 16, padding: '0 3px',
            borderRadius: 8, background: 'var(--danger)', color: '#fff',
            font: 'var(--weight-extrabold) 9px var(--font-sans)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {typeof badge === 'number' && badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}
