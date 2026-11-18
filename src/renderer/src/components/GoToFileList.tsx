import type { ReactNode } from 'react';
import { CenteredSpinner } from '../ui/Spinner';
import styles from './GoToFileList.module.css';

interface GoToFileListProps {
  /** The results' paths, the best first. */
  paths: string[];
  highlighted: number;
  onHighlight: (index: number) => void;
  onPick: (path: string) => void;
  /** The result as its tree shows it. */
  row: (path: string) => ReactNode;
  /** A result's actions (`RowActionsButton`), shown on the highlighted result and on the one whose menu is open. */
  actions?: (path: string) => ReactNode;
  /** The result whose actions menu is open, if any. */
  actionsOpenFor?: string | null;
  /** A right click on a result: opens its actions, as its "…" and Tab do. */
  onOpenActions?: (index: number) => void;
  loading: boolean;
  /** What shows instead of results, or beside the first ones (none, the dialog having nothing to say). */
  note: string | null;
}

/** Go to file's results, a workspace's or a repository's: the highlighted one picked with Enter (`goToFileKey`) or a click. */
export function GoToFileList({ paths, highlighted, onHighlight, onPick, row, actions, actionsOpenFor, onOpenActions, loading, note }: GoToFileListProps) {
  return (
    <div className={styles.results}>
      {loading && <CenteredSpinner />}
      {note && <div className={styles.empty}>{note}</div>}
      {paths.map((path, index) => (
        <div
          key={path}
          className={styles.resultRow}
          data-highlighted={index === highlighted}
          onMouseEnter={() => onHighlight(index)}
          onContextMenu={
            onOpenActions &&
            ((event) => {
              event.preventDefault();
              onOpenActions(index);
            })
          }
        >
          <button type="button" className={styles.result} onClick={() => onPick(path)}>
            {row(path)}
          </button>
          {(index === highlighted || path === actionsOpenFor) && actions?.(path)}
        </div>
      ))}
    </div>
  );
}
