import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Visual style. Primary call-to-action button. Heavy uppercase label, emerald fill,
 * TouchableOpacity-style press feedback.
 * @startingPoint section="Core" subtitle="Primary CTA with variants & sizes" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. `primary` is emerald-on-black. @default 'primary' */
  variant?: ButtonVariant;
  /** @default 'md' */
  size?: ButtonSize;
  /** Stretch to container width. @default false */
  fullWidth?: boolean;
  /** Show spinner and block clicks. @default false */
  loading?: boolean;
  disabled?: boolean;
  /** Node rendered before the label (e.g. an emoji or icon). */
  iconLeft?: React.ReactNode;
  /** Node rendered after the label. */
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Primary call-to-action button.
 */
export function Button(props: ButtonProps): JSX.Element;
