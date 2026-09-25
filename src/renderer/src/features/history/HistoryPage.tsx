import { History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ItemRevision } from '@shared/domain/history';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { formatSize } from '../../lib/formatDate';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { firstLine, pluralize } from '../../lib/text';
import { UserLabel } from '../../ui/Avatar';
import { EmptyState } from '../../ui/EmptyState';
import { RelativeTime } from '../../ui/RelativeTime';
import { CenteredSpinner } from '../../ui/Spinner';
import { SplitPane } from '../../ui/SplitPane';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { historyMenu } from './historyMenu';
import { RevisionComparison } from './RevisionComparison';
import { useItemHistory } from './useItemHistory';

const revisionKey = (revision: ItemRevision): string => String(revision.changesetId);

const COLUMNS: Column<ItemRevision>[] = [
  { id: 'changeset', header: 'Changeset', width: 96, render: (revision) => <span className="mono">{revision.changesetId}</span> },
  { id: 'comment', header: 'Comment', grow: 3, render: (revision) => firstLine(revision.comment) || '—' },
  { id: 'branch', header: 'Branch', width: 160, secondary: true, render: (revision) => revision.branch },
  { id: 'owner', header: 'Author', width: 160, render: (revision) => <UserLabel user={revision.owner} /> },
  { id: 'date', header: 'Date', width: 120, secondary: true, render: (revision) => <RelativeTime date={revision.date} /> },
  { id: 'size', header: 'Size', width: 80, align: 'end', secondary: true, render: (revision) => formatSize(revision.size) },
];

export function HistoryPage({ page }: PageProps<'history'>) {
  const workspacePath = useWorkspacePath();
  const { data: revisions, error } = useItemHistory(page.path);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const selected = useMemo(() => (revisions ?? []).filter((revision) => selection.selected.has(revisionKey(revision))), [revisions, selection]);
  const newestKey = revisions?.[0] && revisionKey(revisions[0]);

  useEffect(() => {
    if (selection.anchor === null && newestKey) setSelection({ selected: new Set([newestKey]), anchor: newestKey });
  }, [selection.anchor, newestKey]);

  const header = <ViewHeader title={page.path} subtitle={revisions && pluralize(revisions.length, 'revision')} />;

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
          <DataTable
            rows={revisions}
            columns={COLUMNS}
            rowKey={revisionKey}
            selection={selection}
            onSelectionChange={setSelection}
            contextMenu={(rows) => historyMenu({ workspacePath, path: page.path }, rows)}
          />
        }
        second={<RevisionComparison path={page.path} revisions={revisions} selected={selected} />}
      />
    </>
  );
}
