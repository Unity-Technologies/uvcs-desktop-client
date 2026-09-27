import { Clock } from 'lucide-react';
import { useRef, useState } from 'react';
import { AppMark } from '../../components/AppMark';
import { EmptyState } from '../../ui/EmptyState';
import { SearchField } from '../../ui/SearchField';
import { useWorkspaceEntries } from './useWorkspaceEntries';
import { WelcomeActions } from './WelcomeActions';
import { WorkspaceList, type WorkspaceListHandle } from './WorkspaceList';
import { WorkspaceListSkeleton } from './WorkspaceListSkeleton';
import styles from './Home.module.css';

interface WelcomePanelProps {
  onOpen: (path: string) => void;
  onOpenFolder: () => void;
  /** Shows the repositories of a server; undefined while no server is known. */
  onBrowseRepositories?: () => void;
}

/** The first thing the home screen shows: what the app is, how to start, and the workspaces to come back to. */
export function WelcomePanel({ onOpen, onOpenFolder, onBrowseRepositories }: WelcomePanelProps) {
  const [filter, setFilter] = useState('');
  const { workspaces, recent, all, isLoading, error } = useWorkspaceEntries(filter);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<WorkspaceListHandle>(null);

  return (
    <>
      {/* No header here: this strip lets the window be moved by its top edge. */}
      <div className={styles.titleBarDrag} data-drag-region />
      <div className={styles.welcome}>
        <div className={styles.welcomeColumn}>
          <header className={styles.hero}>
            <AppMark size={56} />
            <h1 className={styles.heroTitle}>Unity Version Control</h1>
            <p className={styles.heroText}>Branch freely, review every change, and check in with confidence, from one workspace or many.</p>
          </header>

          <WelcomeActions onOpen={onOpen} onOpenFolder={onOpenFolder} onBrowseRepositories={onBrowseRepositories} />

          <div className={styles.workspacesHeader}>
            <SearchField
              ref={searchRef}
              value={filter}
              onChange={setFilter}
              placeholder="Find a workspace"
              width="100%"
              autoFocus
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown') return;
                event.preventDefault();
                listRef.current?.focusFirst();
              }}
            />
          </div>

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
                  id: 'recent',
                  title: 'Recent',
                  entries: recent,
                  empty: filter ? (
                    <p className={styles.sectionEmpty}>No recent workspace matches.</p>
                  ) : (
                    <div className={styles.firstRun}>
                      <Clock size={16} />
                      <span>
                        <strong>Nothing here yet.</strong> The workspaces you open come back here, so picking up where you left off
                        is one click away.
                      </span>
                    </div>
                  ),
                },
                {
                  id: 'all',
                  title: 'All workspaces',
                  entries: all,
                  empty: (
                    <p className={styles.sectionEmpty}>
                      {filter ? 'No workspace matches.' : 'No workspaces on this computer yet. Create one from a repository to get started.'}
                    </p>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </>
  );
}
