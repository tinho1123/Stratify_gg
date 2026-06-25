import React, { useState } from 'react';
import { Avatar } from '../core/Avatar.jsx';
import { RatingBadge } from './RatingBadge.jsx';
import { Badge } from '../core/Badge.jsx';

/**
 * PlayerListItem — the repeating roster/market row: avatar, name + role meta,
 * a status badge, the rating chip, and a trailing chevron / action slot.
 */
export function PlayerListItem({
  name,
  role,
  meta,
  rating,
  avatar = null,
  status = null,        // 'online' | 'injured' | 'suspended'
  statusLabel = null,
  trailing = null,
  onClick,
  style,
}) {
  const [hover, setHover] = useState(false);
  const statusTone = { online: 'emerald', injured: 'danger', suspended: 'warning' }[status] || 'neutral';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        background: hover ? 'var(--surface-raised)' : 'var(--surface-deep)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background var(--dur-fast) var(--ease-standard)',
        ...style,
      }}
    >
      <Avatar name={name} src={avatar} size={44} status={status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ font: 'var(--weight-bold) var(--text-base) var(--font-sans)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          {statusLabel && <Badge tone={statusTone} size="sm" dot>{statusLabel}</Badge>}
        </div>
        <div style={{ marginTop: 3, font: 'var(--weight-medium) var(--text-xs) var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
          {role}{role && meta ? ' · ' : ''}{meta}
        </div>
      </div>
      {rating != null && <RatingBadge value={rating} />}
      {trailing != null
        ? trailing
        : onClick && <span style={{ color: 'var(--text-ghost)', fontSize: 20, marginLeft: 2 }}>›</span>}
    </div>
  );
}
