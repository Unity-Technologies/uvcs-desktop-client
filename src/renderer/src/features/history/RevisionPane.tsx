import { useRef, type KeyboardEvent } from 'react';
import type { ItemHistory } from '@shared/domain/history';
import type { MenuEntry } from '../../lib/actions';
import { focusMain, isKeyboardTaken } from '../../lib/mainFocus';
import { hotkey } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { useShortcut } from '../../lib/useShortcut';
import type { AnnotationHistory } from '../annotate/AnnotationPane';
import { otherFileView } from '../annotate/fileView';
import { historyRowKey, type HistoryRow } from './historyRows';
import { PathChangeDetails } from './PathChangeDetails';
import { RevisionDetails } from './RevisionDetails';
import { RevisionHeader } from './RevisionHeader';
import { shownRevisionView, type RevisionView } from './revisionView';
import styles from './RevisionPane.module.css';

interface RevisionPaneProps {
  path: string;
  history: ItemHistory;
  /** The row the keyboard is on, whose changeset the header shows. */
  focusedRow: HistoryRow | undefined;
  selectedRows: readonly HistoryRow[];
  /** The context menu of a row. */
  menu: (rows: HistoryRow[]) => MenuEntry[];
  /** Back to the revision annotated before "Annotate before this change". */
  onBack?: () => void;
  annotationHistory: AnnotationHistory;
  /** The repository of a file under an xlink. */
  otherRepository?: string;
  view: RevisionView;
  onPickView: (view: RevisionView) => void;
}

/**
 * The history's right side: the focused row's changeset over the selected revision as a diff or annotated (or a move,
 * which has nothing to compare). ⌘E goes into it and Esc back to the list, as in any list beside a file; ⇧⌘T switches
 * between the diff and the annotation.
 */
export function RevisionPane({ path, history, focusedRow, selectedRows, menu, onBack, annotationHistory, otherRepository, view, onPickView }: RevisionPaneProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const focusedChange = selectedRows.length === 1 && selectedRows[0]!.kind === 'pathChange' ? selectedRows[0]!.change : undefined;
  const selectedRevisions = selectedRows.flatMap((row) => (row.kind === 'revision' ? [row.revision] : []));

  const togglable = focusedRow?.kind === 'revision' && shownRevisionView('annotate', focusedRow.revision.itemType) === 'annotate';
  useShortcut(hotkey('historyToggleView'), () => onPickView(otherFileView(view)), togglable);
  useShortcut(hotkey('historyEnterPane'), () => paneRef.current?.querySelector<HTMLElement>('[role="region"]')?.focus(), Boolean(focusedRow));
  const leavePane = (event: KeyboardEvent): void => {
    const inPane = event.target instanceof Node && event.currentTarget.contains(event.target);
    if (event.defaultPrevented || !inPane || isKeyboardTaken() || !matchesShortcut(event.nativeEvent, hotkey('historyLeavePane'))) return;
    event.preventDefault();
    focusMain(document);
  };

  return (
    <div ref={paneRef} className={styles.pane} onKeyDown={leavePane}>
      {focusedRow && (
        <RevisionHeader
          key={historyRowKey(focusedRow)}
          row={focusedRow}
          path={path}
          menu={menu([focusedRow])}
          otherRepository={otherRepository}
          isWorkspaceRevision={focusedRow.kind === 'revision' && focusedRow.revision.revisionId === history.workspaceRevisionId}
        />
      )}
      {focusedChange ? (
        <PathChangeDetails change={focusedChange} otherRepository={otherRepository} />
      ) : (
        <RevisionDetails
          path={path}
          revisions={history.revisions}
          selected={selectedRevisions}
          onBack={onBack}
          history={annotationHistory}
          otherRepository={otherRepository}
          picked={view}
          onPick={onPickView}
        />
      )}
    </div>
  );
}
