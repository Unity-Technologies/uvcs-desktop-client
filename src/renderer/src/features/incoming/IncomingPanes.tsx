import type { ReactNode } from 'react';
import { useDiffExpanded } from '../../components/diffExpansionStore';
import { ExpandableDiffContext } from '../../components/expandableDiffContext';
import { SplitPane } from '../../ui/SplitPane';
import styles from './IncomingPanes.module.css';

interface IncomingPanesProps {
  /** The changesets above, then the files; skeleton rows while they're read, nothing once up to date. */
  list: ReactNode;
  /** Beside the list: the file's diff or conflict, the changeset's details, or "You're up to date". */
  detail: ReactNode;
}

/**
 * Incoming's two panes, laid out the same while it reads, once it's up to date, and with changes coming in. A file's
 * diff expands: the list stays mounted out of sight, so stepping past its last change goes on to the next file.
 */
export function IncomingPanes({ list, detail }: IncomingPanesProps) {
  const diffExpanded = useDiffExpanded();
  return (
    <SplitPane
      initialSize={360}
      minSize={240}
      maxSize={640}
      stowed={diffExpanded ? 'first' : undefined}
      first={<div className={styles.pane}>{list}</div>}
      second={<ExpandableDiffContext.Provider value>{detail}</ExpandableDiffContext.Provider>}
    />
  );
}
