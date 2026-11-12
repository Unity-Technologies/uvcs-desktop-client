import { useState, type ReactNode } from 'react';
import { useDiffExpanded } from '../../components/diffExpansionStore';
import { ExpandableDiffContext } from '../../components/expandableDiffContext';
import { SplitPane } from '../../ui/SplitPane';
import { Stowable } from '../../ui/Stowable';
import styles from './DiffBrowserLayout.module.css';

/** Where a `DiffBrowser` draws its list of files and its diff. */
export interface DiffBrowserSlots {
  files: HTMLElement;
  diff: HTMLElement;
}

interface DiffBrowserLayoutProps {
  /** Above the files, in the same column, as tall as it draws itself: a branch's changesets. */
  aboveFiles?: ReactNode;
  /** Above the diff, in its column: a changeset's summary where the page's header names its branch. */
  aboveDiff?: ReactNode;
  /** The browser, once the slots are in the page: it draws into them (`createPortal`), and nothing here. */
  children?: (slots: DiffBrowserSlots) => ReactNode;
  /**
   * Whether its diff offers Expand Diff, the whole window for the diff: a page's does; one in a dialog doesn't, as the
   * window isn't the dialog's to lay out (its files would also hide while the page's diff is expanded behind it).
   */
  expandable?: boolean;
}

/**
 * The files of a diff in a column beside the diff of one, laid out apart from what draws them: a `DiffBrowser` is
 * mounted again for each target (each changeset of a branch, stepping through them), while this layout, the widths
 * dragged and what's above the files stay, so the changesets keep their focus, scroll and filter as they're stepped.
 * Only the diff's column holds what changes height from one target to the next (`aboveDiff`): the lists never move.
 */
/** The list of files' width beside a diff, until it's dragged. */
export const FILES_WIDTH = 340;

export function DiffBrowserLayout({ aboveFiles, aboveDiff, children, expandable = true }: DiffBrowserLayoutProps) {
  const [files, setFiles] = useState<HTMLElement | null>(null);
  const [diff, setDiff] = useState<HTMLElement | null>(null);
  const diffExpanded = useDiffExpanded() && expandable;
  const filesSlot = <div ref={setFiles} className={styles.slot} />;
  const diffSlot = <div ref={setDiff} className={styles.slot} />;

  return (
    <ExpandableDiffContext.Provider value={expandable}>
      <SplitPane
        initialSize={FILES_WIDTH}
        minSize={220}
        maxSize={640}
        // Expanded, the files stay mounted out of sight: stepping past the last change still goes on to the next file.
        stowed={diffExpanded ? 'first' : undefined}
        // A list above the files that comes or goes (a branch read again gains its second changeset) moves the files'
        // slot, which mounts the browser again: rare enough to keep one plain layout per case. The list is as tall as
        // its rows up to its own cap, so the files get the rest.
        first={
          aboveFiles ? (
            <div className={styles.slot}>
              {aboveFiles}
              {filesSlot}
            </div>
          ) : (
            filesSlot
          )
        }
        second={
          aboveDiff ? (
            <div className={styles.slot}>
              <Stowable stowed={diffExpanded}>{aboveDiff}</Stowable>
              {diffSlot}
            </div>
          ) : (
            diffSlot
          )
        }
      />
      {files && diff && children?.({ files, diff })}
    </ExpandableDiffContext.Provider>
  );
}
