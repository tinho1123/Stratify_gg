import React from 'react';

/**
 * Dark surface container with a 1px hairline border — the base of every block.
 * @startingPoint section="Core" subtitle="Surface card with optional glow" viewport="700x180"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Apply the emerald glow ring + soft bloom for highlighted/active cards. @default false */
  glow?: boolean;
  /** Include default 16px padding. Turn off for edge-to-edge list cards. @default true */
  padded?: boolean;
  /** Background surface level. @default 'deep' */
  surface?: 'deep' | 'raised' | 'control';
}

/** Dark surface container with a 1px hairline border — the base of every block. */
export function Card(props: CardProps): JSX.Element;

export interface SectionHeaderProps {
  /** Eyebrow label (rendered uppercase, wide tracking). */
  title: string;
  /** Optional right-aligned action text, e.g. "Ver todos". */
  action?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}

/** Eyebrow + optional action row, used at the top of a card section. */
export function SectionHeader(props: SectionHeaderProps): JSX.Element;
