import { Clock, FolderOpen, FolderPlus, Layers } from 'lucide-react';
import { useState } from 'react';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { useSettings } from '../settings/useSettings';
import { useMissingWorkspacePaths, useRecentWorkspaceRepositories, useWorkspaceList } from '../workspace/workspaceQueries';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';
import { recentWorkspaceEntries, unlistedRecentPaths, type WorkspaceEntry } from './recentWorkspaces';
import { WorkspaceRow } from './WorkspaceRow';
import styles from './Home.module.css';

interface WorkspacesPanelProps {
  mode: 'recent' | 'all';
  onOpen: (path: string) => void;
  onOpenFolder: () => void;
  onShowAll: () => void;
}

export function WorkspacesPanel({ mode, onOpen, onOpenFolder, onShowAll }: WorkspacesPanelProps) {
  const [filter, setFilter] = useState('');
  const { recentWorkspacePaths } = useSettings();
  const { data: workspaces, isLoading, error } = useWorkspaceList();
  const { data: repositories } = useRecentWorkspaceRepositories(workspaces);
  const { data: missingPaths = [] } = useMissingWorkspacePaths(
    mode === 'recent' && workspaces ? unlistedRecentPaths(workspaces, recentWorkspacePaths) : [],
  );

  const entries: WorkspaceEntry[] =
    mode === 'recent'
      ? recentWorkspaceEntries(workspaces ?? [], recentWorkspacePaths, missingPaths)
      : sortedByName(workspaces ?? []).map((workspace) => ({ workspace, missing: false }));
  const shown = entries.filter(({ workspace }) => matches(workspace, repositories?.[workspace.path], filter));

  return (
    <>
      <ViewHeader
        inTitleBar
        title={mode === 'recent' ? 'Recent workspaces' : 'All workspaces'}
        subtitle={workspaces && mode === 'all' ? `${workspaces.length} workspaces` : undefined}
        actions={
          <>
            <Button icon={<FolderOpen size={14} />} onClick={onOpenFolder}>
              Open folder…
            </Button>
            <Button variant="primary" icon={<FolderPlus size={14} />} onClick={() => openCreateWorkspaceDialog({ onCreated: onOpen })}>
              New workspace
            </Button>
          </>
        }
      >
        <SearchField value={filter} onChange={setFilter} placeholder="Find a workspace" autoFocus />
      </ViewHeader>

      <div className={styles.list}>
        {isLoading && <CenteredSpinner />}
        {error && <EmptyState title="Couldn't list workspaces" description={error.message} />}
        {workspaces && shown.length === 0 && (
          <EmptyWorkspaces mode={mode} filtered={filter !== ''} onShowAll={onShowAll} onOpen={onOpen} />
        )}
        <HighlightQuery query={filter}>
          {shown.map(({ workspace, missing }) => (
            <WorkspaceRow
              key={workspace.guid}
              workspace={workspace}
              repository={repositories?.[workspace.path]}
              missing={missing}
              onOpen={onOpen}
            />
          ))}
        </HighlightQuery>
      </div>
    </>
  );
}

function EmptyWorkspaces({ mode, filtered, onShowAll, onOpen }: { mode: 'recent' | 'all'; filtered: boolean; onShowAll: () => void; onOpen: (path: string) => void }) {
  if (filtered) return <EmptyState title="No matching workspaces" />;
  if (mode === 'recent') {
    return (
      <EmptyState
        icon={<Clock size={22} />}
        title="No recent workspaces"
        description="Workspaces you open show up here."
        action={<Button onClick={onShowAll}>Show all workspaces</Button>}
      />
    );
  }
  return (
    <EmptyState
      icon={<Layers size={22} />}
      title="No workspaces yet"
      description="Create a workspace to download a repository and start working with its files."
      action={
        <Button variant="primary" onClick={() => openCreateWorkspaceDialog({ onCreated: onOpen })}>
          New workspace
        </Button>
      }
    />
  );
}

function sortedByName(workspaces: WorkspaceSummary[]): WorkspaceSummary[] {
  return [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
}

function matches(workspace: WorkspaceSummary, repository: string | null | undefined, filter: string): boolean {
  return `${workspace.name} ${workspace.path} ${repository ?? ''}`.toLowerCase().includes(filter.toLowerCase());
}
