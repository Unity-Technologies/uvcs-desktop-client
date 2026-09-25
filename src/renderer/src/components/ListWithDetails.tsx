import type { ReactNode } from 'react';
import { SplitPane } from '../ui/SplitPane';
import { DETAILS_WIDTH, useDetailsWidthStore } from './detailsWidthStore';

interface ListWithDetailsProps {
  list: ReactNode;
  /** Shown on the right; a DetailsPanel for the selected row, or NoSelection. */
  details: ReactNode;
  /** Hides the details and the splitter, keeping the list mounted. */
  hideDetails?: boolean;
}

/** A list filling the view with the details panel on the right, as wide as in every other view. */
export function ListWithDetails({ list, details, hideDetails = false }: ListWithDetailsProps) {
  const { width, setWidth } = useDetailsWidthStore();
  return (
    <SplitPane
      sizedPane="second"
      initialSize={DETAILS_WIDTH.initial}
      minSize={DETAILS_WIDTH.min}
      maxSize={DETAILS_WIDTH.max}
      size={width}
      onSizeChange={setWidth}
      hideSized={hideDetails}
      first={list}
      second={details}
    />
  );
}
