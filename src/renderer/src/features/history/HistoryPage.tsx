import { History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Label } from '@shared/domain/label';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { LabelChips } from '../../components/LabelChips';
import { PathLabel } from '../../components/PathLabel';
import { formatSize } from '../../lib/formatDate';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { firstLine, pluralize } from '../../lib/text';
import { UserLabel } from '../../ui/Avatar';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { SplitPane } from '../../ui/SplitPane';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { TableSkeleton } from '../../ui/table/TableSkeleton';
import { ViewHeader } from '../../ui/ViewHeader';
import { useLabelsByChangeset } from '../labels/useLabelsByChangeset';
import { historyMenu } from './historyMenu';
import { changesetOf, historyRowKey, historyRows, type HistoryRow } from './historyRows';
import { matchesHistorySearch } from './historySearch';
import { PathChangeDetails } from './PathChangeDetails';
import { RevisionDetails } from './RevisionDetails';
import { useItemHistory } from './useItemHistory';
import styles from './HistoryPage.module.css';

function historyColumns(labelsByChangeset: ReadonlyMap<number, readonly Label[]>): Column<HistoryRow>[] {
  return [
    {
      id: 'changeset',
      header: 'Changeset',
      width: 96,
      // Inside a box in the text's font, the mono number sits on the other columns' baseline instead of centered higher.
      render: (row) => (
        <span>
          <span className="mono">
            <Highlight text={String(changesetOf(row))} />
          </span>
        </span>
      ),
    },
    {
      id: 'comment',
      header: 'Comment',
      grow: 3,
      render: (row) =>
        row.kind === 'revision' ? (
          <span className={styles.commentCell}>
            <LabelChips labels={labelsByChangeset.get(row.revision.changesetId)} />
            <span className={styles.clipped}>
              <Highlight text={firstLine(row.revision.comment) || '—'} />
            </span>
          </span>
        ) : (
          <span className={styles.pathChange} data-tip-overflow data-tip={row.change.description}>
            <Highlight text={row.change.description} />
          </span>
        ),
    },
    {
      id: 'branch',
      header: 'Branch',
      width: 160,
      secondary: true,
      render: (row) =>
        row.kind === 'revision' && (
          <span className={styles.clipped}>
            <PathLabel path={row.revision.branch} />
          </span>
        ),
    },
    { id: 'owner', header: 'Author', width: 160, render: (row) => <UserLabel user={row.kind === 'revision' ? row.revision.owner : row.change.owner} /> },
    {
      id: 'date',
      header: 'Date',
      width: 120,
      secondary: true,
      render: (row) => <RelativeTime date={row.kind === 'revision' ? row.revision.date : row.change.date} />,
    },
    { id: 'size', header: 'Size', width: 80, align: 'end', secondary: true, render: (row) => row.kind === 'revision' && formatSize(row.revision.size) },
  ];
}

export function HistoryPage({ page }: PageProps<'history'>) {
  const workspacePath = useWorkspacePath();
  const { data: history, error } = useItemHistory(page.path, page.changesetId);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const rows = useMemo(() => (history ? historyRows(history) : []), [history]);
  const visible = useMemo(() => rows.filter((row) => matchesHistorySearch(row, search)), [rows, search]);
  const selectedRows = useMemo(() => rows.filter((row) => selection.selected.has(historyRowKey(row))), [rows, selection]);
  const selectedRevisions = selectedRows.flatMap((row) => (row.kind === 'revision' ? [row.revision] : []));
  const focusedChange = selectedRows.length === 1 && selectedRows[0]!.kind === 'pathChange' ? selectedRows[0]!.change : undefined;
  // The newest revision, rather than a move or a removal on another branch, is what opening a history is for.
  const newestKey = history?.revisions[0] && String(history.revisions[0].changesetId);
  const labelsByChangeset = useLabelsByChangeset();
  const columns = useMemo(() => historyColumns(labelsByChangeset), [labelsByChangeset]);

  useEffect(() => {
    if (selection.anchor === null && newestKey) setSelection({ selected: new Set([newestKey]), anchor: newestKey });
  }, [selection.anchor, newestKey]);

  const header = (
    <ViewHeader title={page.path} subtitle={history && pluralize(history.revisions.length, 'revision')}>
      {rows.length > 0 && <SearchField value={search} onChange={setSearch} placeholder="Filter by comment, author, changeset, branch" width={320} />}
    </ViewHeader>
  );

  if (error) return <>{header}<EmptyState title="Couldn't load the history" description={error.message} /></>;
  if (!history) return <>{header}<TableSkeleton columns={columns} /></>;
  if (rows.length === 0) return <>{header}<EmptyState icon={<History size={22} />} title="No history yet" /></>;

  return (
    <>
      {header}
      <SplitPane
        direction="vertical"
        initialSize={260}
        minSize={120}
        maxSize={700}
        first={
          visible.length === 0 ? (
            <EmptyState icon={<History size={22} />} title="No matching revisions" description="No comment, author, changeset or branch contains this text." />
          ) : (
            <HighlightQuery query={search}>
              <DataTable
                rows={visible}
                columns={columns}
                rowKey={historyRowKey}
                selection={selection}
                onSelectionChange={setSelection}
                contextMenu={(selected) => historyMenu({ workspacePath, path: page.path, changesetId: page.changesetId }, selected)}
              />
            </HighlightQuery>
          )
        }
        second={
          focusedChange ? (
            <PathChangeDetails change={focusedChange} />
          ) : (
            <RevisionDetails path={page.path} revisions={history.revisions} selected={selectedRevisions} />
          )
        }
      />
    </>
  );
}
