import type { ReactNode, Ref } from 'react';
import type { DetailsWidthLimits } from '../../components/detailsPaneStore';
import { RememberedSplitPane } from '../../components/RememberedSplitPane';
import styles from './MergePanes.module.css';

interface MergePanesProps {
  /** The merge's header (`MergeHeader`), its button disabled while the plan is calculated. */
  header: ReactNode;
  /** What the merge does, under its filter bar; placeholder rows while the plan is calculated. */
  list: ReactNode;
  listRef?: Ref<HTMLDivElement>;
  /** What the merge does to the item selected; nothing while the plan is calculated. */
  detail: ReactNode;
}

/** The list of what a merge does: remembered as it was left, for the next merge. */
const LIST_WIDTH: DetailsWidthLimits = { initial: 360, min: 240, max: 640 };
const LIST_WIDTH_KEY = 'mergeList';

/** The merge page's layout, the same while the plan is calculated as once it's in. */
export function MergePanes({ header, list, listRef, detail }: MergePanesProps) {
  return (
    <div className={styles.session}>
      {header}
      <RememberedSplitPane
        widthKey={LIST_WIDTH_KEY}
        widthLimits={LIST_WIDTH}
        first={
          <div ref={listRef} className={styles.list}>
            {list}
          </div>
        }
        second={detail}
      />
    </div>
  );
}
