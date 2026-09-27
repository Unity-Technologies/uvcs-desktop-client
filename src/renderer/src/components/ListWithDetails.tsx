import type { ReactNode } from 'react';
import { SplitPane } from '../ui/SplitPane';
import { DETAILS_WIDTH, detailsWidthOf, useDetailsWidthStore, type DetailsWidthLimits } from './detailsWidthStore';

interface ListWithDetailsProps {
  list: ReactNode;
  /** Shown on the right; a DetailsPanel for the selected row, or NoSelection. */
  details: ReactNode;
  /** Whose details width this is: each view remembers its own. */
  widthKey: string;
  /** The details' default and limits, for details that need more room than an object's meta (a file's content). */
  widthLimits?: DetailsWidthLimits;
  /** Hides the details and the splitter, keeping the list mounted. */
  hideDetails?: boolean;
}

/** A list filling the view with the details panel on the right, as wide as this view's was left. */
export function ListWithDetails({ list, details, widthKey, widthLimits = DETAILS_WIDTH, hideDetails = false }: ListWithDetailsProps) {
  const width = useDetailsWidthStore((state) => detailsWidthOf(state, widthKey, widthLimits));
  const setWidth = useDetailsWidthStore((state) => state.setWidth);
  return (
    <SplitPane
      sizedPane="second"
      initialSize={widthLimits.initial}
      minSize={widthLimits.min}
      maxSize={widthLimits.max}
      size={width}
      onSizeChange={(size) => setWidth(widthKey, size)}
      hideSized={hideDetails}
      first={list}
      second={details}
    />
  );
}
