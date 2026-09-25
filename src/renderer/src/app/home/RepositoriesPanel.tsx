import { Database, Plus, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { focusFirstItem, moveRovingFocus } from '../../lib/rovingFocus';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { useRepositories, useWorkspaceList, useRecentWorkspaceRepositories } from '../workspace/workspaceQueries';
import { openCreateRepositoryDialog } from './dialogs/CreateRepositoryDialog';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';
import { RepositoryRow } from './RepositoryRow';
import styles from './Home.module.css';

interface RepositoriesPanelProps {
  server: string;
  onOpen: (path: string) => void;
}

export function RepositoriesPanel({ server, onOpen }: RepositoriesPanelProps) {
  const [filter, setFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { data: repositories, isLoading, isFetching, error, refetch } = useRepositories(server);
  const { data: workspaces } = useWorkspaceList();
  const { data: workspaceRepositories } = useRecentWorkspaceRepositories(workspaces);

  const shown = (repositories ?? []).filter((repository) => repository.name.toLowerCase().includes(filter.toLowerCase()));
  const workspacesOf = (repository: RepositorySummary) =>
    (workspaces ?? []).filter((workspace) => workspaceRepositories?.[workspace.path] === repository.spec);
  const createWorkspace = (repository: RepositorySummary): void => openCreateWorkspaceDialog({ repository, onCreated: onOpen });

  return (
    <>
      <ViewHeader
        inTitleBar
        title={server === 'local' ? 'This computer' : server}
        subtitle={repositories ? `${repositories.length} repositories` : undefined}
        actions={
          <>
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
            if (event.key === 'ArrowDown' && focusFirstItem(listRef.current)) event.preventDefault();
          }}
        />
      </ViewHeader>

      <div ref={listRef} className={styles.list} onKeyDown={(event) => moveRovingFocus(event.currentTarget, event, () => searchRef.current?.focus())}>
        {isLoading && <CenteredSpinner />}
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
        <HighlightQuery query={filter}>
          {shown.map((repository) => (
            <RepositoryRow
              key={repository.spec}
              repository={repository}
              workspaces={workspacesOf(repository)}
              onOpen={onOpen}
              onCreateWorkspace={createWorkspace}
            />
          ))}
        </HighlightQuery>
      </div>
    </>
  );
}
