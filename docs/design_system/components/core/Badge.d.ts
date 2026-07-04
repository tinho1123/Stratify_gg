import React from 'react';

export type BadgeTone = 'neutral' | 'emerald' | 'danger' | 'warning' | 'info' | 'pink';
export type BadgeVariant = 'soft' | 'solid';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  /** Semantic hue. @default 'neutral' */
  tone?: BadgeTone;
  /** `soft` = tinted fill + ring; `solid` = full color. @default 'soft' */
  variant?: BadgeVariant;
  /** Leading status dot. @default false */
  dot?: boolean;
  /** @default 'md' */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Status pill / count badge. Tinted fill in a semantic hue, uppercase label.
 */
export function Badge(props: BadgeProps): JSX.Element;
