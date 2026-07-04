import React from 'react';

/**
 * Roster / market row: avatar, name + role, status badge, rating chip, action.
 * @startingPoint section="Esports" subtitle="Player roster row with rating" viewport="700x90"
 */
export interface PlayerListItemProps {
  name: string;
  /** Primary role, e.g. "AWPer", "IGL". */
  role?: string;
  /** Secondary meta after the role, e.g. team or price. */
  meta?: string;
  /** Overall rating chip (0–99). Omit to hide. */
  rating?: number;
  avatar?: string | null;
  /** Drives the avatar status dot. */
  status?: 'online' | 'injured' | 'suspended' | null;
  /** Text for the status badge next to the name (e.g. "Lesionado"). */
  statusLabel?: string | null;
  /** Custom trailing node (button/price). Defaults to a chevron when clickable. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** Roster / market row: avatar, name + role, status badge, rating chip, action. */
export function PlayerListItem(props: PlayerListItemProps): JSX.Element;
