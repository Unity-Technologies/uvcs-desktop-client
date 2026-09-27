import { FolderOpen, FolderPlus, Layers } from 'lucide-react';
import { useRef, useState } from 'react';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { SearchField } from '../../ui/SearchField';
import { ViewHeader } from '../../ui/ViewHeader';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';
import { useWorkspaceEntries } from './useWorkspaceEntries';
import { WorkspaceList, type WorkspaceListHandle } from './WorkspaceList';
import { WorkspaceListSkeleton } from './WorkspaceListSkeleton';
import styles from './Home.module.css';

interface WorkspacesPanelProps {
  onOpen: (path: string) => void;
  onOpenFolder: () => void;
}

/** Every workspace on this computer, by name. */
export function WorkspacesPanel({ onOpen, onOpenFolder }: WorkspacesPanelProps) {
  const [filter, setFilter] = useState('');
  const { workspaces, all, isLoading, error } = useWorkspaceEntries(filter);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<WorkspaceListHandle>(null);

  return (
    <>
      <ViewHeader
        inTitleBar
        title="All workspaces"
        subtitle={workspaces && pluralize(workspaces.length, 'workspace')}
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
        <SearchField
          ref={searchRef}
          value={filter}
          onChange={setFilter}
          placeholder="Find a workspace"
          autoFocus
          onKeyDown={(event) => listRef.current?.takeSearchKey(event)}
        />
      </ViewHeader>

      <div className={styles.list}>
        {isLoading && <WorkspaceListSkeleton />}
        {error && <EmptyState title="Couldn't list workspaces" description={error.message} />}
        {workspaces && (
          <WorkspaceList
            ref={listRef}
            query={filter}
            onOpen={onOpen}
            onLeaveTop={() => searchRef.current?.focus()}
            sections={[
              {
                id: 'all',
                entries: all,
                empty: (
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
                ),
              },
            ]}
            noMatches={<EmptyState title="No matching workspaces" />}
          />
        )}
      </div>
    </>
  );
}
