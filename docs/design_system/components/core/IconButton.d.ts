import React from 'react';

export type IconButtonVariant = 'control' | 'accent' | 'ghost';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Icon content — emoji, unicode glyph (‹ › ✕), or an SVG node. */
  children?: React.ReactNode;
  /** Diameter in px. @default 36 */
  size?: number;
  /** @default 'control' */
  variant?: IconButtonVariant;
  /** Red count badge in the top-right corner (numbers >9 render "9+"). */
  badge?: number | string | null;
  ariaLabel?: string;
}

/**
 * Circular icon button used in screen headers (back, notifications, profile).
 */
export function IconButton(props: IconButtonProps): JSX.Element;
