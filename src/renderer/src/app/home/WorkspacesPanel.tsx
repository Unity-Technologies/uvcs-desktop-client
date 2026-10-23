import { FolderOpen, FolderPlus, Layers } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { SearchField } from '../../ui/SearchField';
import { ViewHeader } from '../../ui/ViewHeader';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';
import { PlaceFilter } from './PlaceFilter';
import { entryMatches } from './recentWorkspaces';
import { useWorkspaceEntries } from './useWorkspaceEntries';
import { isInPlace, organizationsOf, placeChoices, type WorkspacePlace } from './workspacePlaces';
import { useReadProjects } from '../workspace/workspaceQueries';
import { WorkspaceList, type WorkspaceListHandle } from './WorkspaceList';
import { WorkspaceListSkeleton } from './WorkspaceListSkeleton';
import styles from './Home.module.css';

interface WorkspacesPanelProps {
  onOpen: (path: string) => void;
  onOpenFolder: () => void;
}

/** Every workspace on this computer, by name, narrowed to where their repositories live if the user picks a place. */
export function WorkspacesPanel({ onOpen, onOpenFolder }: WorkspacesPanelProps) {
  const [filter, setFilter] = useState('');
  const [place, setPlace] = useState<WorkspacePlace | null>(null);
  const { workspaces, all: everyEntry, isLoading, error } = useWorkspaceEntries('');
  const organizations = organizationsOf(everyEntry);
  const readProjects = useReadProjects(organizations);
  const choices = useMemo(() => placeChoices(everyEntry, readProjects), [everyEntry, readProjects]);
  const all = everyEntry.filter((entry) => entryMatches(entry, filter) && isInPlace(entry, place));
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<WorkspaceListHandle>(null);

  return (
    <>
      <ViewHeader
        inTitleBar
        title="All workspaces"
        count={workspaces && all.length}
        total={workspaces?.length}
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
        {choices.length > 0 && <PlaceFilter choices={choices} place={place} onChange={setPlace} />}
      </ViewHeader>

      <div className={styles.list}>
        {isLoading && <WorkspaceListSkeleton />}
        {error && <EmptyState title="Couldn't list workspaces" description={error.message} />}
        {workspaces && (
          <WorkspaceList
            ref={listRef}
            query={filter}
            narrowed={place !== null}
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
