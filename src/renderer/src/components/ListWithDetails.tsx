import type { ReactNode } from 'react';
import { SplitPane } from '../ui/SplitPane';
import { DETAILS_WIDTH, detailsHidden, detailsWidthOf, useDetailsPaneStore, type DetailsWidthLimits } from './detailsPaneStore';
import { useDiffExpanded } from './diffExpansionStore';
import { ExpandableDiffContext } from './expandableDiffContext';

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
  /**
   * The details show a file's diff, which can expand to the whole window (Expand Diff): the list stays mounted out of
   * sight meanwhile. A tree of files' details do.
   */
  diffInDetails?: boolean;
}

/**
 * A list filling the view with the details panel on the right, as wide as this view's was left; hidden while the view's
 * `DetailsToggleButton` says so, the list then taking the whole view without being mounted again.
 */
export function ListWithDetails({ list, details, detailsKey, widthLimits = DETAILS_WIDTH, sized = 'details', diffInDetails = false }: ListWithDetailsProps) {
  const width = useDetailsPaneStore((state) => detailsWidthOf(state, detailsKey, widthLimits));
  const hidden = useDetailsPaneStore((state) => detailsHidden(state, detailsKey));
  const setWidth = useDetailsPaneStore((state) => state.setWidth);
  const diffExpanded = useDiffExpanded() && diffInDetails;
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
      stowed={diffExpanded ? 'first' : undefined}
      first={list}
      second={diffInDetails ? <ExpandableDiffContext.Provider value>{details}</ExpandableDiffContext.Provider> : details}
    />
  );
}
