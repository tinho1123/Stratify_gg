import React from 'react';

export type AvatarStatus = 'online' | 'injured' | 'suspended' | null;

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image URL. Falls back to initials on a deterministic gradient when absent. */
  src?: string | null;
  /** Full name — drives initials and the fallback gradient color. */
  name?: string;
  /** Preset size or explicit px. @default 'md' */
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Status dot in the corner. @default null */
  status?: AvatarStatus;
  /** Emerald selection ring. @default false */
  selected?: boolean;
}

/**
 * Player / team avatar with initials fallback and status dot.
 */
export function Avatar(props: AvatarProps): JSX.Element;
