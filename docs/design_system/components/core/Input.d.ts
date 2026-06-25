import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  /** Field label shown above the control. */
  label?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  /** @default 'text' */
  type?: string;
  /** Leading icon node (glyph or SVG). */
  iconLeft?: React.ReactNode;
  /** Error message; turns the outline red. */
  error?: string | null;
  disabled?: boolean;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

/**
 * Dark text field with emerald focus ring. Used for login, search and forms.
 */
export function Input(props: InputProps): JSX.Element;
