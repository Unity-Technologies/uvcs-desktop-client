import { Clock } from 'lucide-react';
import { useRef, useState } from 'react';
import { AppMark } from '../../components/AppMark';
import { APP_NAME, APP_TAGLINE } from '../../lib/appIdentity';
import { EmptyState } from '../../ui/EmptyState';
import { SearchField } from '../../ui/SearchField';
import { useWorkspaceEntries } from './useWorkspaceEntries';
import { WelcomeActions } from './WelcomeActions';
import { WorkspaceList, type WorkspaceListHandle, type WorkspaceListSection } from './WorkspaceList';
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

  const sections: WorkspaceListSection[] = [
    {
      id: 'recent',
      title: 'Recent',
      entries: recent,
      empty: (
        <div className={styles.firstRun}>
          <Clock size={16} />
          <span>
            <strong>Nothing here yet.</strong> The workspaces you open show up here, one click away.
          </span>
        </div>
      ),
    },
    {
      id: 'all',
      title: 'All workspaces',
      entries: all,
      empty: <p className={styles.sectionEmpty}>No workspaces on this computer yet. Create one from a repository to get started.</p>,
    },
  ];

  return (
    <>
      {/* No header here: this strip lets the window be moved by its top edge. */}
      <div className={styles.titleBarDrag} />
      <div className={styles.welcome}>
        <div className={styles.welcomeColumn}>
          <header className={styles.hero}>
            <AppMark size={56} />
            <h1 className={styles.heroTitle}>{APP_NAME}</h1>
            <p className={styles.heroText}>{APP_TAGLINE}</p>
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
              onKeyDown={(event) => listRef.current?.takeSearchKey(event)}
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
              sections={sections}
              noMatches={<p className={styles.sectionEmpty}>No workspace matches.</p>}
            />
          )}
        </div>
      </div>
    </>
  );
}
