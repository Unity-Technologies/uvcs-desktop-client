import { Suspense, useRef } from 'react';
import { CenteredSpinner } from '../../ui/Spinner';
import { useIncomingNotificationClicks } from '../../features/incoming/incomingNotifications';
import { useMergeCommands } from '../../features/merge/useMergeCommands';
import { useNavigation } from '../navigation/navigationStore';
import { viewDefinition } from '../navigation/viewRegistry';
import { CommandLogPanel } from './CommandLogPanel';
import { PageFrame } from './PageFrame';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';
import { useCommandLogHost, useCommandLogStore } from './commandLogStore';
import { useMainFocus } from './useMainFocus';
import { useWindowTitle } from './useWindowTitle';
import { useWorkspaceCommands } from './useWorkspaceCommands';
import { useWorkspaceWatcher } from './useWorkspaceWatcher';
import styles from './WorkspaceScreen.module.css';

export function WorkspaceScreen() {
  const { view, pages } = useNavigation();
  const commandLogOpen = useCommandLogStore((state) => state.open);
  useCommandLogHost();
  useWorkspaceWatcher();
  useWorkspaceCommands();
  useWindowTitle();
  useMergeCommands();
  useIncomingNotificationClicks();
  const contentRef = useRef<HTMLDivElement>(null);
  useMainFocus(contentRef);

  const ActiveView = viewDefinition(view).component;
  const topPage = pages.at(-1);

  return (
    <div className={styles.screen}>
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <TopBar />
          <div ref={contentRef} className={styles.content}>
            {/* Views stay mounted under pages so going back keeps their scroll and selection. Keyed by the view so
                each one arrives with the view transition. */}
            <div key={view} className={styles.layer} hidden={Boolean(topPage)}>
              <Suspense fallback={<CenteredSpinner />}>
                <ActiveView key={view} />
              </Suspense>
            </div>
            {topPage && <PageFrame key={pages.length} page={topPage} />}
          </div>
          {commandLogOpen && <CommandLogPanel />}
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
