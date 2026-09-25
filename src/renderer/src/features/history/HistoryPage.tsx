import { History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ItemRevision } from '@shared/domain/history';
import type { Label } from '@shared/domain/label';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { LabelChips } from '../../components/LabelChips';
import { formatSize } from '../../lib/formatDate';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { firstLine, pluralize } from '../../lib/text';
import { UserLabel } from '../../ui/Avatar';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { SplitPane } from '../../ui/SplitPane';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { useLabelsByChangeset } from '../labels/useLabelsByChangeset';
import { historyMenu } from './historyMenu';
import { RevisionDetails } from './RevisionDetails';
import { matchesRevisionSearch } from './revisionSearch';
import { useItemHistory } from './useItemHistory';
import styles from './HistoryPage.module.css';

const revisionKey = (revision: ItemRevision): string => String(revision.changesetId);

function historyColumns(labelsByChangeset: ReadonlyMap<number, readonly Label[]>): Column<ItemRevision>[] {
  return [
    { id: 'changeset', header: 'Changeset', width: 96, render: (revision) => <span className="mono"><Highlight text={String(revision.changesetId)} /></span> },
    {
      id: 'comment',
      header: 'Comment',
      grow: 3,
      render: (revision) => (
        <span className={styles.commentCell}>
          <LabelChips labels={labelsByChangeset.get(revision.changesetId)} />
          <span className={styles.clipped}>
            <Highlight text={firstLine(revision.comment) || '—'} />
          </span>
        </span>
      ),
    },
    {
      id: 'branch',
      header: 'Branch',
      width: 160,
      secondary: true,
      render: (revision) => (
        <span className={styles.clipped}>
          <Highlight text={revision.branch} />
        </span>
      ),
    },
    { id: 'owner', header: 'Author', width: 160, render: (revision) => <UserLabel user={revision.owner} /> },
    { id: 'date', header: 'Date', width: 120, secondary: true, render: (revision) => <RelativeTime date={revision.date} /> },
    { id: 'size', header: 'Size', width: 80, align: 'end', secondary: true, render: (revision) => formatSize(revision.size) },
  ];
}

export function HistoryPage({ page }: PageProps<'history'>) {
  const workspacePath = useWorkspacePath();
  const { data: revisions, error } = useItemHistory(page.path);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const visible = useMemo(() => (revisions ?? []).filter((revision) => matchesRevisionSearch(revision, search)), [revisions, search]);
  const selected = useMemo(() => (revisions ?? []).filter((revision) => selection.selected.has(revisionKey(revision))), [revisions, selection]);
  const newestKey = revisions?.[0] && revisionKey(revisions[0]);
  const labelsByChangeset = useLabelsByChangeset();
  const columns = useMemo(() => historyColumns(labelsByChangeset), [labelsByChangeset]);

  useEffect(() => {
    if (selection.anchor === null && newestKey) setSelection({ selected: new Set([newestKey]), anchor: newestKey });
  }, [selection.anchor, newestKey]);

  const header = (
    <ViewHeader title={page.path} subtitle={revisions && pluralize(revisions.length, 'revision')}>
      {revisions && revisions.length > 0 && <SearchField value={search} onChange={setSearch} placeholder="Filter by comment, author, changeset, branch" width={320} />}
    </ViewHeader>
  );

  if (error) return <>{header}<EmptyState title="Couldn't load the history" description={error.message} /></>;
  if (!revisions) return <>{header}<CenteredSpinner /></>;
  if (revisions.length === 0) return <>{header}<EmptyState icon={<History size={22} />} title="No history yet" /></>;

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
                rowKey={revisionKey}
                selection={selection}
                onSelectionChange={setSelection}
                contextMenu={(rows) => historyMenu({ workspacePath, path: page.path }, rows)}
              />
            </HighlightQuery>
          )
        }
        second={<RevisionDetails path={page.path} revisions={revisions} selected={selected} />}
      />
    </>
  );
}
