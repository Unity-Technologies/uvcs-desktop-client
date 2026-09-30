import { History } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import type { PageProps } from '../../app/navigation/pages';
import { useOtherRepository, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { detailsWidthOf, useDetailsWidthStore, type DetailsWidthLimits } from '../../components/detailsWidthStore';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { EmptyState } from '../../ui/EmptyState';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { HighlightQuery } from '../../ui/Highlight';
import { NoMatches } from '../../ui/NoMatches';
import { ListSkeleton } from '../../ui/Skeleton';
import { SplitPane } from '../../ui/SplitPane';
import { ViewHeader } from '../../ui/ViewHeader';
import type { AnnotationHistory } from '../annotate/AnnotationPane';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { HISTORY_ROW_HEIGHT, HistoryList } from './HistoryList';
import { historyMenu } from './historyMenu';
import { historyRowKey, historyRows, revisionRowKey, type HistoryRow } from './historyRows';
import { initialHistoryRow } from './initialHistoryRow';
import { RevisionPane } from './RevisionPane';
import { usePageRevisionView } from './revisionView';
import { useHistoryFilters } from './useHistoryFilters';
import { useHistorySelection } from './useHistorySelection';
import { useItemHistory } from './useItemHistory';

/** The revisions list on the left: as wide as it was left, the diff taking the rest. */
const LIST_WIDTH: DetailsWidthLimits = { initial: 340, min: 260, max: 640 };
const LIST_WIDTH_KEY = 'historyList';

/**
 * A file's history as the other list views read: its revisions (and moves) on the left, the selected one on the right,
 * under a header of its changeset, as a diff against the revision it was made from or annotated (`RevisionPane`).
 */
export function HistoryPage({ page }: PageProps<'history'>) {
  const workspacePath = useWorkspacePath();
  const { data: history, error } = useItemHistory(page.path, page.revision);
  // A file under an xlink: its changesets, branches and labels are the xlinked repository's.
  const otherRepository = useOtherRepository(history?.revisions[0]?.repository);
  const listWidth = useDetailsWidthStore((state) => detailsWidthOf(state, LIST_WIDTH_KEY, LIST_WIDTH));
  const setListWidth = useDetailsWidthStore((state) => state.setWidth);
  const [view, setView] = usePageRevisionView(page.view);

  const rows = useMemo(() => (history ? historyRows(history) : []), [history]);
  const filters = useHistoryFilters(rows, otherRepository);
  const selection = useHistorySelection({
    initialKey: history && initialHistoryRow(rows, history, page),
    visible: filters.visible,
    clearFilters: filters.clear,
  });
  const selectedRows = useMemo(() => rows.filter((row) => selection.selection.selected.has(historyRowKey(row))), [rows, selection.selection]);
  const focusedRow = rows.find((row) => historyRowKey(row) === selection.selection.anchor);

  const { selectFromPane, selectAnew, walkBackTo } = selection;
  const annotationHistory = useMemo<AnnotationHistory>(
    () => ({
      revisions: history?.revisions ?? [],
      select: (changesetId) => {
        const key = revisionRowKey(rows, changesetId);
        if (key) selectFromPane(key);
        else if (!otherRepository) openChangesetDiff({ id: changesetId }, page.path);
      },
      annotate: (revision) => walkBackTo(historyRowKey({ kind: 'revision', revision })),
    }),
    [history, rows, selectFromPane, walkBackTo, page.path, otherRepository],
  );
  const menu = useCallback(
    (selected: HistoryRow[]) =>
      historyMenu(
        {
          workspacePath,
          path: page.path,
          ofWorkspaceFile: page.revision === undefined,
          otherRepository,
          annotate: (revision) => {
            selectAnew(historyRowKey({ kind: 'revision', revision }));
            setView('annotate');
          },
        },
        selected,
      ),
    [workspacePath, page.path, page.revision, otherRepository, selectAnew, setView],
  );

  const header = (
    <ViewHeader title={page.path} count={history && filters.visible.length} total={rows.length}>
      {rows.length > 0 && (
        <FilterBar
          text={<FilterField value={filters.search} onChange={filters.setSearch} placeholder="Filter revisions" />}
          people={<PeopleFilter value={filters.people} onChange={filters.setPeople} people={filters.authors} mineTip="Revisions you checked in" />}
        />
      )}
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
          filters.visible.length === 0 ? (
            <NoMatches icon={<History size={22} />} noun="revisions" onClear={filters.clear} />
          ) : (
            <HighlightQuery query={filters.search}>
              <HistoryList
                rows={filters.visible}
                selection={selection.selection}
                onSelectionChange={selection.selectInList}
                contextMenu={menu}
                workspaceRevisionId={history.workspaceRevisionId}
                revealKey={selection.revealKey}
                otherRepository={otherRepository}
              />
            </HighlightQuery>
          )
        }
        second={
          <RevisionPane
            path={page.path}
            history={history}
            focusedRow={focusedRow}
            selectedRows={selectedRows}
            menu={menu}
            onBack={selection.back}
            annotationHistory={annotationHistory}
            otherRepository={otherRepository}
            view={view}
            onPickView={setView}
          />
        }
      />
    </>
  );
}
