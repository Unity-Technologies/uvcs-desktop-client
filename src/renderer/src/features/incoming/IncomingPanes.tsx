import type { ReactNode } from 'react';
import { SplitPane } from '../../ui/SplitPane';
import styles from './IncomingPanes.module.css';

interface IncomingPanesProps {
  /** The changesets above, then the files; skeleton rows while they're read, nothing once up to date. */
  list: ReactNode;
  /** Beside the list: the file's diff or conflict, the changeset's details, or "You're up to date". */
  detail: ReactNode;
}

/** Incoming's two panes, laid out the same while it reads, once it's up to date, and with changes coming in. */
export function IncomingPanes({ list, detail }: IncomingPanesProps) {
  return <SplitPane initialSize={360} minSize={240} maxSize={640} first={<div className={styles.pane}>{list}</div>} second={detail} />;
}
