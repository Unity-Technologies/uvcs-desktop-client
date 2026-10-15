import { Database, Plus, RefreshCw, ServerCog } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { openServerPermissions } from '../../features/permissions/openPermissions';
import { describeServer } from '../../lib/servers';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import { ViewHeader } from '../../ui/ViewHeader';
import { useRepositories } from '../workspace/workspaceQueries';
import { openCreateRepositoryDialog } from './dialogs/CreateRepositoryDialog';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';
import { RepositoryList, type RepositoryListHandle } from './RepositoryList';
import { matchingRepositories, repositoryListRows, workspacesByRepository } from './repositoryListRows';
import { useWorkspaceEntries } from './useWorkspaceEntries';

interface RepositoriesPanelProps {
  server: string;
  onOpen: (path: string) => void;
}

export function RepositoriesPanel({ server, onOpen }: RepositoriesPanelProps) {
  const [filter, setFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<RepositoryListHandle>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const { data: repositories, isLoading, isFetching, error, refetch } = useRepositories(server);
  const { all: workspaceEntries } = useWorkspaceEntries('');
  // Named as in the sidebar: "This computer", an organization's name.
  const place = describeServer(server);

  const shown = useMemo(() => matchingRepositories(repositories ?? [], filter), [repositories, filter]);
  const rows = repositoryListRows(shown, workspacesByRepository(workspaceEntries), expanded);
  const toggle = (repository: RepositorySummary): void => setExpanded((open) => toggled(open, repository.spec));
  const createWorkspace = (repository: RepositorySummary): void => openCreateWorkspaceDialog({ repository, onCreated: onOpen });

  return (
    <>
      <ViewHeader
        inTitleBar
        title={place.label}
        subtitle={place.detail}
        count={repositories?.length}
        actions={
          <>
            <IconButton icon={<ServerCog size={14} />} label="Server permissions…" onClick={() => openServerPermissions(server)} />
            <IconButton icon={<RefreshCw size={14} />} label="Refresh" loading={isFetching} onClick={() => void refetch()} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => openCreateRepositoryDialog({ server, onWorkspaceCreated: onOpen })}>
              New repository
            </Button>
          </>
        }
      >
        <SearchField
          ref={searchRef}
          value={filter}
          onChange={setFilter}
          placeholder="Find a repository"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && listRef.current?.focusFirst()) event.preventDefault();
          }}
        />
      </ViewHeader>

      <RepositoryList
        ref={listRef}
        rows={rows}
        query={filter}
        onToggle={toggle}
        onOpen={onOpen}
        onCreateWorkspace={createWorkspace}
        onLeaveTop={() => searchRef.current?.focus()}
        placeholder={
          <>
            {isLoading && <ListSkeleton rowHeight={48} />}
            {error && (
              <EmptyState
                title={`Couldn't reach ${server}`}
                description={error.message}
                action={<Button onClick={() => void refetch()}>Try again</Button>}
              />
            )}
            {repositories && shown.length === 0 && (
              <EmptyState
                icon={<Database size={22} />}
                title={filter ? 'No matching repositories' : 'No repositories yet'}
                description={filter ? undefined : 'Create one to start versioning a project.'}
              />
            )}
          </>
        }
      />
    </>
  );
}

function toggled(set: ReadonlySet<string>, item: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(item)) next.add(item);
  return next;
}
