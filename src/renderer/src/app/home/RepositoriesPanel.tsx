import { Database, Plus, RefreshCw, ServerCog } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { RepositorySummary, UnityProject } from '@shared/domain/repository';
import { openServerPermissions } from '../../features/permissions/openPermissions';
import { describeServer } from '../../lib/servers';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import { ViewHeader } from '../../ui/ViewHeader';
import { useProjects, useRepositories } from '../workspace/workspaceQueries';
import { openCreateRepositoryDialog } from './dialogs/CreateRepositoryDialog';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';
import { noRepositoriesState, projectChoices, repositoriesInProject, shownProject } from './repositoryProjects';
import { ProjectFilter } from './ProjectFilter';
import { useProjectPickStore } from './projectPickStore';
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
  const { data: projects = NO_PROJECTS } = useProjects(server);
  const shownOne = shownProject(useProjectPickStore((store) => store.picks[server]), projects);
  const project = shownOne?.name ?? null;
  const pickProject = useProjectPickStore((store) => store.pick);
  const { all: workspaceEntries } = useWorkspaceEntries('');
  const choices = useMemo(() => projectChoices(projects, repositories ?? []), [projects, repositories]);
  // Named as in the sidebar: "This computer", an organization's name.
  const place = describeServer(server);

  const shown = useMemo(() => matchingRepositories(repositoriesInProject(repositories ?? [], project), filter), [repositories, project, filter]);
  const rows = repositoryListRows(shown, workspacesByRepository(workspaceEntries), expanded);
  const empty = noRepositoriesState(filter, project);
  const toggle = (repository: RepositorySummary): void => setExpanded((open) => toggled(open, repository.spec));
  const createWorkspace = (repository: RepositorySummary): void => openCreateWorkspaceDialog({ repository, onCreated: onOpen });

  return (
    <>
      <ViewHeader
        inTitleBar
        title={place.label}
        subtitle={place.detail}
        count={repositories && shown.length}
        total={repositories?.length}
        actions={
          <>
            <IconButton icon={<ServerCog size={14} />} label="Server permissions…" onClick={() => openServerPermissions(server)} />
            <IconButton icon={<RefreshCw size={14} />} label="Refresh" loading={isFetching} onClick={() => void refetch()} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => openCreateRepositoryDialog({ server, project, onWorkspaceCreated: onOpen })}>
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
        {choices.length > 0 && <ProjectFilter choices={choices} repositoryCount={repositories?.length ?? 0} project={shownOne} onChange={(picked) => pickProject(server, picked)} />}
      </ViewHeader>

      <RepositoryList
        ref={listRef}
        rows={rows}
        query={filter}
        project={project}
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
              <EmptyState icon={<Database size={22} />} title={empty.title} description={empty.description} />
            )}
          </>
        }
      />
    </>
  );
}

const NO_PROJECTS: UnityProject[] = [];

function toggled(set: ReadonlySet<string>, item: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(item)) next.add(item);
  return next;
}
