import { Database, Plus, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { matchesAllWords } from '../../lib/matchesAllWords';
import { focusFirstItem, moveRovingFocus } from '../../lib/rovingFocus';
import { describeServer } from '../../lib/servers';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import { ViewHeader } from '../../ui/ViewHeader';
import { useRepositories } from '../workspace/workspaceQueries';
import { openCreateRepositoryDialog } from './dialogs/CreateRepositoryDialog';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';
import { RepositoryRow } from './RepositoryRow';
import { useWorkspaceEntries } from './useWorkspaceEntries';
import styles from './Home.module.css';

/** The rows ↑/↓ walk: each repository, and the workspaces listed under an expanded one. */
const ROWS = '[data-roving-item], [data-workspace-row]';

interface RepositoriesPanelProps {
  server: string;
  onOpen: (path: string) => void;
}

export function RepositoriesPanel({ server, onOpen }: RepositoriesPanelProps) {
  const [filter, setFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { data: repositories, isLoading, isFetching, error, refetch } = useRepositories(server);
  const { all: workspaceEntries } = useWorkspaceEntries('');
  // Named as in the sidebar: "This computer", an organization's name.
  const place = describeServer(server);

  const shown = (repositories ?? []).filter((repository) => !filter.trim() || matchesAllWords(repository.name, filter));
  const workspacesOf = (repository: RepositorySummary) =>
    workspaceEntries.filter((entry) => entry.repository === repository.spec).map((entry) => entry.workspace);
  const createWorkspace = (repository: RepositorySummary): void => openCreateWorkspaceDialog({ repository, onCreated: onOpen });

  return (
    <>
      <ViewHeader
        inTitleBar
        title={place.label}
        subtitle={[place.detail, repositories && pluralize(repositories.length, 'repository', 'repositories')].filter(Boolean).join(' · ') || undefined}
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
            if (event.key === 'ArrowDown' && focusFirstItem(listRef.current, ROWS)) event.preventDefault();
          }}
        />
      </ViewHeader>

      <div
        ref={listRef}
        className={styles.list}
        onKeyDown={(event) => moveRovingFocus(event.currentTarget, event, () => searchRef.current?.focus(), ROWS)}
      >
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
