import React from 'react';

/**
 * Compact dashboard metric tile (value + label + optional delta).
 * @startingPoint section="Esports" subtitle="Dashboard KPI metric tile" viewport="340x150"
 */
export interface KpiTileProps {
  /** Leading glyph / emoji / SVG in a tinted chip. */
  icon?: React.ReactNode;
  /** Big value (string or number) in mono. */
  value: React.ReactNode;
  /** Uppercase caption. */
  label: string;
  /** Accent hue for the icon chip + delta. @default 'emerald' */
  tone?: 'emerald' | 'danger' | 'warning' | 'info' | 'pink';
  /** Trend delta, e.g. "+12%" or "-3". Sign drives arrow + color. */
  delta?: string | null;
  style?: React.CSSProperties;
}

/** Compact dashboard metric tile (value + label + optional delta). */
export function KpiTile(props: KpiTileProps): JSX.Element;
