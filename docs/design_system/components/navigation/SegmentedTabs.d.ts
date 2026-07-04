import React from 'react';

export interface SegmentedTab {
  id: string;
  label: string;
}

export interface SegmentedTabsProps {
  /** Tabs as `{id,label}` objects or plain strings. */
  tabs: Array<SegmentedTab | string>;
  /** Controlled active id. */
  value?: string;
  /** Uncontrolled initial id. */
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Stretch segments to equal width. @default true */
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

/**
 * Pill segmented control for switching views within a screen.
 */
export function SegmentedTabs(props: SegmentedTabsProps): JSX.Element;
