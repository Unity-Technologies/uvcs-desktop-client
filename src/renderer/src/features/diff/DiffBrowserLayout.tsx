import { useState, type ReactNode } from 'react';
import { SplitPane } from '../../ui/SplitPane';
import styles from './DiffBrowserLayout.module.css';

/** Where a `DiffBrowser` draws its list of files and its diff. */
export interface DiffBrowserSlots {
  files: HTMLElement;
  diff: HTMLElement;
}

interface DiffBrowserLayoutProps {
  /** Above the files, in the same column, its own height dragged apart from theirs: a branch's changesets. */
  aboveFiles?: ReactNode;
  /** Above the diff, in its column: a changeset's summary where the page's header names its branch. */
  aboveDiff?: ReactNode;
  /** The browser, once the slots are in the page: it draws into them (`createPortal`), and nothing here. */
  children?: (slots: DiffBrowserSlots) => ReactNode;
}

/**
 * The files of a diff in a column beside the diff of one, laid out apart from what draws them: a `DiffBrowser` is
 * mounted again for each target (each changeset of a branch, stepping through them), while this layout, the widths
 * dragged and what's above the files stay, so the changesets keep their focus, scroll and filter as they're stepped.
 * Only the diff's column holds what changes height from one target to the next (`aboveDiff`): the lists never move.
 */
export function DiffBrowserLayout({ aboveFiles, aboveDiff, children }: DiffBrowserLayoutProps) {
  const [files, setFiles] = useState<HTMLElement | null>(null);
  const [diff, setDiff] = useState<HTMLElement | null>(null);
  const filesSlot = <div ref={setFiles} className={styles.slot} />;
  const diffSlot = <div ref={setDiff} className={styles.slot} />;

  return (
    <>
      <SplitPane
        initialSize={340}
        minSize={220}
        maxSize={640}
        first={
          aboveFiles ? (
            <SplitPane direction="vertical" initialSize={260} minSize={96} maxSize={720} restMinSize={160} first={aboveFiles} second={filesSlot} />
          ) : (
            filesSlot
          )
        }
        second={
          aboveDiff ? (
            <div className={styles.slot}>
              {aboveDiff}
              {diffSlot}
            </div>
          ) : (
            diffSlot
          )
        }
      />
      {files && diff && children?.({ files, diff })}
    </>
  );
}
