import { Database, Plus, RefreshCw, ServerCog, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { RepositorySummary, UnityProject } from '@shared/domain/repository';
import { openServerPermissions } from '../../features/permissions/openPermissions';
import { describeServer } from '../../lib/servers';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import { ToggleChip } from '../../ui/ToggleChip';
import { ViewHeader } from '../../ui/ViewHeader';
import { useDeletedRepositories, useProjects, useRepositories } from '../workspace/workspaceQueries';
import { openCreateRepositoryDialog } from './dialogs/CreateRepositoryDialog';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';
import { deletedRepositoriesTip, repositoriesShown } from './deletedRepositories';
import { useDeletedRepositoriesStore } from './deletedRepositoriesStore';
import { noRepositoriesState, projectChoices, repositoriesInProject, shownProject } from './repositoryProjects';
import { ProjectFilter } from './ProjectFilter';
import { useProjectPickStore } from './projectPickStore';
import { RepositoryList, type RepositoryListHandle } from './RepositoryList';
import { matchingRepositories, repositoryListRows, workspaceKindsByPath, workspacesByRepository } from './repositoryListRows';
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
  const { data: deleted = NO_REPOSITORIES } = useDeletedRepositories(server);
  const { shown: withDeleted, setShown: setWithDeleted } = useDeletedRepositoriesStore();
  const shownOne = shownProject(useProjectPickStore((store) => store.picks[server]), projects);
  const project = shownOne?.name ?? null;
  const pickProject = useProjectPickStore((store) => store.pick);
  const { all: workspaceEntries } = useWorkspaceEntries('');
  const choices = useMemo(() => projectChoices(projects, repositories ?? []), [projects, repositories]);
  // Named as in the sidebar: "This computer", an organization's name.
  const place = describeServer(server);

  const listed = useMemo(() => repositories && repositoriesShown(repositories, deleted, withDeleted), [repositories, deleted, withDeleted]);
  const shown = useMemo(() => matchingRepositories(repositoriesInProject(listed ?? [], project), filter), [listed, project, filter]);
  const workspaceKinds = useMemo(() => workspaceKindsByPath(workspaceEntries), [workspaceEntries]);
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
        total={listed?.length}
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
        {deleted.length > 0 && (
          <ToggleChip pressed={withDeleted} onChange={setWithDeleted} icon={<Trash2 size={13} />} data-tip={deletedRepositoriesTip(server)}>
            Deleted
          </ToggleChip>
        )}
      </ViewHeader>

      <RepositoryList
        ref={listRef}
        rows={rows}
        workspaceKinds={workspaceKinds}
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
const NO_REPOSITORIES: RepositorySummary[] = [];

function toggled(set: ReadonlySet<string>, item: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(item)) next.add(item);
  return next;
}
