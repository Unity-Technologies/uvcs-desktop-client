import { useRef, type ReactNode } from 'react';
import { SplitPane } from '../../ui/SplitPane';
import { useCopyLinkCommand } from '../links/useCopyLinkCommand';
import { showsMerge } from '../navigation/mergeInProgress';
import { useNavigation } from '../navigation/navigationStore';
import { PageShownContext } from '../navigation/pageShown';
import { viewDefinition } from '../navigation/viewRegistry';
import { useOwnPageWindows } from '../pageWindow/useShowInFollowingWindow';
import { CommandLogPanel } from './CommandLogPanel';
import { COMMAND_LOG_HEIGHT, useCommandLogHost, useCommandLogStore } from './commandLogStore';
import { PageFrame } from './PageFrame';
import { Sidebar } from './Sidebar';
import { useMainFocus } from './useMainFocus';
import { usePlaceCommands } from './usePlaceCommands';
import styles from './PlaceLayout.module.css';

interface PlaceLayoutProps {
  /** The top bar: a workspace's branch, or the repository explored and the way to make it a workspace. */
  topBar: ReactNode;
  /** The sidebar's card naming the place, above its views. */
  sidebarCard: ReactNode;
  statusBar: ReactNode;
}

/**
 * The screen of a place, a workspace or a repository explored without one (`WorkspaceScreen`, `RepositoryScreen`):
 * the top bar, the sidebar with the place's views, the view or the page on top of it, the command log under them, the
 * status bar. What every place has runs here: its commands (`usePlaceCommands`), Copy link, its command log and its
 * page windows.
 */
export function PlaceLayout({ topBar, sidebarCard, statusBar }: PlaceLayoutProps) {
  const { view, pages, merge } = useNavigation();
  const commandLogOpen = useCommandLogStore((state) => state.open);
  const commandLogHeight = useCommandLogStore((state) => state.height);
  const setCommandLogHeight = useCommandLogStore((state) => state.setHeight);
  useCommandLogHost();
  usePlaceCommands();
  useCopyLinkCommand();
  useOwnPageWindows();
  const contentRef = useRef<HTMLDivElement>(null);
  useMainFocus(contentRef);

  const ActiveView = viewDefinition(view).component;
  const topPage = pages.at(-1);
  const mergeShown = showsMerge(merge, pages);

  return (
    <div className={styles.screen}>
      {topBar}
      <div className={styles.body}>
        <Sidebar card={sidebarCard} />
        <main className={styles.main}>
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
                  <ActiveView key={view} />
                </div>
                {/* A merge in progress stays mounted, shown or set aside, with all the user decided in it. */}
                {merge && (
                  <div key={`merge:${merge.id}`} className={styles.layer} hidden={!mergeShown}>
                    <PageShownContext.Provider value={mergeShown}>
                      <PageFrame page={merge.page} />
                    </PageShownContext.Provider>
                  </div>
                )}
                {topPage && !mergeShown && <PageFrame key={pages.length} page={topPage} />}
              </div>
            }
            second={<CommandLogPanel />}
          />
        </main>
      </div>
      {statusBar}
    </div>
  );
}
