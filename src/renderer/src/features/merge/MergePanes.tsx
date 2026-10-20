import type { ReactNode, Ref } from 'react';
import { SplitPane } from '../../ui/SplitPane';
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

/** The merge page's layout, the same while the plan is calculated as once it's in. */
export function MergePanes({ header, list, listRef, detail }: MergePanesProps) {
  return (
    <div className={styles.session}>
      {header}
      <SplitPane
        initialSize={360}
        minSize={240}
        maxSize={640}
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
