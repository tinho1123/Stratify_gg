import React, { useState } from 'react';

/**
 * Stratify Button — the app's primary call-to-action.
 * Emerald fill with black label by default; heavy uppercase tracking; press
 * mimics React Native's TouchableOpacity (dip in opacity + slight scale).
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const sizes = {
    sm: { h: 38, px: 16, fs: 12, ls: '0.06em' },
    md: { h: 48, px: 22, fs: 13, ls: '0.08em' },
    lg: { h: 54, px: 28, fs: 14, ls: '0.10em' },
  };
  const s = sizes[size] || sizes.md;

  const variants = {
    primary: { bg: 'var(--emerald-500)', bgHover: 'var(--emerald-400)', color: '#000', border: 'transparent' },
    secondary: { bg: 'var(--surface-control)', bgHover: 'var(--surface-hover)', color: 'var(--text-secondary)', border: 'var(--border-strong)' },
    ghost: { bg: 'transparent', bgHover: 'var(--surface-control)', color: 'var(--text-secondary)', border: 'transparent' },
    danger: { bg: 'var(--danger)', bgHover: '#f05252', color: '#fff', border: 'transparent' },
    outline: { bg: 'transparent', bgHover: 'var(--emerald-tint-12)', color: 'var(--emerald-500)', border: 'var(--emerald-tint-30)' },
  };
  const v = variants[variant] || variants.primary;
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      disabled={isDisabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: fullWidth ? '100%' : 'auto',
        height: s.h, padding: `0 ${s.px}px`,
        font: `var(--weight-black) ${s.fs}px var(--font-sans)`,
        letterSpacing: s.ls, textTransform: 'uppercase',
        color: v.color,
        background: hover && !isDisabled ? v.bgHover : v.bg,
        border: `1px solid ${v.border}`,
        borderRadius: 'var(--radius-md)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : (press ? 0.85 : 1),
        transform: press && !isDisabled ? 'scale(0.97)' : 'none',
        transition: 'background var(--dur-fast) var(--ease-standard), opacity var(--dur-fast), transform var(--dur-fast)',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {loading && <Spinner color={v.color} />}
      {!loading && iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
}

function Spinner({ color }) {
  return (
    <span
      style={{
        width: 14, height: 14, borderRadius: '50%',
        border: `2px solid ${color === '#000' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'}`,
        borderTopColor: color, display: 'inline-block',
        animation: 'stratify-spin 0.7s linear infinite',
      }}
    />
  );
}
