import React, { useState } from 'react';

/**
 * Text input — the dark field used across login, search and forms. Resting
 * outline brightens to emerald on focus. Optional leading icon and label.
 */
export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  iconLeft = null,
  error = null,
  disabled = false,
  style,
  inputStyle,
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  const borderColor = error ? 'var(--danger)' : (focus ? 'var(--emerald-500)' : 'var(--border-input)');

  return (
    <label style={{ display: 'block', ...style }}>
      {label && (
        <span
          style={{
            display: 'block', marginBottom: 8,
            font: 'var(--weight-semibold) var(--text-sm) var(--font-sans)',
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          height: 'var(--control-h)', padding: '0 14px',
          background: 'var(--surface-deep)',
          border: `1.5px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: focus && !error ? 'var(--glow-emerald-soft)' : 'none',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base)',
        }}
      >
        {iconLeft && <span style={{ color: 'var(--text-muted)', fontSize: 16, display: 'flex' }}>{iconLeft}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, height: '100%',
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)',
            font: 'var(--weight-medium) var(--text-base) var(--font-sans)',
            ...inputStyle,
          }}
          {...rest}
        />
      </div>
      {error && (
        <span style={{ display: 'block', marginTop: 6, font: 'var(--weight-medium) var(--text-xs) var(--font-sans)', color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </label>
  );
}
