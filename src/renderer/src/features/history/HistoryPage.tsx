import { History } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { detailsWidthOf, useDetailsWidthStore, type DetailsWidthLimits } from '../../components/detailsWidthStore';
import { focusMain, isKeyboardTaken } from '../../lib/mainFocus';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { hotkey } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { useShortcut } from '../../lib/useShortcut';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import { SplitPane } from '../../ui/SplitPane';
import { ViewHeader } from '../../ui/ViewHeader';
import type { AnnotationHistory } from '../annotate/AnnotationPane';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { HISTORY_ROW_HEIGHT, HistoryList } from './HistoryList';
import { historyMenu } from './historyMenu';
import { historyRowKey, historyRows, revisionRowKey } from './historyRows';
import { matchesHistorySearch } from './historySearch';
import { PathChangeDetails } from './PathChangeDetails';
import { RevisionDetails } from './RevisionDetails';
import { RevisionHeader } from './RevisionHeader';
import { otherRevisionView, shownRevisionView, useRevisionView } from './revisionView';
import { useItemHistory } from './useItemHistory';
import styles from './HistoryPage.module.css';

/** The revisions list on the left: as wide as it was left, the diff taking the rest. */
const LIST_WIDTH: DetailsWidthLimits = { initial: 340, min: 260, max: 640 };
const LIST_WIDTH_KEY = 'historyList';

const single = (key: string): SelectionState => ({ selected: new Set([key]), anchor: key });

/**
 * A file's history as the other list views read: its revisions (and moves) on the left, the selected one on the right,
 * under a header of its changeset, as a diff against the revision it was made from or annotated.
 */
export function HistoryPage({ page }: PageProps<'history'>) {
  const workspacePath = useWorkspacePath();
  const { data: history, error } = useItemHistory(page.path, page.changesetId);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  // Revisions left by "Annotate before this change", for Back; picking a row in the list starts over.
  const [trail, setTrail] = useState<string[]>([]);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const listWidth = useDetailsWidthStore((state) => detailsWidthOf(state, LIST_WIDTH_KEY, LIST_WIDTH));
  const setListWidth = useDetailsWidthStore((state) => state.setWidth);
  const { view, setView } = useRevisionView();
  const paneRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => (history ? historyRows(history) : []), [history]);
  const visible = useMemo(() => rows.filter((row) => matchesHistorySearch(row, search)), [rows, search]);
  const selectedRows = useMemo(() => rows.filter((row) => selection.selected.has(historyRowKey(row))), [rows, selection]);
  const selectedRevisions = selectedRows.flatMap((row) => (row.kind === 'revision' ? [row.revision] : []));
  const focusedRow = rows.find((row) => historyRowKey(row) === selection.anchor);
  const focusedChange = selectedRows.length === 1 && selectedRows[0]!.kind === 'pathChange' ? selectedRows[0]!.change : undefined;
  // The asked-for revision, else the newest one, rather than a move or a removal on another branch: what opening a history is for.
  const initialKey = history && ((page.selectChangeset !== undefined && revisionRowKey(rows, page.selectChangeset)) || (history.revisions[0] && String(history.revisions[0].changesetId)));
  const menu = useCallback(
    (selected: typeof rows) => historyMenu({ workspacePath, path: page.path, changesetId: page.changesetId }, selected),
    [workspacePath, page.path, page.changesetId],
  );

  useEffect(() => {
    if (selection.anchor === null && initialKey) {
      setSelection(single(initialKey));
      setRevealKey(initialKey);
    }
  }, [selection.anchor, initialKey]);

  /**
   * Selects a row from the pane (an annotated block, "Annotate before this change"), showing it even if the filter hid
   * it. The keyboard goes with the selection: the pane shows another revision now.
   */
  const selectFromPane = useCallback(
    (key: string): void => {
      if (!visible.some((row) => historyRowKey(row) === key)) setSearch('');
      setSelection(single(key));
      setRevealKey(key);
      focusMain(document);
    },
    [visible],
  );
  const annotationHistory = useMemo<AnnotationHistory>(
    () => ({
      select: (changesetId) => {
        const key = revisionRowKey(rows, changesetId);
        if (key) selectFromPane(key);
        else openChangesetDiff({ id: changesetId }, page.path);
      },
      annotate: (revision) => {
        if (selection.anchor) setTrail((current) => [...current, selection.anchor!]);
        selectFromPane(historyRowKey({ kind: 'revision', revision }));
      },
    }),
    [rows, selectFromPane, selection.anchor, page.path],
  );
  const back = (): void => {
    const previous = trail.at(-1);
    if (!previous) return;
    setTrail(trail.slice(0, -1));
    selectFromPane(previous);
  };

  const togglable = focusedRow?.kind === 'revision' && shownRevisionView('annotate', focusedRow.revision.itemType) === 'annotate';
  useShortcut(hotkey('historyToggleView'), () => setView(otherRevisionView(view)), togglable);
  // Into the diff or the annotation, and Esc back to the list, as in any list beside a file.
  useShortcut(hotkey('historyEnterPane'), () => paneRef.current?.querySelector<HTMLElement>('[role="region"]')?.focus(), Boolean(focusedRow));
  const leavePane = (event: KeyboardEvent): void => {
    const inPane = event.target instanceof Node && event.currentTarget.contains(event.target);
    if (event.defaultPrevented || !inPane || isKeyboardTaken() || !matchesShortcut(event.nativeEvent, hotkey('historyLeavePane'))) return;
    event.preventDefault();
    focusMain(document);
  };

  const header = (
    <ViewHeader title={page.path} count={history?.revisions.length}>
      {rows.length > 0 && <SearchField value={search} onChange={setSearch} placeholder="Filter by comment, author, changeset, branch" width={320} />}
    </ViewHeader>
  );

  if (error) return <>{header}<EmptyState title="Couldn't load the history" description={error.message} /></>;
  if (!history) return <>{header}<ListSkeleton rowHeight={HISTORY_ROW_HEIGHT} /></>;
  if (rows.length === 0) return <>{header}<EmptyState icon={<History size={22} />} title="No history yet" /></>;

  return (
    <>
      {header}
      <SplitPane
        initialSize={LIST_WIDTH.initial}
        minSize={LIST_WIDTH.min}
        maxSize={LIST_WIDTH.max}
        size={listWidth}
        onSizeChange={(size) => setListWidth(LIST_WIDTH_KEY, size)}
        first={
          visible.length === 0 ? (
            <EmptyState icon={<History size={22} />} title="No matching revisions" description="No comment, author, changeset or branch contains this text." />
          ) : (
            <HighlightQuery query={search}>
              <HistoryList
                rows={visible}
                selection={selection}
                onSelectionChange={(next) => {
                  setTrail([]);
                  setSelection(next);
                }}
                contextMenu={menu}
                workspaceRevisionId={history.workspaceRevisionId}
                revealKey={revealKey}
              />
            </HighlightQuery>
          )
        }
        second={
          <div ref={paneRef} className={styles.pane} onKeyDown={leavePane}>
            {focusedRow && (
              <RevisionHeader
                key={historyRowKey(focusedRow)}
                row={focusedRow}
                path={page.path}
                menu={menu([focusedRow])}
                isWorkspaceRevision={focusedRow.kind === 'revision' && focusedRow.revision.revisionId === history.workspaceRevisionId}
              />
            )}
            {focusedChange ? (
              <PathChangeDetails change={focusedChange} />
            ) : (
              <RevisionDetails
                path={page.path}
                revisions={history.revisions}
                selected={selectedRevisions}
                onBack={trail.length > 0 ? back : undefined}
                history={annotationHistory}
              />
            )}
          </div>
        }
      />
    </>
  );
}
