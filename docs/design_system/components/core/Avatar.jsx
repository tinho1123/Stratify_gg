import React from 'react';

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg,#10B981,#059669)',
  'linear-gradient(135deg,#6366F1,#4338CA)',
  'linear-gradient(135deg,#EC4899,#BE185D)',
  'linear-gradient(135deg,#F59E0B,#B45309)',
  'linear-gradient(135deg,#3B82F6,#1D4ED8)',
];

function hashIndex(str, n) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % n;
}

/**
 * Avatar — player / team image with initials fallback on a colored gradient.
 * Optional status ring (online / injured) and selected emerald ring.
 */
export function Avatar({
  src = null,
  name = '',
  size = 'md',
  status = null,      // 'online' | 'injured' | 'suspended' | null
  selected = false,
  style,
  ...rest
}) {
  const sizes = { sm: 28, md: 36, lg: 56, xl: 72 };
  const px = typeof size === 'number' ? size : (sizes[size] || sizes.md);
  const initials = (name || '')
    .split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

  const statusColors = { online: 'var(--emerald-500)', injured: 'var(--danger)', suspended: 'var(--warning)' };

  return (
    <div style={{ position: 'relative', width: px, height: px, flexShrink: 0, ...style }} {...rest}>
      <div
        style={{
          width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
          background: src ? '#000' : FALLBACK_GRADIENTS[hashIndex(name, FALLBACK_GRADIENTS.length)],
          border: selected ? '2px solid var(--emerald-500)' : '1px solid var(--border-strong)',
          boxShadow: selected ? 'var(--glow-emerald-soft)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {src
          ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ font: `var(--weight-extrabold) ${Math.round(px * 0.4)}px var(--font-sans)`, color: '#fff' }}>{initials}</span>}
      </div>
      {status && (
        <span
          style={{
            position: 'absolute', right: -1, bottom: -1,
            width: Math.max(9, px * 0.28), height: Math.max(9, px * 0.28),
            borderRadius: '50%', background: statusColors[status] || 'var(--text-muted)',
            border: '2px solid var(--surface-app)',
          }}
        />
      )}
    </div>
  );
}
