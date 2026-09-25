import type { ReactNode } from 'react';
import { SplitPane } from '../ui/SplitPane';

interface ListWithDetailsProps {
  list: ReactNode;
  /** Shown on the right; typically a DetailsPanel for the selected row, or an empty state. */
  details: ReactNode;
}

/** A list filling the view with a resizable details panel on the right. */
export function ListWithDetails({ list, details }: ListWithDetailsProps) {
  return <SplitPane sizedPane="second" initialSize={340} minSize={260} maxSize={640} first={list} second={details} />;
}
