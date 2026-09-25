import { Plus, RefreshCw, Tag, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Label } from '@shared/domain/label';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { ListWithDetails } from '../../components/ListWithDetails';
import { SincePicker } from '../../components/SincePicker';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { sinceDateFor } from '../../lib/sincePresets';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ToggleChip } from '../../ui/ToggleChip';
import { ViewHeader } from '../../ui/ViewHeader';
import { openCreateLabelDialog } from './CreateLabelDialog';
import { LabelDetails } from './LabelDetails';
import { labelMenu } from './labelMenu';
import { switchToLabel } from './labelOperations';
import { useLabelsViewStore } from './labelsViewStore';
import { useLabels } from './useLabels';
import styles from './LabelsView.module.css';

const COLUMNS: Column<Label>[] = [
  {
    id: 'name',
    header: 'Name',
    grow: 1.5,
    sortValue: (label) => label.name,
    render: (label) => (
      <span className={styles.name}>
        <Tag size={13} className={styles.icon} />
        {label.name}
      </span>
    ),
  },
  { id: 'changeset', header: 'Changeset', width: 100, align: 'end', sortValue: (label) => label.changeset, render: (label) => label.changeset },
  { id: 'branch', header: 'Branch', grow: 1, secondary: true, sortValue: (label) => label.branch, render: (label) => label.branch },
  { id: 'comment', header: 'Comment', grow: 2, secondary: true, render: (label) => label.comment },
  { id: 'owner', header: 'Created by', width: 180, sortValue: (label) => label.owner, render: (label) => <UserLabel user={label.owner} /> },
  { id: 'date', header: 'Created', width: 130, secondary: true, sortValue: (label) => label.date, render: (label) => <RelativeTime date={label.date} /> },
];

export function LabelsView() {
  const workspacePath = useWorkspacePath();
  const { since, onlyMine, update } = useLabelsViewStore();
  const { data: labels, isLoading, isFetching, error } = useLabels({ sinceDate: sinceDateFor(since), owner: onlyMine ? 'me' : undefined });
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (labels ?? []).filter((label) => `${label.name} ${label.comment} ${label.branch}`.toLowerCase().includes(needle));
  }, [labels, search]);
  const selected = visible.find((label) => labelKey(label) === selection.anchor);

  return (
    <>
      <ViewHeader
        title="Labels"
        subtitle={labels && `${labels.length}`}
        actions={
          <>
            <IconButton icon={<RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />
            <Button icon={<Plus size={14} />} onClick={() => openCreateLabelDialog(workspacePath)}>
              New label
            </Button>
          </>
        }
      >
        <SearchField value={search} onChange={setSearch} placeholder="Filter labels" />
        <SincePicker value={since} onChange={(value) => update({ since: value })} />
        <ToggleChip pressed={onlyMine} onChange={(value) => update({ onlyMine: value })} icon={<User size={12} />}>
          Mine
        </ToggleChip>
      </ViewHeader>
      {isLoading ? (
        <CenteredSpinner />
      ) : error ? (
        <EmptyState title="Couldn't load labels" description={error.message} />
      ) : (
        <ListWithDetails
          list={
            visible.length === 0 ? (
              <EmptyState
                icon={<Tag size={22} />}
                title="No labels"
                description="Labels mark important changesets, like releases."
                action={<Button onClick={() => openCreateLabelDialog(workspacePath)}>Label your workspace changeset</Button>}
              />
            ) : (
              <DataTable
                rows={visible}
                columns={COLUMNS}
                rowKey={labelKey}
                selection={selection}
                onSelectionChange={setSelection}
                onActivate={(label) => void switchToLabel(workspacePath, label)}
                contextMenu={(selectedLabels) => labelMenu(workspacePath, selectedLabels)}
              />
            )
          }
          details={
            selected ? (
              <LabelDetails workspacePath={workspacePath} label={selected} />
            ) : (
              <EmptyState title="Select a label" description="Select two labels to compare them." />
            )
          }
        />
      )}
    </>
  );
}

function labelKey(label: Label): string {
  return label.name;
}
