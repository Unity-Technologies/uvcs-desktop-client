import type { ComponentProps } from 'react';
import { SplitPane } from '../ui/SplitPane';
import { detailsWidthOf, useDetailsPaneStore, type DetailsWidthLimits } from './detailsPaneStore';

type RememberedSplitPaneProps = Omit<ComponentProps<typeof SplitPane>, 'initialSize' | 'minSize' | 'maxSize' | 'restMinSize' | 'size' | 'onSizeChange'> & {
  /** Whose width this is in the details' store, remembered across pages and sessions: one key per kind of split. */
  widthKey: string;
  /** The sized pane's default, where a double-click on the splitter takes it back, and its limits. */
  widthLimits: DetailsWidthLimits;
};

/** A `SplitPane` that opens as wide as it was last left, as a view's details panel does (`ListWithDetails`). */
export function RememberedSplitPane({ widthKey, widthLimits, ...split }: RememberedSplitPaneProps) {
  const width = useDetailsPaneStore((state) => detailsWidthOf(state, widthKey, widthLimits));
  const setWidth = useDetailsPaneStore((state) => state.setWidth);
  return (
    <SplitPane
      {...split}
      initialSize={widthLimits.initial}
      minSize={widthLimits.min}
      maxSize={widthLimits.max}
      restMinSize={widthLimits.restMin}
      size={width}
      onSizeChange={(size) => setWidth(widthKey, size)}
    />
  );
}
