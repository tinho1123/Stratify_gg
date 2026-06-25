import React from 'react';

export interface StatBarProps {
  /** Attribute name, rendered as an uppercase micro-label. */
  label: string;
  value: number;
  /** @default 100 */
  max?: number;
  /** Fill hue. @default 'emerald' */
  tone?: 'emerald' | 'blue' | 'purple' | 'pink' | 'warning';
  /** Show the numeric value on the right. @default true */
  showValue?: boolean;
  style?: React.CSSProperties;
}

/**
 * Labeled attribute meter used on player detail (Aim, Game Sense, Awareness).
 */
export function StatBar(props: StatBarProps): JSX.Element;
