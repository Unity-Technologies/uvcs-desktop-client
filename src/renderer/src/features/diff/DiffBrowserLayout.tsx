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
  /** The browser, once the slots are in the page: it draws into them (`createPortal`), and nothing here. */
  children?: (slots: DiffBrowserSlots) => ReactNode;
}

/**
 * The files of a diff in a column beside the diff of one, laid out apart from what draws them: a `DiffBrowser` is
 * mounted again for each target (each changeset of a branch, stepping through them), while this layout, the widths
 * dragged and what's above the files stay, so the changesets keep their focus, scroll and filter as they're stepped.
 */
export function DiffBrowserLayout({ aboveFiles, children }: DiffBrowserLayoutProps) {
  const [files, setFiles] = useState<HTMLElement | null>(null);
  const [diff, setDiff] = useState<HTMLElement | null>(null);
  const filesSlot = <div ref={setFiles} className={styles.slot} />;

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
        second={<div ref={setDiff} className={styles.slot} />}
      />
      {files && diff && children?.({ files, diff })}
    </>
  );
}
