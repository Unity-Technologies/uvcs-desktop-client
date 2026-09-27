import { Plus, RefreshCw, Tag, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Label } from '@shared/domain/label';
import { useRenameCommand } from '../../app/commands/useRenameCommand';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { PathLabel } from '../../components/PathLabel';
import { SincePicker } from '../../components/SincePicker';
import { matchesAllWords } from '../../lib/matchesAllWords';
import { sinceDateFor } from '../../lib/sincePresets';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { cellText } from '../../ui/table/cellText';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ToggleChip } from '../../ui/ToggleChip';
import { ViewHeader } from '../../ui/ViewHeader';
import { openCreateLabelDialog } from './CreateLabelDialog';
import { LabelDetails } from './LabelDetails';
import { labelMenu } from './labelMenu';
import { renameLabel, showLabelChanges } from './labelOperations';
import { useLabelsViewStore } from './labelsViewStore';
import { useLabels } from './useLabels';
import styles from './LabelsView.module.css';
import { labelCopyTexts } from './labelMenu';
import { useCopyCommand } from '../../app/commands/useCopyCommand';

const COLUMNS: Column<Label>[] = [
  {
    id: 'name',
    header: 'Name',
    grow: 2,
    sortValue: (label) => label.name,
    render: (label) => (
      <span className={styles.name}>
        <Tag size={13} className={styles.icon} />
        {cellText(<Highlight text={label.name} />)}
      </span>
    ),
  },
  { id: 'changeset', header: 'Changeset', width: 100, sortValue: (label) => label.changeset, render: (label) => <span className="mono">{label.changeset}</span> },
  { id: 'branch', header: 'Branch', grow: 1, secondary: true, sortValue: (label) => label.branch, render: (label) => <PathLabel path={label.branch} /> },
  { id: 'comment', header: 'Comment', grow: 2, secondary: true, hideBelow: 640, render: (label) => <Highlight text={label.comment} /> },
  { id: 'owner', header: 'Created by', width: 180, hideBelow: 760, sortValue: (label) => label.owner, render: (label) => <UserLabel user={label.owner} /> },
  { id: 'date', header: 'Created', width: 130, secondary: true, sortValue: (label) => label.date, render: (label) => <RelativeTime date={label.date} /> },
];

export function LabelsView() {
  const workspacePath = useWorkspacePath();
  const { since, onlyMine, update } = useLabelsViewStore();
  const { data: labels, isLoading, isFetching, error } = useLabels({ sinceDate: sinceDateFor(since), owner: onlyMine ? 'me' : undefined });
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useViewSelection('labels');

  const visible = useMemo(
    () => (search.trim() ? (labels ?? []).filter((label) => matchesAllWords(`${label.name}\n${label.comment}\n${label.branch}\n${label.owner}`, search)) : (labels ?? [])),
    [labels, search],
  );
  const selected = visible.find((label) => labelKey(label) === selection.anchor);
  useRenameCommand('Labels', 'label', selection.selected.size === 1 ? selected : undefined, (label) => void renameLabel(workspacePath, label));
  useCopyCommand('Labels', 'Label', selection.selected.size === 1 && selected ? labelCopyTexts(selected) : undefined);
  const filtered = Boolean(search.trim()) || since !== 'anyTime' || onlyMine;

  return (
    <>
      <ViewHeader
        title="Labels"
        count={labels?.length}
        actions={
          <>
            <IconButton icon={<RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => openCreateLabelDialog(workspacePath)}>
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
        <ListWithDetailsSkeleton widthKey="labels" columns={COLUMNS} />
      ) : error ? (
        <EmptyState title="Couldn't load labels" description={error.message} />
      ) : visible.length === 0 && filtered ? (
        <EmptyState icon={<Tag size={22} />} title="No matching labels" description="Try a different filter or date range." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Tag size={22} />}
          title="No labels"
          description="Labels mark important changesets, like releases."
          action={<Button onClick={() => openCreateLabelDialog(workspacePath)}>Label your workspace changeset</Button>}
        />
      ) : (
        <ListWithDetails widthKey="labels"
          list={
            <HighlightQuery query={search}>
              <DataTable
                rows={visible}
                columns={COLUMNS}
                rowKey={labelKey}
                selection={selection}
                onSelectionChange={setSelection}
                selectFirstRow
                onActivate={(label) => showLabelChanges(label)}
                contextMenu={(selectedLabels) => labelMenu(workspacePath, selectedLabels)}
              />
            </HighlightQuery>
          }
          details={
            selected ? <LabelDetails key={selected.name} workspacePath={workspacePath} label={selected} menu={labelMenu(workspacePath, [selected])} /> : <NoSelection noun="label" />
          }
        />
      )}
    </>
  );
}

/** By id, so a renamed label stays selected. */
function labelKey(label: Label): string {
  return String(label.id);
}
