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
  /** What the highlighted result offers beside it (the workspace's actions). */
  highlightedExtra?: (path: string) => ReactNode;
  /** A control before each result, outside the button that picks it (Choose what to download's checkbox). */
  lead?: (path: string) => ReactNode;
  /** What shows at each result's end (Choose what to download's Download or Remove pill). */
  end?: (path: string) => ReactNode;
  loading: boolean;
  /** What shows instead of results, or beside the first ones (none, the dialog having nothing to say). */
  note: string | null;
}

/** Go to file's results, a workspace's or a repository's: the highlighted one picked with Enter (`goToFileKey`) or a click. */
export function GoToFileList({ paths, highlighted, onHighlight, onPick, row, highlightedExtra, lead, end, loading, note }: GoToFileListProps) {
  return (
    <div className={styles.results}>
      {loading && <CenteredSpinner />}
      {note && <div className={styles.empty}>{note}</div>}
      {paths.map((path, index) => (
        <div key={path} className={styles.resultRow} data-highlighted={index === highlighted} onMouseEnter={() => onHighlight(index)}>
          {lead && <span className={styles.lead}>{lead(path)}</span>}
          <button type="button" className={styles.result} onClick={() => onPick(path)}>
            {row(path)}
          </button>
          {end?.(path)}
          {index === highlighted && highlightedExtra?.(path)}
        </div>
      ))}
    </div>
  );
}
