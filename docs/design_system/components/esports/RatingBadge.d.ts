import React from 'react';

export interface RatingBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Overall rating 0–99. Hue scales by tier (≥90 emerald, ≥80 blue, ≥70 amber, else red). */
  value: number;
  /** @default 'md' */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Square overall-rating chip with tier-colored fill and mono numerals.
 */
export function RatingBadge(props: RatingBadgeProps): JSX.Element;
