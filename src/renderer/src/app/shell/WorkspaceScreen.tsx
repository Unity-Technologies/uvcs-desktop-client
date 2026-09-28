import { Suspense, useRef } from 'react';
import { useIncomingNotificationClicks } from '../../features/incoming/incomingNotifications';
import { useMergeCommands } from '../../features/merge/useMergeCommands';
import { useNavigation } from '../navigation/navigationStore';
import { viewDefinition } from '../navigation/viewRegistry';
import { SplitPane } from '../../ui/SplitPane';
import { CommandLogPanel } from './CommandLogPanel';
import { PageFrame } from './PageFrame';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';
import { ViewFallback } from './ViewFallback';
import { COMMAND_LOG_HEIGHT, useCommandLogHost, useCommandLogStore } from './commandLogStore';
import { useMainFocus } from './useMainFocus';
import { useWindowTitle } from './useWindowTitle';
import { useWorkspaceCommands } from './useWorkspaceCommands';
import { useWorkspaceWatcher } from './useWorkspaceWatcher';
import styles from './WorkspaceScreen.module.css';

export function WorkspaceScreen() {
  const { view, pages } = useNavigation();
  const commandLogOpen = useCommandLogStore((state) => state.open);
  const commandLogHeight = useCommandLogStore((state) => state.height);
  const setCommandLogHeight = useCommandLogStore((state) => state.setHeight);
  useCommandLogHost();
  useWorkspaceWatcher();
  useWorkspaceCommands();
  useWindowTitle();
  useMergeCommands();
  useIncomingNotificationClicks();
  const contentRef = useRef<HTMLDivElement>(null);
  useMainFocus(contentRef);

  const activeView = viewDefinition(view);
  const ActiveView = activeView.component;
  const topPage = pages.at(-1);

  return (
    <div className={styles.screen}>
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <TopBar />
          {/* The command log sits under the view, as tall as it was left; the view keeps the rest. */}
          <SplitPane
            direction="vertical"
            sizedPane="second"
            initialSize={COMMAND_LOG_HEIGHT.initial}
            minSize={COMMAND_LOG_HEIGHT.min}
            maxSize={COMMAND_LOG_HEIGHT.max}
            restMinSize={COMMAND_LOG_HEIGHT.restMin}
            size={commandLogHeight}
            onSizeChange={setCommandLogHeight}
            hideSized={!commandLogOpen}
            first={
              <div ref={contentRef} className={styles.content}>
                {/* Views stay mounted under pages so going back keeps their scroll and selection. Keyed by the view so
                    each one arrives with the view transition. */}
                <div key={view} className={styles.layer} hidden={Boolean(topPage)}>
                  <Suspense fallback={<ViewFallback view={activeView} />}>
                    <ActiveView key={view} />
                  </Suspense>
                </div>
                {topPage && <PageFrame key={pages.length} page={topPage} />}
              </div>
            }
            second={<CommandLogPanel />}
          />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
