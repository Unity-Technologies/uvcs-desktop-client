import type { ReactNode } from 'react';
import { SplitPane } from '../ui/SplitPane';
import { DETAILS_WIDTH, detailsHidden, detailsWidthOf, useDetailsPaneStore, type DetailsWidthLimits } from './detailsPaneStore';

interface ListWithDetailsProps {
  list: ReactNode;
  /** Shown on the right; a DetailsPanel for the selected row, or NoSelection. */
  details: ReactNode;
  /** Whose details these are: each view remembers their width and whether they're hidden (`DetailsToggleButton`). */
  detailsKey: string;
  /** The default and limits of the sized pane, for details that need more room than an object's meta (a file's content). */
  widthLimits?: DetailsWidthLimits;
  /**
   * Which pane keeps its width as the window resizes; the other takes the rest. The details, by default: a list of
   * objects reads better wide. A tree of files sizes itself instead, as its details show the selected file's content.
   */
  sized?: 'details' | 'list';
}

/**
 * A list filling the view with the details panel on the right, as wide as this view's was left; hidden while the view's
 * `DetailsToggleButton` says so, the list then taking the whole view without being mounted again.
 */
export function ListWithDetails({ list, details, detailsKey, widthLimits = DETAILS_WIDTH, sized = 'details' }: ListWithDetailsProps) {
  const width = useDetailsPaneStore((state) => detailsWidthOf(state, detailsKey, widthLimits));
  const hidden = useDetailsPaneStore((state) => detailsHidden(state, detailsKey));
  const setWidth = useDetailsPaneStore((state) => state.setWidth);
  return (
    <SplitPane
      sizedPane={sized === 'details' ? 'second' : 'first'}
      initialSize={widthLimits.initial}
      minSize={widthLimits.min}
      maxSize={widthLimits.max}
      restMinSize={widthLimits.restMin}
      size={width}
      onSizeChange={(size) => setWidth(detailsKey, size)}
      hidden={hidden ? 'second' : undefined}
      first={list}
      second={details}
    />
  );
}
